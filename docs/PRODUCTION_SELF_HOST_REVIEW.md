# Production Self-Host Readiness Review

Scope: moving MAALI (Vite + React SPA, Supabase backend, Stripe/Paystack, PostHog, Sentry, i18n en/fr/de/pt) from Lovable hosting to self-hosted production.

Legend: **P0** = block launch · **P1** = do soon after · **P2** = nice to have.

---

## 0. Architecture reality check

- App is a **client-rendered SPA** (Vite, no SSR/prerender). This drives most SEO items below — HTML shipped to crawlers is the static `index.html` shell; all page content is JS-rendered.
- Backend is **Supabase** (Postgres + RLS + Edge Functions). "Self-hosted" can mean: (a) self-host frontend only, keep Supabase Cloud, or (b) self-host Supabase too. Decide this first — it changes the security surface a lot.

**Decision: self-host frontend + Supabase on Docker Compose** (no Kubernetes). You own Postgres, GoTrue, Storage, Kong, Edge Functions, etc. Section 6 covers ops depth.

**Decision: single VPS** — static frontend (`dist/`) and Supabase Compose stack on the **same machine**. No Vercel. Cloudflare in front recommended. See **§12**.

**Decision: SEO = prerender static marketing pages at build; opportunity detail pages stay SPA** (Helmet for Google; no rebuild per new opportunity). Social share cards for `/opportunities/:id` stay generic until an optional dynamic OG endpoint (see issue C2b).

---

## 1. SEO

### P0
- [ ] **Replace all `lovable.app` URLs** with the real production domain:
  - `index.html` → `og:url`, `og:image`, `twitter:image`, `<link rel="canonical">`
  - `public/robots.txt` → `Sitemap:` line
  - `public/sitemap.xml` → every `<loc>` (all hardcoded to `maali-opportunity-hub.lovable.app`)
- [ ] **Prerender static marketing routes at build** (`vite-plugin-prerender`): `/`, `/about`, `/contact`, `/faq`, `/resources`, `/partners`, `/success-stories`, `/blog`, `/mentors`, `/opportunities` (list only). Rebuild on deploy, not per opportunity.
- [ ] **`react-helmet-async` on dynamic routes** — `/opportunities/:id` (and blog slugs if not prerendered). Google indexes via JS; no build per new listing.
- [ ] **Accepted tradeoff:** WhatsApp/LinkedIn/X unfurls for opportunity links show **default OG** until optional crawler OG endpoint (issue C2b).

### P1
- [ ] **Auto-generate `sitemap.xml`** via scheduled job (not build) — include opportunity URLs for Google without prerendering them.
- [ ] **`hreflang` tags** for en/fr/de/pt — you have i18n but no language alternates, so Google may index only one language.
- [ ] **Structured data (JSON-LD)**: `Organization`, `JobPosting`/`Grant`-style schema for opportunities, `Article` for blog. Big win for funding/opportunity search.
- [ ] Confirm `robots.txt` disallows match real routes. It blocks `/dashboard/`, `/admin/`, `/auth/`, `/api/` — verify these are the actual paths (app uses `/partner`, `/admin`, `/auth`).

### P2
- [ ] Canonical tags per route (needs meta solution above).
- [ ] 404 route returns proper status for crawlers (SPA usually returns 200 for everything — configure host to serve 404 correctly where possible).

---

## 2. Security

### P0
- [ ] **Rotate every secret before/after migration.** Anything that touched Lovable or was in chat/terminals: Supabase service role key, anon key (if regenerated), Stripe keys, Paystack keys, `CRON_SECRET`, any partner API keys created during testing (see Partner API review — a live key was used in terminal).
- [ ] **Security headers** — none currently set (no CSP, no HSTS, no `X-Frame-Options`). SPA has no server, so set these at the web server / CDN (nginx, Caddy, Cloudflare, Vercel `headers`). Minimum:
  - `Content-Security-Policy` (allow self + Supabase, Stripe, Paystack, PostHog, Sentry, gpteng CDN font)
  - `Strict-Transport-Security`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY` (or CSP `frame-ancestors`)
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` (lock down camera/mic/geolocation)
- [ ] **CORS on Edge Functions** — several partner functions and others use `Access-Control-Allow-Origin: *`. Set `ALLOWED_ORIGINS` to the production domain(s) for anything browser-facing.
- [ ] **Verify Supabase RLS on every table** before go-live. Confirm no table is exposed via anon key without a policy. Run a check of `SELECT` grants for `anon`/`authenticated`.
- [ ] **Edge function `verify_jwt`** — audit `config.toml`; every `verify_jwt = false` function must do its own auth (webhooks verify signatures, cron functions require `CRON_SECRET`, etc.). Partner webhook worker now requires `CRON_SECRET` in prod — set it.

