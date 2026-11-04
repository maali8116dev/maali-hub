# B4 — RLS + `verify_jwt` Audit

Audit date: **2026-07-17** · Source: repo migrations (`supabase/migrations/`) and
function code (`supabase/functions/`), i.e. the *intended* state. **Follow-up
required:** run the §4 SQL against the live self-hosted DB to confirm the deployed
state matches (drift is possible if anything was ever changed via Studio).

## 1. RLS coverage

All **43** tables in `public` have `ENABLE ROW LEVEL SECURITY` in migrations; no
migration disables it anywhere.

### Public-read by design (CMS/catalog content, no PII)

| Table | Read policy |
|---|---|
| `opportunities`, `opportunity_tags`, `opportunity_tag_map`, `opportunity_documents` | `USING (true)` |
| `partners` | only `status = 'active'` rows (or admin) |
| `sectors` | only `is_active = true` rows |
| `blog_posts`, `faqs`, `mentors`, `resources`, `success_stories` | public read, admin-only write |
| `rubric_versions`, `system_rubric` | `USING (true)` — ⚠️ scoring rubric is world-readable; applicants can see exactly how they're scored. Accepted? If not, restrict to `authenticated` + reviewer/admin. |
| `platform_settings`, `rate_limit_config` | `SELECT` to `anon, authenticated`; writes blocked. No sensitive values seeded in migrations — keep it that way (no secrets in these tables, ever). |

### PII-bearing tables — own-row / role-gated (verified)

| Table | SELECT gated by |
|---|---|
| `profiles` | own row · admin · reviewer (reviewers see all applicant profiles — by design) |
| `applications` | own row · admin/reviewer · partner (own opportunities only) |
| `application_documents` | own row · admin · reviewer (assigned) · partner (own opportunities) |
| `transactions`, `billing_addresses`, `payment_methods`, `notifications`, `activity_logs`, `memberships`, `kyc_verifications` | own row (+ admin where applicable) |
| `contact_submissions` | own row · admin (INSERT forced through edge function since `20260707140000`) |
| `newsletter_subscribers` | admin only (anyone may INSERT) |

### Deny-all (no policies → service-role only)

`email_queue`, `site_password`, `allowed_emails`, `stripe_events`,
`paystack_events`, `application_assignments`*, `review_scores`*,
`reviewer_conflicts`/`reviewer_sectors` (admin-managed), and `rate_limits`
(explicit `USING (false)`), `partner_api_*` tables, `partner_webhooks`,
`partner_webhook_outbox`.

\* have role-gated policies for admin/reviewer flows; no anon access.

**Verdict: no table is anon-readable with PII.** ✅

## 2. `verify_jwt = false` functions — caller auth mechanism

26 functions disable gateway JWT verification (needed because the self-hosted
relay strips `Authorization`; see `_shared/auth.ts`). Each must self-auth:

| Function | Auth mechanism |
|---|---|
| `cancel-membership`, `resume-membership`, `create-checkout-session`, `create-membership-payment`, `create-paystack-membership-payment`, `generate-invoice`, `verify-paystack-payment`, `translate-application`, `translate-cms`, `translate-opportunity` | Supabase session JWT via `authenticateRequest()` (header or body token → `auth.getUser`) |
| `update-application-status` | session JWT **+ admin role check** (`get_user_role = 'admin'`) |
| `manage-user` | session JWT **+ admin role check** |
| `invite-partner` | session JWT **+ platform-admin or partner-org-admin check** |
| `manage-partner-api` | session JWT (partner/admin handled in `partnerApiHandlers`) |
| `partner-api` | Partner API key (`authenticatePartnerApiKey`, hashed key + rate limit) |
| `stripe-webhook` | Stripe signature (`constructEventAsync`) |
| `paystack-webhook` | `x-paystack-signature` HMAC |
| `process-email-queue`, `process-partner-webhooks` | `CRON_SECRET` (fail-closed) |
| `send-email` | `INTERNAL_EMAIL_SECRET` (internal calls) or session JWT; receipt-class emails internal-only |
| `rate-limited-auth` | Turnstile captcha + IP/email rate limiting (fail-closed in prod) |
| `submit-application` | session JWT + Turnstile |
| `submit-contact` | Turnstile (+ optional session JWT) |
| `create-portal-session` | *not* in `config.toml` → gateway verifies JWT (default) |

## 3. Findings

### 🔴 F1 (P0): `auth-email-hook` accepts unauthenticated requests — ✅ FIXED 2026-07-17
**Fixed:** the function now verifies the standardwebhooks signature against
`SEND_EMAIL_HOOK_SECRET` (same value as GoTrue's `GOTRUE_HOOK_SEND_EMAIL_SECRETS`);
401 on bad signature, 503 if the secret is unset in prod, unsigned allowed only
against a localhost Supabase. Deploy requires setting both env vars — see
`SECRETS_CHECKLIST.md` §2/§3. Original finding below.


`supabase/functions/auth-email-hook/index.ts` performs **no signature or secret
verification**. With `verify_jwt = false`, anyone who can reach
`/functions/v1/auth-email-hook` can POST a forged GoTrue payload and make the
platform send **arbitrary branded emails (with links) to arbitrary addresses**
via Resend — a phishing vector and a Resend-reputation/quota burn.
**Fix:** GoTrue signs send-email hook payloads (standardwebhooks,
`v1,whsec_...` in `GOTRUE_HOOK_SEND_EMAIL_SECRETS`). Verify that signature at
the top of the function and reject non-matching requests. Defense-in-depth:
also block the route publicly at Kong/Cloudflare since only GoTrue (internal
network) ever calls it legitimately.

### 🟠 F2 (P1): `validate-email` is unauthenticated with no rate limit
Open proxy to Abstract API (paid, keyed). Anyone can burn the quota / run up
cost and use it for email enumeration. **Fix:** rate limit per IP (reuse the
`rate_limits` pattern) and/or require a Turnstile token; it is only called from
the signup flow, which already has one.

### 🟡 F3 (P2): scoring rubric world-readable
`rubric_versions` / `system_rubric` are `USING (true)`. If rubric secrecy
matters, restrict to `authenticated` reviewers/admins; otherwise record as
accepted.

### 🟡 F4 (follow-up): audit is repo-side only
Run §4 against the **live** DB to confirm no drift (Studio-made changes,
missed migrations).

## 4. Live-DB verification queries

```sql
-- 1. Tables without RLS (expect: none in public)
select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

-- 2. Anon-visible SELECT policies (review each row: catalog/CMS only)
select tablename, policyname, qual from pg_policies
where schemaname = 'public' and cmd in ('SELECT','ALL')
  and (roles = '{public}' or 'anon' = any(roles));

-- 3. Direct table grants to anon/authenticated (PostgREST layer)
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon','authenticated')
order by table_name;
```
