# MAALI security and cost review — 2026-11-12

Scope: payments, membership, auth, roles, database functions, storage, email,
partner invites and anything that costs money per call. UI-only issues and tests
are out of scope.

How to read this: every finding comes from reading the code and migrations in
this repo. **Nothing here was tested against a live database or a live payment
provider.** Where a finding depends on how the deployed database or a third
party behaves, it says so and gives a check to run.

Status key: **OPEN** = not fixed when found (see the table in section 1 for current status). **FIXED** = fixed on branch
`fix/security-review-fixes` (not deployed). **BUILT** = new code on that branch.

---

## 1. Findings from the deep dive — most serious first

Status after the follow-up fix round (all on the branch, **uncommitted, not
deployed, not run**):

| ID | Finding | Status | Where the fix is |
|---|---|---|---|
| O1 | Email queue readable by anyone | FIXED | `20261112120000_lock_down_definer_functions.sql` |
| O2 | Sign-up never verifies email ownership | **OPEN — needs a product decision** | — |
| O3 | Stripe customer matched by email | FIXED | `create-portal-session`, `create-membership-payment` |
| O4 | Anyone can notify any user | FIXED | `20261112120000_…` (client execute revoked) |
| O5 | Privileged functions with no caller check | FIXED for the functions listed in the migration; `get_user_role`, `get_reviewer_workload`, `user_can_apply_to_opportunities`, `assign_reviewer_category` left as is (used by RLS/other callers, low impact) | `20261112120000_…` |
| O6 | `validate-email` open paid API | FIXED (20 lookups per IP per hour, then the paid check is skipped) | `validate-email` |
| O7 | Storage rules too wide | FIXED | `20261112130000_storage_tighten.sql`, `src/pages/admin/Financial.tsx` |
| O8 | Auth rate limiting can be sidestepped | **OPEN — server/proxy configuration** | — |
| O9 | Webhook URLs can target internal hosts | FIXED | `_shared/webhookUrl.ts`, `manage-partner-api`, `process-partner-webhooks` |
| O10 | Smaller items | Stripe "no payment intent" case FIXED; the rest OPEN | `create-membership-payment` |

Side effects of these fixes to check when deploying:

- `create_notification` used to reject service-role callers (it required a
  user id in the JWT), so notifications from webhooks and cron were silently
  dropped. The migration fixes that; expect "Membership activated/expired"
  notifications to start appearing.
- `src/hooks/useNotifications.ts` exports a `createNotification` helper that
  calls the RPC from the browser. Nothing in `src/` uses it (only a test). It
  will now get "permission denied".
- Stripe: a user whose Stripe customer was created without `metadata.userId`
  and whose membership row has no stored customer id gets a new customer at
  checkout, and "No billing account found" from the billing portal.
- Receipts bucket is private. User downloads go through `generate-invoice`
  (unchanged); the admin Financial page now opens a signed URL. Any receipt URL
  pasted elsewhere stops working.
- Storage policy for partner image changes uses `storage.objects.owner_id`.
  Confirm that column exists on the self-hosted storage version before applying.
- Reviewers lose access to documents of applications not assigned to them.

The original write-ups follow; "OPEN" in the headings below reflects the state
when found — use the table above for current status.

### O1. Anyone on the internet can read and swallow the outgoing email queue — OPEN, critical

- Where: `public.claim_email_batch(p_limit)` in
  `supabase/migrations/20250827000000_consolidated_baseline.sql:799`, granted to
  `anon` and `authenticated` at lines 7844–7845.
- What: the function is `SECURITY DEFINER`, has no caller check, and returns
  whole `email_queue` rows (recipient address + payload) while marking them
  `processing`.
- Impact: an unauthenticated call to `/rest/v1/rpc/claim_email_batch` with the
  public anon key returns queued emails (names, addresses, application details)
  and stops them being sent.
- Fix: `REVOKE ALL ON FUNCTION public.claim_email_batch(integer) FROM PUBLIC, anon, authenticated;`
  and grant to `service_role` only.
- Check first: `select has_function_privilege('anon', 'public.claim_email_batch(integer)', 'execute');`

### O2. Sign-up never proves the person owns the email address — OPEN, high

- Where: `supabase/functions/rate-limited-auth/index.ts` — `signUpWithSession`
  (line 86) and `signInWithPasswordConfirmed` (line 60) both call
  `auth.admin.updateUserById(..., { email_confirm: true })`.
- What: any email can be registered with a password and is marked confirmed
  immediately, with a working session.