### P1
- [ ] **500 responses leak `error.message`** in partner API (and check others) — map DB errors to generic messages in production.
- [ ] **Webhook signing secret stored plaintext** (`partner_webhooks.signing_secret`) for outbound HMAC. Accept as tradeoff or encrypt at rest / derive from a master key in Vault.
- [ ] **Dependency audit**: run `npm audit`; pin/patch. `react-quill@2.0.0` is unmaintained (XSS surface in rich text) — you already use `dompurify`, ensure all rich-text render paths sanitize.
- [ ] **Sentry / PostHog**: scrub PII, set correct environment, don't ship dev DSNs. Confirm session replay (if on) masks inputs.
- [ ] Serve everything over HTTPS; redirect http→https at the edge.
- [ ] If self-hosting Supabase: secure Postgres (no public port), rotate JWT secret, lock Studio behind auth/VPN, back up storage + DB.

### P2
- [ ] Add `.well-known/security.txt`.
- [ ] Subresource Integrity for any third-party `<script>`/font from `cdn.gpteng.co` (or self-host the font to drop that origin entirely).

---

## 3. Bot prevention & abuse

Currently: **no captcha/turnstile anywhere**; DB-level rate limiting exists (`rate-limited-auth`, partner API rate limits).

### P0
- [ ] **Captcha on public write/auth surfaces**: signup, login, password reset, contact form, application submission. Recommend **Cloudflare Turnstile** (free, privacy-friendly) or hCaptcha. Verify token server-side in the relevant Edge Function.
- [ ] **Enable Supabase Auth captcha** (Turnstile/hCaptcha) in the Auth settings — protects the built-in auth endpoints directly.

### P1
- [ ] **Rate limit public Edge Functions** the same way as auth (contact, application submit, translate-* functions if reachable). Confirm existing rate limits are keyed correctly and fail closed.
- [ ] **Honeypot field** on contact/marketing forms (cheap, catches dumb bots).
- [ ] Put the app behind **Cloudflare** (or similar) for WAF, bot fight mode, DDoS protection, and edge caching of static assets.
- [ ] **Email sending abuse**: throttle transactional email (invites, magic links) per IP/user to prevent someone weaponizing your Resend/SMTP.

### P2
- [ ] Monitor `partner_api_audit_log` and auth logs for anomalies; alert on spikes.
- [ ] Consider disposable-email blocking on signup.

---

## 4. Infra / deploy

