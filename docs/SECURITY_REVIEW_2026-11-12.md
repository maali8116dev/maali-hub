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