- Impact:
  - Account pre-hijack: an attacker registers `victim@company.com`. If the
    real owner later signs in with Google or a magic link, Supabase attaches
    them to the same (already "confirmed") account, and the attacker still has
    the password.
  - It is what makes O3 exploitable.
  - Partner invites: an invited address may already be an attacker-created
    account. The new invite step (section 3) requires the emailed token, which
    stops the attacker accepting, but the real owner would still be accepting
    into an account whose password the attacker knows.
- Fix options: stop auto-confirming and gate paid/partner actions on a real
  confirmation; or keep instant access but track a separate "email verified"
  flag set only by a link/OTP, and require it before billing portal, partner
  invite acceptance and Google account linking.

### O3. Stripe customer is matched by email, so a squatted email opens someone else's billing portal — OPEN, high (depends on O2)

- Where: `supabase/functions/create-portal-session/index.ts:38` and
  `supabase/functions/create-membership-payment/index.ts` (customer lookup
  `stripe.customers.list({ email })`).
- What: when the membership row has no `stripe_customer_id`, the first Stripe
  customer with the same email is adopted and written back to the row.
- Impact: with O2, registering a paying member's email (on a second account, or
  before they sign up) gives a Stripe billing-portal session for their
  customer: invoices, card last4, cancel subscription, change payment method.
- Fix: never look customers up by email. Create the customer once with
  `metadata.userId` and only ever use the id stored server-side; in the
  fallback, require `customer.metadata.userId === userId`.

### O4. Any signed-in user can put a notification in any other user's inbox — OPEN, medium/high

- Where: `public.create_notification(...)`, baseline line 924; granted to
  `authenticated` (line 7871). Its only check is `auth.uid() IS NOT NULL`.
- Impact: in-app phishing — e.g. "Membership payment failed" with a link of the
  attacker's choosing — delivered to any user id, appearing as a system notice.
- Fix: revoke from `authenticated` (edge functions call it with the service
  role; triggers run as definer), or require `p_user_id = auth.uid()` unless
  the caller is admin. Check `src` for client-side callers before revoking.

### O5. Privileged database functions with no caller check — OPEN, medium

These are `SECURITY DEFINER`, contain no `auth.uid()` / role check, and are not
revoked from client roles in the migrations:

| Function | What a caller can do |
|---|---|
| `assign_reviewers_to_application(uuid, int)` | trigger reviewer assignment for any application (granted to `anon`) |
| `mark_all_notifications_read(uuid)` | mark any user's notifications read |
| `get_application_submission_preview(uuid, int)` | read another user's eligibility/preview for an opportunity |
| `check_and_increment_rate_limit(uuid, inet, ...)` | burn the auth rate limit for someone else's IP (lock them out) |
| `get_reviewer_workload(uuid)`, `user_can_apply_to_opportunities(uuid)`, `get_user_role(uuid)` | read role / workload / membership state of any user id |
| `assign_reviewer_category(uuid, text)`, `notify_partner_org_members(...)` | no explicit grant or revoke found — depends on default privileges |

Also check these, which are revoked `FROM PUBLIC` only. On Supabase, default
privileges usually grant `EXECUTE` to `anon` and `authenticated` directly, and
a `PUBLIC` revoke does not remove that (the `get_user_id_by_email` migration
already handles this correctly):

- `partner_api_list_applications_ranked`, `partner_api_get_application_ranked`
  — take a `p_partner_id` argument and return ranked applications. If
  executable by `authenticated`, any user can read any partner's applicants.
- `claim_partner_webhook_batch`, `enqueue_partner_webhook_event`,
  `cancel_membership`, `downgrade_membership_to_community` (the last two do
  revoke `authenticated` explicitly — confirm `anon`).

Check: run for each
`select has_function_privilege('anon', '<signature>', 'execute'), has_function_privilege('authenticated', '<signature>', 'execute');`
Fix: one migration that revokes `PUBLIC, anon, authenticated` on every
service-only function and adds caller checks to the rest.

### O6. `validate-email` is an open, unmetered call to a paid API — OPEN, cost

- Where: `supabase/functions/validate-email/index.ts`.
- What: no auth, no captcha, no rate limit; each request calls Abstract API with
  the project's key.
- Impact: a simple loop exhausts the Abstract quota / runs up the bill, and the
  endpoint tells the caller whether any address is deliverable.
- Fix: put it behind the same Turnstile + `check_and_increment_rate_limit`
  path as `rate-limited-auth`, or fold it into sign-up.

### O7. Storage rules are wider than the table rules — OPEN, medium

- Reviewers can read **all** files in `application-docs`
  (`Reviewers can view all application documents`), while the
  `application_documents` table limits reviewers to assigned applications.
- Any partner can update or delete **any** file under `project-images/projects/`
  (`Partners can delete project images` / `update`), including other partners'
  and admin-created opportunity images.
