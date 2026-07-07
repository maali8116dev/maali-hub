# Deploying MAALI to Hostinger VPS with Coolify + self-hosted Supabase

Step-by-step runbook for `maalihub.com`. Complements `PRODUCTION_SELF_HOST_REVIEW.md`
(the *what/why*) — this doc is the *how*, in execution order.

Target topology:

```
Internet → Cloudflare (DNS + WAF)
   maalihub.com      → Coolify proxy (Traefik, auto-TLS) → nginx container (Vite dist/)
   api.maalihub.com  → Coolify proxy → Kong → Supabase services
   studio.maalihub.com (optional, basic-auth) → Supabase Studio

All containers on one Hostinger VPS managed by Coolify.
```

---

## 1. Hostinger VPS

1. Order a VPS: **KVM 4 or larger** (4 vCPU / 16 GB RAM / NVMe). The full Supabase
   stack is ~10 containers plus Coolify itself — 8 GB is the floor, 16 GB is comfortable.
   Pick the region closest to your users (EU locations work well for Africa+EU traffic).
2. OS: **Ubuntu 24.04 LTS** (clean, no panel/template).
3. In the Hostinger panel:
   - Add your SSH key; disable password SSH login afterwards (`/etc/ssh/sshd_config` →
     `PasswordAuthentication no`, `systemctl restart sshd`).
   - Firewall: allow **22, 80, 443** only. (Port 8000 is needed briefly for first
     Coolify login — open it, then close it once you've set a dashboard domain.)
   - Enable **weekly snapshots/backups** in the panel — this is your infra-level safety net,
     not a substitute for DB backups (§10).

## 2. Install Coolify

```bash
ssh root@<vps-ip>
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

- Open `http://<vps-ip>:8000`, create the admin account immediately (first visitor owns it).
- Settings → set an **instance domain** (e.g. `coolify.maalihub.com`) so the dashboard
  gets TLS via Traefik; then close port 8000 in the Hostinger firewall.
- Create a Project (e.g. `maali`) with a `production` environment.

## 3. DNS (Cloudflare recommended)

Point at the VPS IP:

| Record | Name | Value | Proxy |
|---|---|---|---|
| A | `maalihub.com` | VPS IP | Proxied ☁️ |
| A | `www` | VPS IP | Proxied ☁️ |
| A | `api` | VPS IP | **DNS-only initially** (proxy after TLS works) |
| A | `coolify` | VPS IP | DNS-only |
| A | `studio` (optional) | VPS IP | DNS-only |

Cloudflare SSL mode: **Full (strict)** once Traefik has certs. Turn on Bot Fight Mode
and the free WAF managed rules. Don't proxy `coolify.` (keeps the dashboard reachable
if Cloudflare misbehaves).

## 4. Supabase service in Coolify

Project → **+ Add Resource → Service → Supabase**. Before hitting Deploy:

1. **Domains**: set the Kong/API domain to `https://api.maalihub.com`. If you expose
   Studio, give it `https://studio.maalihub.com`.
2. **Secrets**: Coolify generates fresh `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`,
   Postgres password, dashboard credentials. Keep them — **never reuse the cloud
   project's keys**. Copy `ANON_KEY` and `SERVICE_ROLE_KEY` somewhere safe; you need
   them below.
3. **Postgres must stay private**: in the service's port settings, make sure 5432 has
   **no public port mapping**. Access it via Coolify's terminal or SSH tunnel only.
4. **Studio**: keep the basic-auth Coolify configures (strong password), or skip the
   public domain entirely and reach Studio through an SSH tunnel.
5. Deploy, wait for all containers healthy.

### 4a. GoTrue (auth) environment

In the Supabase service → Environment Variables, set/verify:

```
SITE_URL=https://maalihub.com
ADDITIONAL_REDIRECT_URLS=https://maalihub.com/auth/callback,https://www.maalihub.com/auth/callback
GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=<google client id>
GOTRUE_EXTERNAL_GOOGLE_SECRET=<google client secret>
GOTRUE_SMTP_HOST=<smtp host>          # e.g. smtp.resend.com
GOTRUE_SMTP_PORT=587
GOTRUE_SMTP_USER=<smtp user>
GOTRUE_SMTP_PASS=<smtp password>
GOTRUE_SMTP_ADMIN_EMAIL=no-reply@maalihub.com
```

- Google Cloud Console → add authorized redirect URI:
  `https://api.maalihub.com/auth/v1/callback`.