### P0
- [ ] **Env var management** — move all keys to the host's secret store; nothing in the repo. Confirm `.env*` are gitignored (they are).
- [ ] **SPA host config**: fallback all routes to `index.html` (history API), with correct cache headers: long cache for hashed assets, `no-cache` for `index.html`.
- [ ] **Set up cron** for scheduled workers now that you leave Lovable: `process-email-queue`, `process-partner-webhooks` (pg_cron migration `20260704160000` + vault `project_url`/`cron_secret`).
- [ ] **Custom domain + TLS cert** (auto-renew via Caddy/Cloudflare/Let's Encrypt).

### P1
- [ ] **Backups**: automated Postgres backups + storage backups; test a restore.
- [ ] **CI/CD**: build, lint, `npm run test`, e2e (Playwright already set up) gate on deploy.
- [ ] **Staging environment** separate from prod (separate Supabase project/keys).
- [ ] **Uptime + error monitoring/alerts** (Sentry alerts, uptime ping).
- [ ] Remove Lovable-only bits: `lovable-tagger` (dev-only, fine), `cdn.gpteng.co` font preconnect/preload if not needed.

### P2
- [ ] Load test the opportunity list + application submit paths.
- [ ] Document runbook (deploy, rollback, rotate secrets, restore backup).

---

## 5. Performance (affects SEO ranking)

### P1
- [ ] Confirm code-splitting is effective (manual chunks already configured). Check bundle size after removing unused vendors.
- [ ] Image optimization: serve `webp`/`avif`, responsive sizes, lazy-load below-the-fold (hero already preloaded).
- [ ] Enable Brotli/gzip at the edge.
- [ ] Lighthouse pass on `/` and `/opportunities` — target CWV green (LCP, CLS, INP).

---

## 6. Self-hosted Supabase (frontend + backend)

You are replacing Supabase Cloud's managed guarantees. Everything below was previously done for you.

### P0
- [ ] **Generate fresh secrets** — do NOT reuse cloud values. Regenerate: `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY` (signed from the JWT secret), Postgres password, dashboard `SITE_URL`/`API_EXTERNAL_URL`, `SECRET_KEY_BASE`, Vault encryption key. Rotate all downstream `.env` accordingly.
- [ ] **Docker Compose stack** — official Supabase Compose on VM(s); pin versions; named volumes; `restart: unless-stopped`; TLS in front of Kong. No k8s required.
- [ ] **Lock down Studio** — the Supabase Studio dashboard must NOT be public. Put behind VPN, IP allowlist, or basic-auth on Kong. Set a strong `DASHBOARD_USERNAME`/`DASHBOARD_PASSWORD`.
- [ ] **Postgres not internet-exposed** — bind to private network only; no public `5432`. Access via Kong/PgBouncer only.
- [ ] **Kong (API gateway) config** — confirm anon vs service_role routing; service_role key must never be reachable from the browser. Terminate TLS in front of Kong.
- [ ] **Enable required extensions**: `pg_cron`, `pg_net` (webhook/email cron), `pgsodium`/Vault (secrets), `pgjwt`. Confirm they exist on your image — some are missing from bare Postgres.
- [ ] **Storage backend** — decide local disk vs S3-compatible (recommended: S3/MinIO). Application-docs bucket holds applicant PII → private bucket, signed URLs only (already the pattern). Verify bucket policies after migration.
- [ ] **Auth (GoTrue) config** — set `SITE_URL` + `additional_redirect_urls` to prod domain, SMTP for auth emails, OAuth (Google) client IDs/secrets, and **enable captcha** (Turnstile/hCaptcha) here.
- [ ] **Data migration plan** — export cloud DB (`supabase db dump` / `pg_dump`) + storage objects, import to self-hosted, verify row counts, sequences, and RLS policies survived. Dry-run first.

### P1
- [ ] **PgBouncer / connection pooling** — Edge Functions + app can exhaust Postgres connections; run the pooler.
- [ ] **Automated backups + PITR** — cloud gave you this. Set up `pg_dump` cron + WAL archiving (or `wal-g`/`pgBackRest`) to offsite storage. **Test restore.**
- [ ] **Realtime** — only run the Realtime container if you use it; otherwise disable to shrink surface.
- [ ] **Edge Functions runtime** — self-hosted uses the `edge-runtime` container. Confirm all functions deploy, secrets inject, and cold-start/timeout behavior is acceptable. Set per-function secrets (`CRON_SECRET`, Stripe, Paystack, translate keys, Resend).
- [ ] **Upgrade path** — you now own version bumps. Pin image versions; plan a tested upgrade cadence for GoTrue/PostgREST/Realtime/Studio.
- [ ] **Resource sizing + limits** — CPU/mem for Postgres, container restart policies, disk growth alerts (Postgres + storage).

### P2
- [ ] Read replica if read-heavy.
- [ ] Separate the analytics/logging DB from the app DB.

---

## 7. Payments (Stripe + Paystack)

### P0
- [ ] Swap all keys to **live/production** mode; rotate test keys out.
- [ ] **Re-register webhook endpoints** at the new domain for both Stripe and Paystack; update signing secrets. Verify signature checks in `stripe-webhook` / `paystack-webhook` functions.
- [ ] Confirm webhook functions are reachable through Kong without JWT (they self-verify signatures).

### P1
- [ ] Idempotency on payment webhooks (avoid double-processing on retries).
- [ ] Reconciliation: verify membership/payment state matches provider dashboard.
- [ ] PCI: you use hosted Stripe/Paystack elements — keep card data off your servers (don't log it).

---

## 8. Email deliverability

### P0
- [ ] Configure **SPF, DKIM, DMARC** for the sending domain (Resend/SMTP). Without these, magic links, invites, and notifications land in spam or bounce.
- [ ] Set up SMTP creds in both GoTrue (auth emails) and the `send-email`/`process-email-queue` functions.

### P1
- [ ] Warm up the sending domain; monitor bounce/complaint rates.
- [ ] Throttle transactional email per user/IP (abuse + reputation).
- [ ] Set `From`/reply-to and unsubscribe where applicable.

---

## 9. Legal / compliance / privacy

You collect applicant PII (name, email, phone, documents, country) and process payments across African + EU users.

### P0
- [ ] **Privacy Policy + Terms of Service** live and linked (esp. before collecting PII/payments).
- [ ] **Cookie/consent banner** — PostHog analytics + any marketing cookies need consent (GDPR / similar). Gate analytics init on consent.
- [ ] Confirm data residency expectations for where you host Postgres + storage.

### P1
- [ ] **Data subject rights**: export + delete-my-data flow for users (GDPR). Ensure hard-delete cascades PII across tables + storage.
- [ ] Data retention policy for applications/documents.
- [ ] DPA with any subprocessors (Resend, Stripe, Paystack, PostHog, Sentry, hosting).
- [ ] Audit what PostHog/Sentry capture — mask PII, disable session replay input capture.

---

## 10. Accessibility & i18n polish

### P1
- [ ] a11y pass: keyboard nav, focus states, form labels, color contrast, `aria-*` on custom components. Radix helps but verify.
- [ ] `lang` attribute updates with active i18n language (currently static `lang="en"` in `index.html`).
- [ ] Locale parity — you have `i18n:check-locale`; run it in CI so fr/de/pt don't drift (partner API strings were only partially translated recently).

---

## 11. Observability & operations

### P0
- [ ] Centralized logs for Postgres, Kong, GoTrue, Edge Functions (you lose the cloud log viewer). Ship to Loki/ELK/hosted logging.
- [ ] Uptime monitoring + on-call alert for: app, Kong, Postgres, auth, payment webhooks.

### P1
- [ ] Sentry environment = production, correct release/sourcemaps, PII scrubbed.
- [ ] Dashboards for DB connections, disk, error rates, webhook queue depth (`partner_webhook_outbox`, `email_queue`), rate-limit hits.
- [ ] **Runbook**: deploy, rollback, rotate secrets, restore backup, scale Postgres, respond to incident.
- [ ] Disaster recovery drill: restore DB + storage into a clean environment and boot the app end-to-end.

---

## Quick launch checklist (P0 only)

- [ ] Real domain in `index.html`, `robots.txt`, `sitemap.xml`
- [ ] Prerender static marketing pages; Helmet on opportunity detail
- [ ] Rotate ALL secrets
- [ ] Security headers at edge (CSP, HSTS, etc.)
- [ ] Lock CORS `ALLOWED_ORIGINS`
- [ ] Verify RLS on all tables + `verify_jwt`/self-auth on every function
- [ ] Captcha (Turnstile) on auth + public forms; enable Supabase Auth captcha
- [ ] Cron for email + webhook workers; set `CRON_SECRET`
- [ ] SPA route fallback + cache headers + TLS
- [ ] Self-host Supabase: Docker Compose, fresh JWT/anon/service keys, Studio locked, Postgres private, Kong TLS, required extensions enabled
- [ ] Data migration (DB + storage) dry-run + verify RLS survived
- [ ] Payments: live keys + re-registered webhooks (Stripe + Paystack)
- [ ] Email: SPF/DKIM/DMARC on sending domain
- [ ] Privacy Policy + ToS + cookie consent live
- [ ] Backups configured + restore tested; centralized logs + uptime alerts

---

## 12. Single VPS deployment (no Vercel)

Frontend and Supabase run on **one VPS**. Docker Compose for backend; Caddy/nginx serves the Vite build from the same host.

### Topology

```
Internet → Cloudflare (recommended) → Caddy/nginx (TLS)
              ├── app.yourdomain.com  → static Vite build (dist/)
              └── api.yourdomain.com  → Kong (Supabase gateway)

Docker Compose on same VPS:
  Postgres, GoTrue, PostgREST, Storage, Realtime, edge-runtime, Studio (locked)
```

### P0 — ship blockers

**Infra**
- [ ] Docker Compose Supabase; pinned images; named volumes; `restart: unless-stopped`
- [ ] Fresh secrets (JWT, anon, service_role, Postgres, `CRON_SECRET`) — never reuse cloud keys
- [ ] Postgres not on public `5432`; Studio not public (VPN / IP allowlist / basic-auth)
- [ ] TLS on app + API domains; http→https redirect
- [ ] SPA fallback: all app routes → `index.html`; `index.html` no-cache; hashed assets long-cache
- [ ] Migrate DB + storage; verify RLS survived; **test restore from backup**
- [ ] Cron: `process-email-queue` + `process-partner-webhooks` + vault secrets
- [ ] Deploy all Edge Functions; inject secrets (Stripe, Paystack, SMTP, translate, etc.)

**Security**
- [ ] CSP + HSTS + `X-Frame-Options` + `X-Content-Type-Options: nosniff` + `Referrer-Policy` (Caddy/nginx)
- [ ] Cloudflare in front (WAF, bot fight, DDoS) — strongly recommended on a single VPS
- [ ] Turnstile/hCaptcha on auth + contact + application submit; enable GoTrue captcha
- [ ] Rate limits on public functions; partner API `CRON_SECRET` set
- [ ] RLS audit on every table; audit every `verify_jwt=false` function
- [ ] Rotate all third-party keys; revoke test partner API keys
- [ ] Lock CORS `ALLOWED_ORIGINS` to prod domain

**SEO**
- [ ] Replace all `lovable.app` URLs (`index.html`, `robots.txt`, `sitemap.xml`)
- [ ] Prerender at deploy: `/`, `/about`, `/contact`, `/faq`, `/resources`, `/partners`, `/success-stories`, `/blog`, `/mentors`, `/opportunities` (list only)
- [ ] `react-helmet-async` on `/opportunities/:id` — no prerender per opportunity
- [ ] Accept default OG on shared opportunity links (or C2b crawler OG endpoint later)

**Payments & email**
- [ ] Live Stripe + Paystack keys; webhooks re-registered to new domain
- [ ] SPF + DKIM + DMARC on sending domain; SMTP in GoTrue + email functions
- [ ] Test magic link + invite + payment webhook end-to-end

**Legal & ops**
- [ ] Privacy Policy + ToS live; cookie consent gates PostHog
- [ ] Centralized logs (Caddy + Compose containers → file or Loki)
- [ ] Uptime monitor on app + API + auth; alert on failure

### P1 — first week after launch

- [ ] PgBouncer (connection pooling)
- [ ] Scheduled sitemap job (opportunity URLs; no frontend rebuild)
- [ ] `hreflang` + JSON-LD on prerendered pages; Helmet JSON-LD on opportunity detail
- [ ] Sentry prod env + PII scrub; PostHog consent-gated
- [ ] Incident runbook: deploy, rollback, rotate secrets, restore DB
- [ ] Self-host fonts (drop `cdn.gpteng.co`); webp images + lazy load
- [ ] `npm audit`; sanitize 500 bodies in Edge Functions
- [ ] Staging VPS or second Compose stack for migration testing
- [ ] **CI/CD** — see **§13** (lint/test/build gate + SSH deploy to VPS)

### P2 — when you have time

- [ ] Dynamic OG endpoint for opportunity social shares (issue C2b)
- [ ] GDPR export/delete flows
- [ ] Distributed tracing
- [ ] Load test on staging
- [ ] Encrypt webhook signing secrets at rest

### VPS sizing (starting point)

| Load | Rough spec |
|------|------------|
| Early prod | 4 vCPU, 8–16 GB RAM, 80+ GB SSD |
| Growth | Split app/static to CDN or move Postgres to dedicated VM |

Same box runs Postgres + all Supabase services + static frontend — don't undersize RAM. Pick region close to users (Africa/EU).

### Pre-launch smoke test

1. Sign up with captcha → magic link in inbox (not spam)
2. Apply to opportunity → doc upload works
3. Partner creates opportunity → appears in list (no rebuild)
4. Stripe/Paystack payment → webhook updates membership
5. `curl -I https://app.domain` → security headers present
6. Restore backup to staging → app boots

### Not needed (Vercel / platform-specific)

Vercel hosting, k8s, ISR, Turborepo cache, Vercel WAF/Speed Insights/Fluid compute, Vercel function region tuning. Your compute region = **VPS location**.

Detailed ticket-level items: `PRODUCTION_LAUNCH_ISSUES.md`.

---

## 13. CI/CD (single VPS)

Today: only `.github/workflows/i18n.yml` (locale parity on PR). Production needs **CI** (quality gate) + **CD** (deploy to VPS).

### Split the pipelines

| Stage | Runs on | Purpose |
|-------|---------|---------|
| **CI** | GitHub Actions (ubuntu) | Block bad merges — no server access needed |
| **CD** | GitHub Actions → SSH to VPS | Ship artifacts after CI passes |

Do **not** put prod DB passwords or `SERVICE_ROLE_KEY` in the frontend build job unless required. Build uses `VITE_*` public vars only.

### CI — run on every PR + push to `main`

```yaml
# .github/workflows/ci.yml (to add)
jobs:
  quality:
    steps:
      - npm ci
      - npm run lint
      - npm run test          # vitest
      - npm run validate:i18n # already exists separately; merge or keep both
      - npm run build         # VITE_SUPABASE_URL etc. from GitHub env/secrets
```

Optional (P1): Playwright e2e against **staging** URL — not prod. Use `continue-on-error: false` only when staging is stable.

**Gate:** failing CI = no deploy.

### CD — deploy to VPS (after CI on `main` or on tag `v*`)

**Frontend (every app release):**
1. `npm run build` → `dist/` (includes prerender step when C2 is implemented)
2. Rsync/scp `dist/` → VPS e.g. `/var/www/maali/dist/`
3. No restart needed if nginx/Caddy serves static files (optional `nginx -s reload`)

**Database migrations (when `supabase/migrations/` changes):**
1. SSH to VPS
2. Run migrations against Compose Postgres — e.g. `supabase db push` pointed at self-hosted DB, or `psql` / migration runner container
3. **Always run on staging first.** Take backup before prod migration.

**Edge Functions (when `supabase/functions/` changes):**
1. Deploy to self-hosted edge-runtime — copy bundles + restart function container, or use your Compose deploy script
2. Confirm secrets already on VPS (not injected from CI unless using a secrets manager)

**Compose image bumps (infrequent):**
1. Pin new image tags in `docker-compose.yml`
2. `docker compose pull && docker compose up -d`
3. Watch healthchecks; rollback = previous tag + `up -d`

### Recommended GitHub secrets

| Secret | Used for |
|--------|----------|
| `VPS_SSH_KEY` | Private key for deploy user |
| `VPS_HOST` | IP or hostname |
| `VPS_USER` | e.g. `deploy` (non-root) |
| `VITE_SUPABASE_URL` | Build-time (public) |
| `VITE_SUPABASE_ANON_KEY` | Build-time (public) |
| `STAGING_URL` | E2e target (optional) |

Keep `SERVICE_ROLE_KEY`, Stripe secrets, `CRON_SECRET` **on the VPS only** (Compose env / `.env` not in git).

### Staging

- **Best:** second small VPS or separate Compose project on same box (`staging.api.domain`, `staging.app.domain`).
- Staging gets its own JWT/keys and a sanitized DB copy (or seed).
- CD workflow: `main` → staging auto; **prod manual approval** or tag-only (`v1.2.3`).

### Rollback

| What broke | Rollback |
|------------|----------|
| Frontend | Redeploy previous `dist/` artifact (keep last N builds in GitHub Actions artifacts or on VPS) |
| Edge Function | Redeploy previous function bundle from git tag |
| Migration | Restore DB from pre-migration backup — **migrations are not auto-reversible** |
| Compose | `docker compose up -d` with previous image digests |

### Minimal deploy script (on VPS or invoked via SSH)

```bash
#!/bin/bash
set -euo pipefail
APP_DIR=/var/www/maali
COMPOSE_DIR=/opt/supabase

# frontend — CI rsyncs dist/ here first, or pull artifact
# rsync -a dist/ "$APP_DIR/dist/"

# migrations — only if needed
# cd "$COMPOSE_DIR" && supabase db push ...

# functions — only if needed
# ./scripts/deploy-functions.sh

# compose — only on infra change
# cd "$COMPOSE_DIR" && docker compose up -d
```

### What to add to the repo

- [ ] `.github/workflows/ci.yml` — lint, test, build
- [ ] `.github/workflows/deploy-staging.yml` — SSH rsync + optional migrations (on `main`)
- [ ] `.github/workflows/deploy-prod.yml` — manual `workflow_dispatch` or tag trigger + approval
- [ ] `scripts/deploy-vps.sh` — idempotent deploy steps
- [ ] GitHub **environments** `staging` / `production` with protection rules on prod

Issue backlog detail: **D12** in `PRODUCTION_LAUNCH_ISSUES.md`.

---

_Notes: Single VPS + Docker Compose. SEO: prerender static routes only; opportunity detail via Helmet. Biggest ops risks: backups/restore untested, Studio/Postgres exposed, no captcha on writes. Biggest security wins: Cloudflare + CSP + secret rotation._