- The `receipts` bucket was set `public = true` in
  `20260318190000_receipts_bucket_public.sql`. The per-user SELECT policies do
  not apply to public-URL reads, so any receipt PDF is readable by anyone with
  its URL (path is `<userId>/<file>`; contains name, amount, email, card last4).
  Fix: make it private and serve signed URLs.

### O8. Auth rate limiting can be sidestepped — OPEN, medium

- `rate-limited-auth` fails open if the limiter RPC errors (line ~185).
- The client IP comes from `x-real-ip` / first `x-forwarded-for` entry
  (`_shared/auth.ts:151`). Unless the proxy in front overwrites these, a caller
  can rotate the header and never hit the limit. Turnstile still applies.
- The wrapper is optional: the anon key can call GoTrue (`/auth/v1/signup`,
  `/token`) directly, skipping both the limiter and Turnstile, unless captcha
  and rate limits are also configured in GoTrue itself. Confirm the GoTrue
  settings on the VPS.

### O9. Partner webhook URLs are not checked for internal addresses — OPEN, low/medium

- Where: `manage-partner-api/index.ts:189` only requires `https://`;
  `process-partner-webhooks/index.ts:92` then POSTs from the server.
- Impact: a partner admin can point the webhook at an internal host on the VPS
  network and use delivery status/timing to probe it (server-side request
  forgery).
- Fix: resolve the host and reject private, loopback and link-local ranges; do
  not follow redirects.

### O10. Smaller items — OPEN, low

- `create-membership-payment`: if the first invoice has no payment intent
  (`!paymentIntent?.client_secret`), membership is activated immediately. Safe
  today, but a Stripe API version bump that moves that field would hand out
  free memberships. Check `invoice.status === 'paid'` instead.
- `_shared/cors.ts` falls back to `Access-Control-Allow-Origin: *` when
  `ALLOWED_ORIGINS` is unset. Confirm it is set on the VPS.
- `expire-prepaid-memberships`, `process-email-queue`,
  `process-partner-webhooks` and `verifyTurnstile` skip their secret check when
  `SUPABASE_URL` contains `localhost`/`127.0.0.1` and the secret is unset.
  Confirm the self-hosted functions do not see a localhost `SUPABASE_URL`.
- `send-email`: the public contact path can send a confirmation email to any
  address; its rate limit is in-memory per function instance.
- `send-email`: `btoa(String.fromCharCode(...bytes))` on the receipt PDF will
  throw for large files; the email is then sent without the attachment.
- Seed scripts accept `VITE_SUPABASE_SERVICE_ROLE_KEY`. Nothing in `src/` (bar
  tests) reads it, so it is not bundled today, but a `VITE_`-prefixed service
  key is one import away from shipping to browsers. Rename it.
- `docs/RLS_VERIFY_JWT_AUDIT.md` states receipt-class emails are internal-only
  and that reviewers see only assigned documents; the code did not match either
  (first is now fixed, second is O7).

---

## 2. Fixed on `fix/security-review-fixes` (commit `2bb4d5f`, plus uncommitted follow-ups)

None of this is deployed or applied to a database. Edge functions were not
typechecked (no Deno on the dev machine).

| # | Problem | Fix |
|---|---|---|
| F1 | Users could set their own `memberships` row to paid via RLS | `20261112100000_memberships_rls_lockdown.sql`: client writes must be `tier = 'community'` with every billing column empty. `Onboarding.tsx` now clears those columns. |
| F2 | Paystack activation ignored the amount paid | `isPaystackMembershipCharge()` — amount must equal the configured price, or the charge must carry the configured plan code. Used in `verify-paystack-payment` and `paystack-webhook`. |
| F3 | An old Paystack reference could re-activate a membership | `activateMembership` refuses a reference that already has a completed transaction. |
| F4 | Any signed-in user could send any email template to anyone | `send-email`: a user session may only send `welcome` to its own address. |
| F5 | Application details page crashed (`t is not a function`) | `ProjectDetailsCard.tsx` passes the translator. |
| F6 | Paystack cancel downgraded immediately | `subscription.not_renew` now only sets `cancel_at_period_end`. |
| F7 | Paystack renewals might never extend `expires_at` | Renewals matched by the payer's active Paystack membership. |
| F8 | Failed activation still marked the webhook event done | Membership write failures now throw (Paystack and Stripe `invoice.paid`). |
| F9 | Partner invite converted existing accounts without consent | Replaced by the accept step in section 3. |
| F10 | Partner status badge arguments | `OpportunityApplications.tsx`. |

Things to confirm before deploying these:

- Paystack dashboard plan amounts match the code: ₦3,000 / GH₵30 / KSh 260 / R 36.
  If a plan differs **and** Paystack's event omits the plan code, a genuine
  payment is refused (F2).