- The app uses a custom **send-email hook** (`auth-email-hook` function). To use it
  self-hosted, add:
  ```
  GOTRUE_HOOK_SEND_EMAIL_ENABLED=true
  GOTRUE_HOOK_SEND_EMAIL_URI=http://functions:9000/auth-email-hook
  ```
  (adjust host/port to the functions container's internal name). If you skip the hook,
  GoTrue falls back to plain SMTP templates — auth still works, emails are just unbranded.
- **Captcha** (P0 before launch): create a Cloudflare Turnstile site, then:
  ```
  GOTRUE_SECURITY_CAPTCHA_ENABLED=true
  GOTRUE_SECURITY_CAPTCHA_PROVIDER=turnstile
  GOTRUE_SECURITY_CAPTCHA_SECRET=<turnstile secret>
  ```
  The frontend must then send the captcha token in auth calls — this is still an open
  code task (see PRODUCTION_LAUNCH_ISSUES.md B6).

### 4b. Edge functions

The Supabase compose stack runs `edge-runtime` with a **main router** function that
dispatches `/functions/v1/<name>` to `/home/deno/functions/<name>/index.ts`.

Deploy the code by copying this repo's functions into the service's functions volume
on the VPS (find the exact path in Coolify → service → Storages, typically
`.../volumes/functions`):

```bash
rsync -a --delete supabase/functions/ root@<vps-ip>:<functions-volume-path>/ \
  --exclude Dockerfile --exclude .env --exclude .env.example --exclude _archived
docker restart <functions-container>
```

> ⚠️ The repo's `supabase/functions/Dockerfile` points `--main-service` at the functions
> root, which has no router `index.ts` — as-is it will not route per-function requests.
> Prefer the volume approach above (the Coolify/Supabase template ships the router).
> If you want an image-based deploy instead, the main service must be a router function.

**Environment variables for the functions container** (`SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` are injected by the stack — set the rest):

| Variable | Value / notes |
|---|---|
| `ALLOWED_ORIGINS` | `https://maalihub.com,https://www.maalihub.com` |
| `SITE_URL` | `https://maalihub.com` |
| `CRON_SECRET` | `openssl rand -hex 32` — workers fail closed without it |
| `INTERNAL_EMAIL_SECRET` | `openssl rand -hex 32` — function-to-function email calls |
| `RESEND_API_KEY` | live key |
| `FROM_EMAIL` | e.g. `MAALI <no-reply@maalihub.com>` |
| `SUPPORT_EMAIL` / `CONTACT_NOTIFICATION_EMAIL` | where contact-form mail goes |
| `STRIPE_SECRET_KEY` | **live** `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | from §8 after registering the endpoint |
| `STRIPE_MEMBER_PRICE_ID` | live-mode price id (re-create products in live mode) |
| `PAYSTACK_SECRET_KEY` | live `sk_live_...` |
| `PAYSTACK_PUBLIC_KEY` | live `pk_live_...` |
| `GOOGLE_CLOUD_TRANSLATE_API_KEY` | translations (opportunity/CMS/application) |
| `ABSTRACT_API_KEY` | email validation on signup |
| `EMAIL_LOGO_URL` (optional) | absolute URL to email logo |

## 5. Data migration from Supabase Cloud

Dry-run this whole section once before the real cutover.

1. **Database** (schema + data + auth users):
   ```bash
   supabase db dump --linked -f roles.sql --role-only
   supabase db dump --linked -f schema.sql
   supabase db dump --linked -f data.sql --use-copy --data-only
   ```
   Copy the files to the VPS and restore into the stack's Postgres (Coolify →
   Supabase → database container → terminal, or SSH tunnel):
   ```bash
   psql -U postgres -d postgres -f roles.sql
   psql -U postgres -d postgres -f schema.sql
   psql -U postgres -d postgres -f data.sql
   ```
2. **Storage objects**: download each bucket from the cloud (Studio, or a script using
   the cloud service key) and re-upload via the self-hosted API with the new service
   key. Verify `application-docs` stays **private** and a signed URL works while a
   direct public URL is denied.
3. **Verify**: row counts on key tables (`profiles`, `applications`, `opportunities`,
   `memberships`), sequences not reset, and RLS intact:
   ```sql
   select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='r' and c.relrowsecurity = false;
   -- should return no PII-bearing tables
   ```
4. **Migrations & cron**: apply any repo migrations not in the dump, then create the
   Vault secrets and re-run the two cron DO blocks:
   ```sql
   select vault.create_secret('https://api.maalihub.com', 'project_url');
   select vault.create_secret('<CRON_SECRET value>', 'cron_secret');
   -- re-run DO blocks from:
   --   supabase/migrations/20260704160000_partner_webhook_cron.sql
   --   supabase/migrations/20260707130000_email_queue_cron.sql
   select jobname, schedule, active from cron.job;  -- expect both jobs
   ```
   The `20260707120000_set_site_url.sql` migration sets `app.settings.site_url`
   (used by DB-generated notification links) — included when you apply migrations.

## 6. Frontend app in Coolify

1. Project → **+ Add Resource → Application → Git repository** (`maali8116dev/maali-hub`,
   branch `develop` or `main`), **Build Pack: Dockerfile** (repo root `Dockerfile`).
2. Domain: `https://maalihub.com` (add `https://www.maalihub.com` too, or a Traefik
   redirect rule www → apex).