- Run a Paystack test-mode subscription through first charge, renewal and
  cancel to confirm F6 and F7 against real events.
- F4: only the welcome email was found being sent from the browser. Any other
  browser-sent email would now get a 403.

---

## 3. Built: partner invite acceptance — BUILT, uncommitted

Flow now:

1. A platform admin or a partner org admin enters an email (unchanged UI).
2. **New email** → account is created as a partner and gets a sign-in link
   (unchanged).
3. **Email that already has a non-partner account** → nothing changes on the
   account. A row is stored in `partner_invites` and the emailed link lands on
   `/partner/accept-invite?invite_token=…`.
4. The invitee sees which organisation invited them and a warning that the
   account becomes a partner account, then accepts or declines.
   `accept-partner-invite` converts the profile only on accept, and only with
   the token from the email.
5. Admin and reviewer accounts are still refused.

Files: `supabase/migrations/20261112110000_partner_invites.sql`,
`supabase/functions/accept-partner-invite/index.ts`,
`supabase/functions/invite-partner/index.ts`,
`src/pages/partner/AcceptInvite.tsx`, route in `src/App.tsx`, `partner.invitePage`
strings in all four `dashboard.json` locales, `supabase/config.toml`.

To deploy:

- Apply both `20261112…` migrations.
- Deploy `accept-partner-invite` (new) and the changed functions.
- Add `<SITE_URL>/partner/accept-invite` (with query string allowed, e.g. a
  `/**` pattern) to the auth redirect allow-list. If it is not allowed, the
  link falls back to the site URL, the token is lost, and the page tells the
  user to open the emailed link.
- Regenerate `src/integrations/supabase/types.ts` (the page casts the table
  name until then).

Known gaps: invites expire after 7 days, but the sign-in link in the email
expires sooner (the email says 24 hours); the invite email wording still says
"set up your account"; there is no list of pending invites on the team page.
Not run end to end.

---

## 4. Still open from the first review (seed scripts / working tree)

- The working tree deletes
  `supabase/migrations/20260922100000_restore_admin_delete_opportunity.sql`
  while `useAdminProjects.ts:391` still calls that RPC. Restore the file unless
  the deletion is deliberate.
- `scripts/seed-grants.js`: re-running resets `current_applicants`, `status`
  and `max_applicants` on live rows; 16 of 28 grants have past deadlines but
  are seeded `open`; sector lookup can hit the slug unique constraint.
- `scripts/seed-content.js`: storage upload failures are swallowed; blog
  views/featured reset on re-run; demo placeholder text and links are destined
  for the live site.

---

## 5. Not reviewed

- `submit-application` and `update-application-status` beyond their auth checks.
- The older Stripe one-off checkout handlers in `stripe-webhook/handlers.ts`
  (lines 59–1148).
- `partner-api` handlers beyond key authentication.
- `auth-email-hook`, `generate-invoice`, the `translate-*` functions' cost
  limits, and table-level RLS for tables not named above.
- The live database: actual grants, policies and bucket settings may differ
  from the migrations.

---

## 6. Local test results — 2026-11-12

Run against the local Supabase stack (Docker) with the existing local data
(20 users, 20 applications). All pending migrations, including the five new
`20261112…` ones, applied without errors. Test users created for the run were
deleted afterwards; database checks ran in rolled-back transactions.

**Database (35 checks, all pass)**

- Memberships: a user cannot upgrade their own row, flip a pending row to
  active, insert a paid row, or set billing columns; community insert and the
  Onboarding fallback still work.
- Functions: `anon` and ordinary users get "permission denied" on
  `claim_email_batch`, `create_notification`, `mark_all_notifications_read`,
  `partner_api_list_applications_ranked`, `cancel_membership`,
  `check_and_increment_rate_limit`; non-admins are refused by
  `assign_reviewers_to_application`. The service role still works, an admin can
  still assign reviewers, and the trigger chain still creates the reviewer's
  notification.
- Storage: receipts bucket is private; a reviewer sees 18 of 44 application
  documents (exactly the assigned ones); a partner can delete their own
  project image but not someone else's.
- `partner_invites`: invitee can read only their own invite and cannot create
  or accept one directly.

**Edge functions (34 checks, all pass)**

- `send-email`: a user cannot send `password_reset` or `welcome` to another
  address; no token is rejected; own welcome email passes the gate.
- Invites: existing applicant is not converted at invite time; another user,
  a missing token and a wrong token are all refused; the right token converts
  the account; an invite cannot be reused; decline leaves the account alone;
  a new email is still set up directly; an applicant cannot send invites.
- `paystack-webhook` (events signed with a local dummy secret): bad signature
  rejected; ₦100 charge and unsupported currency do not activate; correct
  prepaid charge activates and creates the notification; replaying a used
  reference after expiry or downgrade does not re-activate; a charge on the
  configured plan activates; a renewal with no metadata and no subscription
  code extends the expiry; `not_renew` keeps access and flags the
  cancellation; `disable` downgrades.
- Webhook host filter: 14 of 14 cases (private ranges, localhost, internal
  names, IPv6).

**Found and fixed during testing**

- `notifications_type_check` did not allow the types `payment` and
  `review_assignment` that the edge functions send, so every payment
  notification was rejected by the database. Fixed in
  `20261112140000_notifications_allow_payment_types.sql`.

**Observed**

- Inside the local edge runtime `SUPABASE_URL` is `http://kong:8000`, so the
  "skip the secret check on localhost" branches (O10) do not trigger even
  locally; cron-protected functions returned 503 without `CRON_SECRET`.

**Not tested**

- Anything that needs the real Paystack or Stripe API: `verify-paystack-payment`
  beyond failing closed, Stripe checkout (`STRIPE_MEMBER_PRICE_ID` is not set
  locally), the billing portal customer lookup, and whether real Paystack
  events have the shape the webhook tests assumed.
- The browser: the accept-invite page and the admin receipt button were not
  opened in the app.
- Real email delivery, the partner webhook delivery job, and the
  `validate-email` cap beyond confirming the function still responds.

---

## 7. Second pass — new findings (all OPEN unless marked)

Covered this time: table write rules for the main tables, the partner API,
application submission and status updates, the auth email hook, invoices,
HTML rendering in the frontend, and npm dependencies. Read from the
migrations and code; **not run against a database** (the first three are easy
to confirm with one `UPDATE` each as a normal user on the local stack).

### N1. An applicant can edit their own application's status and scores — OPEN, critical

- Where: policy `Applications updatable by authorized roles` — the owner may
  update their row while the opportunity is open, and nothing restricts which
  columns (the only BEFORE triggers are the rate limit and `updated_at`).
- Impact: `supabase.from('applications').update({ status: 'approved' }).eq('id', myApp)`
  from the browser. The same applies to any score, rank or review-note column
  on the row.
- Also: reviewers may update **any** application, not only assigned ones.
- Fix: a BEFORE UPDATE trigger that rejects changes to status/score/review
  columns unless the caller is admin or service role (same idea as
  `prevent_role_self_update`), and limit reviewers to assigned applications.

### N2. A partner user can move themselves into any organisation, as its admin — OPEN, critical

- Where: `profiles` owner-update policy plus `prevent_role_self_update`, which
  only guards `role`. `partner_id` and `partner_role` are free to edit, and
  `get_user_partner_org_id()` / `is_partner_org_admin()` read them.
- Impact: any account with the partner role (including an invited team
  *member*) can set `partner_id` to another organisation and
  `partner_role = 'admin'`, then read that organisation's applicants and
  documents, edit its opportunities, manage its team and API keys.
- Fix: extend the trigger to block changes to `partner_id` and `partner_role`
  unless the caller is admin or service role. The team RPCs
  (`link_partner_team_member`, `update_partner_team_member_role`,
  `remove_partner_team_member`) are SECURITY DEFINER and must keep working —
  check `auth.role()` / a session flag rather than the row owner.

### N3. Anyone signed in can write review scores — OPEN, high

- Where: policy `Reviewers can insert their own scores` only checks
  `auth.uid() = reviewer_id`. No role or assignment check.
- Impact: an applicant can insert a "review" of their own application.
  `handle_review_completion` counts rows in `review_scores` against the number
  of assignments, so fake rows can mark a review complete and skew averages.
- Fix: require the reviewer role and a matching `application_assignments` row
  in the INSERT (and UPDATE) policy.

### N4. Users can mark their own KYC as verified — OPEN, high

- Where: policy `KYC updatable by owner or admin`. The USING clause limits
  owners to rows that are `pending`/`rejected`, but the WITH CHECK clause does
  not limit the new status.
- Impact: `update kyc_verifications set status = 'verified'` on your own row;
  it also triggers the "KYC verified" email.
- Fix: owner WITH CHECK must require `status = 'pending'`.

### N5. Users can create and edit their own payment records — OPEN, high

- Where: `transactions` policies `Users can create their own transactions` and
  `Transactions updatable by owner or admin`.
- Impact: a user can insert a "completed" transaction of any amount, then
  download an official MAALI receipt for it from `generate-invoice`; admin
  revenue figures include it. They can also alter real records.
- Fix: remove client INSERT/UPDATE on `transactions`; only service-role
  functions write them. Check `src/` for client writes first.