3. Environment variables — check **Build Variable** on every one (they're baked in at
   build time; the build fails loudly if the Supabase ones are missing):
   ```
   VITE_SUPABASE_URL=https://api.maalihub.com
   VITE_SUPABASE_ANON_KEY=<anon key from §4>
   VITE_SITE_URL=https://maalihub.com
   VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
   VITE_PAYSTACK_PUBLIC_KEY=pk_live_...
   VITE_PUBLIC_POSTHOG_KEY=<optional>
   VITE_PUBLIC_POSTHOG_HOST=<optional>
   VITE_SENTRY_DSN=<optional>
   ```
4. Deploy. Optionally enable auto-deploy on push (add the CI gate from
   PRODUCTION_LAUNCH_ISSUES.md D12 before trusting this).
5. `nginx.conf` ships CSP as **`Content-Security-Policy-Report-Only`**. After the
   smoke test, watch the browser console for CSP violation reports, fix the policy,
   then rename the header to `Content-Security-Policy` and redeploy.

## 7. Email deliverability (before real users)

In your DNS (Resend dashboard gives exact values):

- **SPF**: `TXT` on sending domain including Resend's include.
- **DKIM**: the CNAME/TXT records Resend provides.
- **DMARC**: `TXT _dmarc` → `v=DMARC1; p=quarantine; rua=mailto:dmarc@maalihub.com`.

Test with mail-tester.com (target ≥ 9/10) using both a GoTrue magic link and an app
email (e.g. contact form) — they take different paths (SMTP vs Resend API).

## 8. Payment webhooks (live mode)

- **Stripe** dashboard (live mode) → Webhooks → add endpoint
  `https://api.maalihub.com/functions/v1/stripe-webhook`, subscribe to the events the
  handler processes (checkout/session, invoice, customer.subscription events). Copy the
  signing secret into `STRIPE_WEBHOOK_SECRET` and restart the functions container.
- **Paystack** dashboard → Settings → Webhooks →
  `https://api.maalihub.com/functions/v1/paystack-webhook`.
- Send a test event from each dashboard and confirm 200s in the functions logs.

## 9. Post-deploy smoke test

1. `curl -I https://maalihub.com` → 200, security headers present, `index.html`
   `Cache-Control: no-cache`; an `/assets/*.js` URL → `immutable`.
2. Deep link (e.g. `https://maalihub.com/opportunities`) loads directly (SPA fallback).
3. Sign up → magic link arrives in inbox (not spam) → login works.
4. Google OAuth login round-trips.
5. Apply to an opportunity with a document upload; reviewer sees it via signed URL.
6. Live payment (smallest plan) on Stripe **and** Paystack → webhook fires →
   membership activates; receipt email arrives.
7. `select * from cron.job;` shows both workers; `email_queue` rows move to `sent`.
8. From a machine outside the VPS: `psql -h api.maalihub.com -p 5432` **fails**
   (connection refused/timeout), Studio prompts for auth.

## 10. Backups (do this in week one, not "later")

- Coolify → Supabase service → database → **Scheduled Backups**: daily, retain 7+,
  push to S3-compatible storage (Cloudflare R2 / Backblaze B2 — not the same VPS).
- Storage volume: nightly `rsync`/`restic` of the storage volume to the same offsite bucket.
- **Test a restore** into a scratch Postgres once. An untested backup is a hope, not a backup.

## Still open after this runbook (from PRODUCTION_LAUNCH_ISSUES.md)

- **B6**: Turnstile captcha wiring in the frontend (auth + contact + application forms).
- **D12**: CI workflow (lint/test/build) gating deploys.
- **C2**: prerender static marketing routes; Helmet on opportunity detail.
- **D5**: Privacy Policy + ToS content live at `/privacy`, `/terms`.
- **D10**: uptime monitoring (e.g. UptimeRobot/Betterstack on `/` and
  `https://api.maalihub.com/auth/v1/health`) + log retention.