### N6. `submit-application` can overwrite a non-draft application — OPEN, medium

- Where: `supabase/functions/submit-application/index.ts` — the `draftId` path
  updates `applications` where `id = draftId and user_id = user.id`, with no
  `is_draft = true` condition, and also rewrites `opportunity_id`.
- Impact: a user can pass the id of an already-reviewed application of theirs
  as `draftId` together with a different opportunity. The row moves to the new
  opportunity with status `pending`, keeping its existing reviews and scores.
- Fix: add `.eq("is_draft", true)` (and keep the opportunity fixed).

### N7. Dependencies — OPEN, medium

`npm audit --omit=dev`: 30 advisories (1 critical, 14 high). The ones that
reach the running app:

- `dompurify` (high, direct) — XSS bypass. This is the library protecting the
  three places that render stored HTML (opportunity description, blog post,
  partner opportunity page), so it matters. Non-breaking fix available.
- `react-router` / `react-router-dom` (high, direct) — open redirect / XSS via
  untrusted paths. Non-breaking fix available.
- `zod` (high, direct) — memory exhaustion on oversized input; fix is a major
  version bump.
- `protobufjs` (critical, indirect), `ws`, `lodash`, `postcss` and the rest are
  indirect or build-time; `npm audit fix` clears the non-breaking ones.

### N8. Partner API webhook save path missed the internal-host check — FIXED (uncommitted)

`putWebhooks` in `_shared/partnerApiHandlers.ts` is a second place a webhook
URL is saved. It now uses `isForbiddenWebhookHost` too. (Delivery already
refused private targets.)

### Checked and found sound

- Partner API: every handler filters by the API key's `partner_id`, and
  application access goes through `verifyOpportunityOwnership`.
- `update-application-status`: admin check, then an RPC run as the caller.
- `auth-email-hook`: verifies the hook signature and refuses unsigned requests
  outside local development.
- `generate-invoice`: non-admins are limited to their own records (but see N5).
- Frontend HTML: all three `dangerouslySetInnerHTML` uses of stored content go
  through DOMPurify (but see N7).
- `profiles.role` self-escalation is blocked; `memberships` (fixed earlier).

### Still not reviewed

- The older one-off checkout handlers in `stripe-webhook/handlers.ts`.
- Read (SELECT) policies table by table, and tables not named in this document.
- Translate functions' spend limits (callable only by admin, assigned reviewer
  or the owning partner; no size cap found).
- Deploy pipeline and the VPS configuration.

---

## 8. Second-pass fixes and test results — 2026-11-12

Status of section 7 (all on the branch, uncommitted, not deployed):

| ID | Finding | Status | Fix |
|---|---|---|---|
| N1 | Applicant can edit own application status | FIXED, tested | `20261112150000_table_rule_hardening.sql` — client writes limited to drafts |
| N2 | Partner can move into any organisation | FIXED, tested | same migration — `partner_id` / `partner_role` guarded |
| N3 | Anyone can write review scores | FIXED, tested | same migration — reviewer role + assignment required |
| N4 | Users can mark own KYC verified | FIXED, tested | same migration — owners can only submit as `pending` |
| N5 | Users can write own payment records | FIXED, tested | same migration — client insert/update removed |
| N6 | `submit-application` overwrites non-drafts | FIXED, tested | `submit-application/index.ts` — `is_draft = true` required |
| N7 | Dependency advisories | PARTLY FIXED | `npm audit fix`: 30 → 8. Left: `zod` (needs a major version bump) and `quill` (no fix published) |
| N8 | Partner API webhook save path | FIXED | `_shared/partnerApiHandlers.ts` |

**Tests on the local stack** (rolled-back transactions; test users deleted):

- Applications (12): owner, reviewer and direct non-draft inserts are refused;
  draft create/edit, the admin status RPC, admin direct edits and the service
  role still work.
- Review scores (4): applicant and unassigned reviewer refused; assigned
  reviewer can insert and edit, and the completion trigger still updates the
  application.
- Partner fields (5): self-move and self-promotion refused; name edits, the
  admin team-role RPC and the service role still work.
- KYC (5): inserting or updating to `verified` refused; pending submit,
  resubmit and admin verification work.
- Transactions (3): insert and update refused; reading own records works.
- `submit-application` (3): a reviewed application passed as `draftId` is left
  untouched; a real draft still submits (captcha satisfied with Cloudflare's
  published always-pass test secret).
- The earlier 34 edge-function checks were re-run afterwards: all pass.
- After the dependency update the app builds and the typecheck is unchanged
  (24 pre-existing errors).

**Behaviour changes to know about**

- Clients can no longer insert a non-draft application directly. Before, this
  also bypassed the membership gate and captcha in `submit-application`.
- Reviewers can no longer update `applications` rows directly (no client code
  does); status changes happen through the review-completion trigger.

**Noticed, not changed**

- `applications` has no DELETE policy, so the "discard draft" call in
  `useAutoSaveDraft.ts` deletes nothing. This was already the case before
  these changes.
- `npm audit fix --omit=dev` removes dev dependencies from `node_modules`;
  run a plain `npm install` afterwards (done here).

---

## 9. Third pass — read access, remaining tables, legacy Stripe, translation spend, deploy

Read rules and data functions were checked on the local database (migrations
applied) by calling them as an applicant, as an anonymous visitor and as a
reviewer. Everything else in this section is from reading the code.

### What is sound

- Every table in `public` has row security on. The eight tables without
  policies (`stripe_events`, `paystack_events`, `partner_api_*`,
  `partner_webhooks*`) are service-role only, which is correct.
- All 30 admin/reviewer/partner data functions probed (`get_all_users_for_admin`,
  `get_admin_stats`, `get_financial_stats`, `get_admin_applications`,
  `get_application_details`, the ranked-application and reviewer functions,
  the `admin_*` writers, `cleanup_old_pending_payment_applications`, the
  partner team RPCs, …) refuse an ordinary applicant and an anonymous caller.
- An applicant sees no other user's applications, profiles, documents, review
  scores or assignments. An anonymous visitor sees no applications or profiles.
- Memberships, KYC, transactions, billing addresses, payment methods,
  notifications and activity logs are own-row (plus admin) for reads.

### R1. Partner contact details are public — OPEN, medium

- Where: policy `Public can view active partners` on `partners` (to `anon` and
  `authenticated`), with full-table SELECT granted.
- Confirmed locally: an anonymous request can read `contact_name`,
  `contact_phone`, `contact_country`, `user_id` and `created_by` of every
  active partner. The `partners_public` view exists to hide these, but it is
  `security_invoker`, so it needs the same wide policy on the base table.
- Fix: make `partners_public` a definer view (or a SECURITY DEFINER function)
  exposing only the public columns, point the public pages at it, and drop the
  public policy from the base table. The frontend reads both `partners` and
  `partners_public` today, so the public pages need checking when this changes.

### R2. Reviewers can read every submitted application and every profile — OPEN, medium (design decision)

- Confirmed locally: a reviewer could read 12 applications not assigned to
  them and all 19 other profiles. `reviewer_conflicts` exists, but a conflicted
  reviewer can still open the application directly.
- Your audit document calls the profile access "by design". If reviewers are
  external, limit `applications`, `application_documents` (table) and
  `profiles` to assigned applications, as now done for storage and scores.

### R3. A few functions answer questions about any user id — OPEN, low

- `validate_application_submission(user, opportunity)` (callable by anonymous):
  reveals whether that user has applied, their application id, and whether
  they hold a paid membership.
- `get_opportunity_details_with_user_status(opportunity, user)`: another
  user's application status for an opportunity.
- `get_user_role(user)` (anonymous): the role of any user id.
- `is_email_allowed(email)`: allow-list membership of any address.
- All need a user UUID first, which is not public. Fix: ignore the user
  argument unless the caller is that user, admin or service role
  (`get_user_role` must stay callable — the policies use it).

### L1. Legacy application-fee checkout could reset a decided application — FIXED (uncommitted, not run)

- Where: `create-checkout-session` + `stripe-webhook` (`handleCheckoutCompleted`,
  `handlePaymentSuccess`), which set the application to `pending` once the fee
  is paid.
- `create-checkout-session` only checked ownership and "fee not already paid".
  Every application is created with `application_fee_paid = false`, so if a
  platform application fee is ever configured, a rejected applicant could pay
  it and put their application back to `pending` (and trigger reviewer
  assignment again). With no fee configured the function returns 400, so this
  is dormant today.
- Fix made: the function now requires `status = 'pending_payment'`. It also no
  longer adopts a Stripe customer by email (same issue as O3).
- The frontend no longer calls this function. If the per-application fee is
  gone for good, removing the function and those webhook branches is cleaner.

### C1. Translation has no spend control — OPEN, cost (low/medium)

- `translate-opportunity`, `translate-cms`, `translate-application` send whole
  stored fields to Google Translate for three languages on every call, with no
  size cap, no per-user rate limit and no "source unchanged" check.
- Callers are limited (admin; partner for their own opportunity; assigned
  reviewer for an application), so this is about a partner or reviewer account
  looping the call, or simply repeated clicks on long descriptions.
- Fix: skip when the source text hash matches the stored translation, cap
  field length, and add `check_and_increment_rate_limit` per user.

### D1. The deploy workflow runs a script that is not in the repository — OPEN, operational

- `.github/workflows/deploy-supabase.yml` runs `scripts/deploy-selfhosted.sh`,
  but `.gitignore` line 58 excludes that file and it is not tracked. On a
  GitHub runner the step fails with "file not found", so migrations and edge
  functions are not deployed automatically; they only go out when someone runs
  the script by hand.
- `gh` reports the workflow does not exist on GitHub yet (404), so it has
  probably never run. Either commit the script (it reads secrets from the
  environment / `scripts/.deploy.env`, so check it holds none itself) or move
  its logic into the workflow.

### D2. The deleted migration can block every future migration deploy — OPEN, operational

- The working tree deletes `20260922100000_restore_admin_delete_opportunity.sql`,
  which is already committed and probably already applied on the server.
  `supabase db push` refuses to run when the remote history contains a version
  the local folder lacks. If that deletion is committed, the security
  migrations on this branch would not deploy until it is restored or the
  history is repaired.

### D3. Smaller deploy notes — OPEN, low

- The workflow trusts the server's SSH host key on first contact
  (`ssh-keyscan`) rather than pinning it as a secret.
- Edge functions are mirrored with `rsync --delete`; the new
  `accept-partner-invite` function also needs whatever per-function routing
  the self-hosted functions container uses (the local `config.toml` entry does
  not apply there).
- The script downloads the Supabase CLI onto the server with `curl | tar`
  without a checksum.
- CI does not apply migrations to a scratch database, so a migration that
  fails to apply is only discovered at deploy time.

### Not covered even now

- Membership payment-intent path in `stripe-webhook` (lines ~220–440) was only
  skimmed: it activates from PaymentIntent metadata, which is set server-side.
- Realtime subscriptions and storage read rules for the public buckets.
- The live database and server configuration.

---

## 10. Third-pass fixes and test results — 2026-11-12

| ID | Finding | Status | Fix |
|---|---|---|---|
| R1 | Partner contact details public | FIXED, tested | `20261112160000_read_access_tightening.sql` — `partners_public` is now the only public surface (active partners, public columns); the wide policy on `partners` is dropped. `useOpportunities.ts` embeds `partners_public` instead of `partners`. |
| R2 | Reviewers read every application and profile | FIXED, tested | same migration — reviewers see only assigned applications, their documents, and those applicants' profiles |
| R3 | Functions answering about any user id | PARTLY FIXED, tested | `validate_application_submission` and `get_opportunity_details_with_user_status` are service-role only. `get_user_role` and `is_email_allowed` left callable (policies and sign-up depend on them). |
| L1 | Legacy fee checkout could reset a decided application | FIXED, boots, not exercised | `create-checkout-session` |
| C1 | Translation has no spend control | PARTLY FIXED, boots, not exercised | 60 calls per user per hour in the three translate functions. No size cap or "unchanged" skip yet. |
| D1 | Deploy workflow calls an untracked script | LEFT AS IS (owner's decision: the script is for manual deploys) | — |
| D2 | Deleted `admin_delete_opportunity` migration | RESTORED in the working tree | `git checkout` of `20260922100000_restore_admin_delete_opportunity.sql` |

**Tests on the local stack**

- Read access (19 checks, all pass): a reviewer with 8 assignments sees
  exactly 8 applications, 6 other profiles and 18 documents (of 20 / 20 / 44);
  the reviewer dashboard RPC still works; applicants see their own
  applications; admin sees everything including partner contact fields; a
  partner reads their own organisation row and their organisation's
  applications; anonymous and applicant callers get no rows from `partners`
  but do see active partners through `partners_public`.
- REST as an anonymous visitor: `partners?select=contact_phone,…` returns `[]`;
  `partners_public` returns the active partner; the opportunity list's
  `partner:partners_public(name)` embed returns the partner name.
- All earlier suites re-run: database 22 + 12 + 29 checks and edge functions
  34 + 3 checks pass. (Two old test statements needed reading: the draft-delete
  one is the known missing DELETE rule; the other selected from `partners` as
  an applicant, which now correctly returns nothing.)
- Typecheck unchanged (24 pre-existing errors).

**Deploy note for the restored migration**

When the restored `20260922…` file was applied to a database that already had
later migrations, the CLI refused until run with `--include-all`. The manual
deploy script has the same switch (`INCLUDE_ALL_MIGRATIONS=1`). Whether you
need it depends on whether the server already recorded `20260922100000`:
check `supabase_migrations.schema_migrations` before the next push.

**Behaviour changes to know about**

- Anything that read the `partners` table as a visitor or applicant now gets
  no rows; use `partners_public`. Only the opportunity list did this.
- Reviewers can no longer browse applications, profiles or library documents
  outside their assignments.
