# Production Launch — Issue Backlog

Self-hosting **frontend + Supabase on one VPS** (Docker Compose). No Vercel. See `PRODUCTION_SELF_HOST_REVIEW.md` §12 for consolidated checklist.

Each issue is GitHub-ready: copy the block into a new issue. Priorities: **P0** blocks launch · **P1** first week · **P2** backlog.

**Milestones:** `M1: Infra & Migration` · `M2: Security & Bot` · `M3: SEO & Frontend` · `M4: Compliance & Ops`

**Label key:** `area:infra` `area:supabase` `area:security` `area:seo` `area:payments` `area:email` `area:compliance` `area:a11y` `area:observability` `area:frontend` · `P0`/`P1`/`P2` · `blocked`

## Locked decisions

| ID | Decision |
|----|----------|
| **Host** | **Single VPS** — Vite `dist/` + Supabase Compose on same machine. Cloudflare recommended. **No Vercel.** |
| **A1** | **Docker Compose** on that VPS. No Kubernetes. |
| **C2** | **Prerender at build** for static marketing routes only. **No** `/opportunities/:id` prerender — opportunities are dynamic; no rebuild per new listing. Opportunity detail stays SPA + `react-helmet-async` (Google). Social unfurls for shared opportunity links use site-default OG unless C2b is done later. |

Suggested execution order (dependency-aware): **A1 → A2 → A3 → A4 → A7 → A8 → then parallelize B/C/D.**

---

## EPIC A — Infra & Supabase Self-Host (M1)

### A1. Provision self-hosted Supabase stack (Docker Compose)
- **Priority:** P0 · **Labels:** `area:supabase` `area:infra` `P0`
- **Context:** Replace Supabase Cloud with self-managed stack on **Docker Compose** (no k8s). Postgres, GoTrue, PostgREST, Storage, Kong, Realtime, edge-runtime, Studio.
- **Tasks:**
  - [ ] Stand up official Supabase Compose stack on 1–2 VMs; pin image versions.
  - [ ] Enable extensions: `pg_cron`, `pg_net`, `pgsodium`/Vault, `pgjwt`, `pgcrypto`.
  - [ ] Configure Kong routes; terminate TLS in front of Kong (Caddy/nginx/Cloudflare).
  - [ ] `restart: unless-stopped` + healthchecks on every service; named volumes for Postgres + storage.
- **Acceptance:** All services healthy; app boots against stack in staging; PostgREST works with anon + service_role as expected.
- **Deps:** none (foundation).

### A2. Generate and manage fresh platform secrets
- **Priority:** P0 · **Labels:** `area:supabase` `area:security` `P0`
- **Context:** Never reuse cloud secrets. New chain of trust.
- **Tasks:**
  - [ ] Generate `JWT_SECRET`; sign new `ANON_KEY` + `SERVICE_ROLE_KEY`.
  - [ ] New Postgres password, `SECRET_KEY_BASE`, Vault key, dashboard creds.
  - [ ] Store in host secret manager; wire into all `.env` (app + functions).
  - [ ] Confirm nothing committed to git.
- **Acceptance:** All services use new secrets; old cloud keys revoked; `git grep` finds no secrets.
- **Deps:** A1.

### A3. Lock down Studio & Postgres
- **Priority:** P0 · **Labels:** `area:security` `area:supabase` `P0`
- **Tasks:**
  - [ ] Studio behind VPN/IP-allowlist or Kong basic-auth; strong dashboard creds.
  - [ ] Postgres bound to private network; no public `5432`.
  - [ ] service_role key never routable from browser (verify Kong).
- **Acceptance:** Studio + Postgres unreachable from public internet (verified by external scan); service_role not exposed via anon routes.
- **Deps:** A1.

### A4. Data & storage migration from cloud
- **Priority:** P0 · **Labels:** `area:supabase` `area:infra` `P0`
- **Tasks:**
  - [ ] `pg_dump` cloud DB; import to self-hosted; verify row counts, sequences, RLS policies, grants.
  - [ ] Migrate Storage objects (esp. `application-docs` PII bucket) to S3/MinIO; verify bucket is private + signed-URL only.
  - [ ] Full dry-run in staging before prod cutover.
- **Acceptance:** Row/object counts match source; RLS + policies intact; signed URL download works, public access denied.
- **Deps:** A1, A2.

### A5. Connection pooling
- **Priority:** P1 · **Labels:** `area:supabase` `area:infra` `P1`
- **Tasks:** [ ] Run PgBouncer; point app + functions at pooler; tune pool size vs Postgres `max_connections`.
- **Acceptance:** Load test doesn't exhaust connections.
- **Deps:** A1.

### A6. Backups + Point-in-Time Recovery
- **Priority:** P1 · **Labels:** `area:supabase` `area:observability` `P1`
- **Tasks:**
  - [ ] Automated `pg_dump` cron + WAL archiving (`wal-g`/`pgBackRest`) to offsite storage.
  - [ ] Storage bucket backup.
  - [ ] **Restore test** into clean env.
- **Acceptance:** Documented restore succeeds end-to-end; RPO/RTO recorded.
- **Deps:** A1, A4.

### A7. Edge Functions runtime + secrets
- **Priority:** P1 · **Labels:** `area:supabase` `area:infra` `P1`
- **Tasks:**
  - [ ] Deploy all functions to `edge-runtime`; inject per-function secrets (`CRON_SECRET`, Stripe, Paystack, Resend/SMTP, translate keys).
  - [ ] Verify cold-start/timeout acceptable.
- **Acceptance:** Every function invokes successfully in staging with prod-shaped config.
- **Deps:** A1, A2.

### A8. Scheduled workers (cron)
- **Priority:** P0 · **Labels:** `area:supabase` `area:infra` `P0`
- **Context:** Leaving Lovable — must self-schedule.
- **Tasks:**
  - [ ] Apply pg_cron migration `20260704160000`; set vault `project_url` + `cron_secret`.
  - [ ] Schedule `process-email-queue` + `process-partner-webhooks`.
  - [ ] Set `CRON_SECRET` in function secrets.
- **Acceptance:** Both workers fire on schedule; unauthenticated calls rejected (503/401).
- **Deps:** A7.

### A9. Upgrade strategy & resource sizing
- **Priority:** P1 · **Labels:** `area:infra` `area:supabase` `P1`
- **Tasks:** [ ] Pin versions; document tested upgrade cadence; set CPU/mem, disk-growth alerts (Postgres + storage).
- **Acceptance:** Runbook entry for upgrades; alerts fire on disk threshold.
- **Deps:** A1.

---

## EPIC B — Security & Bot Prevention (M2)

### B1. Rotate all application secrets
- **Priority:** P0 · **Labels:** `area:security` `P0`
- **Tasks:** [ ] Rotate Stripe, Paystack, Resend/SMTP, `CRON_SECRET`, any partner API keys used in testing (a live key was used in a terminal). Update secret store.
- **Acceptance:** Old secrets invalid; app functions with new ones.
- **Deps:** A2 (platform keys), can run parallel otherwise.

### B2. Security headers at the edge
- **Priority:** P0 · **Labels:** `area:security` `area:frontend` `P0`
- **Context:** None set today. SPA has no server → configure at web server/CDN.
- **Tasks:**
  - [ ] `Content-Security-Policy` allowing self + Supabase, Stripe, Paystack, PostHog, Sentry, gpteng font CDN.
  - [ ] `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (or CSP `frame-ancestors`), `Referrer-Policy`, `Permissions-Policy`.
- **Acceptance:** securityheaders.com grade A; app functions with CSP (no console CSP violations).
- **Deps:** domain live.

### B3. Lock CORS on Edge Functions
- **Priority:** P0 · **Labels:** `area:security` `area:supabase` `P0`
- **Tasks:** [ ] Set `ALLOWED_ORIGINS` to prod domain(s) for all browser-facing functions (several use `*`, incl. partner functions).
- **Acceptance:** Cross-origin call from a non-allowed origin is blocked; app origin works.
- **Deps:** A7, domain live.

### B4. RLS + `verify_jwt` audit
- **Priority:** P0 · **Labels:** `area:security` `area:supabase` `P0`
- **Tasks:**
  - [ ] Verify RLS enabled + policy correct on every table; no anon-readable PII.
  - [ ] Audit `config.toml` `verify_jwt=false` functions — each must self-auth (signature/CRON_SECRET/session).
- **Acceptance:** Written report: every table's anon/authenticated grants + every public function's auth mechanism. No gaps.
- **Deps:** A4.

### B5. Sanitize 500 error bodies
- **Priority:** P1 · **Labels:** `area:security` `P1`
- **Tasks:** [ ] Map DB/internal errors to generic `INTERNAL_ERROR` in prod across functions (partner API leaks `error.message`).
- **Acceptance:** No raw DB error text in any 5xx response body.
- **Deps:** A7.

### B6. Captcha on auth + public forms
- **Priority:** P0 · **Labels:** `area:security` `area:frontend` `P0`
- **Tasks:**
  - [ ] Integrate Cloudflare Turnstile (or hCaptcha) on signup, login, password reset, contact, application submit.
  - [ ] Verify token server-side in relevant functions.
  - [ ] Enable Supabase Auth (GoTrue) built-in captcha.
- **Acceptance:** Submitting without valid captcha token is rejected server-side.
- **Deps:** A7 (server verify).

### B7. Rate limiting on public functions + email
- **Priority:** P1 · **Labels:** `area:security` `P1`
- **Tasks:** [ ] Extend existing rate-limit pattern to contact/application/translate functions; throttle transactional email per user/IP; confirm fail-closed.
- **Acceptance:** Burst test triggers 429; email flood is throttled.
- **Deps:** A7.

### B8. Edge WAF / DDoS / bot protection
- **Priority:** P1 · **Labels:** `area:security` `area:infra` `P1`
- **Tasks:** [ ] Front app + Kong with Cloudflare (WAF, bot fight mode, DDoS, asset caching); honeypot field on marketing forms.
- **Acceptance:** Traffic flows through WAF; bot-fight enabled; static assets cached at edge.
- **Deps:** domain live.

### B9. Webhook secret storage hardening
- **Priority:** P2 · **Labels:** `area:security` `P2`
- **Tasks:** [ ] Encrypt `partner_webhooks.signing_secret` at rest or derive from Vault master key (currently plaintext for outbound HMAC).
- **Acceptance:** Plaintext secret no longer stored, or documented accepted-risk sign-off.
- **Deps:** A1 (Vault).

### B10. Dependency & rich-text XSS audit
- **Priority:** P1 · **Labels:** `area:security` `P1`
- **Tasks:** [ ] `npm audit` + patch; verify all `react-quill` render paths pass through `dompurify`.
- **Acceptance:** No high/critical audit findings unaddressed; XSS test on rich-text fails to execute.

---

## EPIC C — SEO & Frontend (M3)

### C1. Replace placeholder domain everywhere
- **Priority:** P0 · **Labels:** `area:seo` `area:frontend` `P0`
- **Tasks:** [ ] Update real domain in `index.html` (og:url, og:image, twitter:image, canonical), `robots.txt` sitemap line, all `sitemap.xml` `<loc>` (hardcoded `lovable.app`).
- **Acceptance:** No `lovable.app` string remains; social debuggers resolve prod URLs.

### C2. Prerender static marketing pages + Helmet for dynamic routes
- **Priority:** P0 · **Labels:** `area:seo` `area:frontend` `P0`
- **Context:** Prerender **build-time only** for routes that rarely change. Opportunity detail pages are **excluded** — too dynamic to rebuild per listing.
- **Prerender at build (vite-plugin-prerender or similar):**
  - `/`, `/about`, `/contact`, `/faq`, `/resources`, `/partners`, `/success-stories`, `/blog` (index), `/mentors`, `/opportunities` (list page only)
- **Stay SPA + `react-helmet-async` (no prerender):**
  - `/opportunities/:id` — dynamic meta for Google; accept generic OG card on WhatsApp/LinkedIn/X unless C2b ships
- **Tasks:**
  - [ ] Add `vite-plugin-prerender` (or equivalent); configure route list above only.
  - [ ] Per-route title/description/OG in prerendered HTML for static routes.
  - [ ] Add `react-helmet-async` on opportunity detail (and blog post if not prerendered per slug).
  - [ ] Document accepted tradeoff: shared opportunity links show default OG image until C2b.
- **Acceptance:** Static routes serve unique HTML meta without JS; opportunity detail has correct `<title>` in Google Search Console URL inspection; no build step runs on new opportunity create.
- **Deps:** C1.

### C2b. Dynamic OG for opportunity links (optional, post-launch)
- **Priority:** P2 · **Labels:** `area:seo` `P2`
- **Context:** Social bots don't run JS. Without prerender-per-opportunity, need a tiny OG endpoint (Edge Function or nginx subrequest) that returns HTML with `og:title`/`og:image` for `/opportunities/:id` when `User-Agent` is a crawler.
- **Tasks:** [ ] OG meta endpoint reading opportunity from DB; wire share URLs or bot detection at edge.
- **Acceptance:** LinkedIn/WhatsApp debugger shows opportunity-specific title + image for a test listing.
- **Deps:** C2, A7.

### C3. Dynamic sitemap generation
- **Priority:** P1 · **Labels:** `area:seo` `P1`
- **Tasks:** [ ] Generate `sitemap.xml` via **scheduled job** (pg_cron or deploy hook) — includes opportunity URLs for Google; does **not** require prerendering those pages.
- **Acceptance:** New opportunity appears in sitemap without frontend rebuild.
- **Deps:** C1.

### C4. hreflang + structured data
- **Priority:** P1 · **Labels:** `area:seo` `P1`
- **Tasks:** [ ] `hreflang` alternates for en/fr/de/pt on prerendered pages; JSON-LD `Organization` on `/`; `Article` on blog; `JobPosting`-style JSON-LD on opportunity detail via Helmet (client-injected, Google reads JS).
- **Acceptance:** Rich Results Test passes for homepage + one blog post; opportunity detail JSON-LD visible in rendered DOM.
- **Deps:** C2.

### C5. Performance / Core Web Vitals
- **Priority:** P1 · **Labels:** `area:frontend` `area:seo` `P1`
- **Tasks:** [ ] Verify chunking; webp/avif + responsive images + lazy-load; Brotli/gzip at edge; Lighthouse on `/` + `/opportunities`.
- **Acceptance:** CWV green (LCP/CLS/INP) on key pages.

### C6. SPA hosting config
- **Priority:** P0 · **Labels:** `area:frontend` `area:infra` `P0`
- **Tasks:** [ ] History-API fallback to `index.html`; long cache for hashed assets, `no-cache` for `index.html`; TLS + http→https redirect.
- **Acceptance:** Deep links load; hashed assets cached; `index.html` never stale.
- **Deps:** domain live.

---

## EPIC D — Payments, Email, Compliance, A11y, Ops (M4)

### D1. Payments go-live (Stripe + Paystack)
- **Priority:** P0 · **Labels:** `area:payments` `P0`
- **Tasks:** [ ] Live keys; re-register webhook endpoints at new domain + new signing secrets; verify signature checks; confirm reachable through Kong without JWT.
- **Acceptance:** Live test transaction succeeds; webhook received + verified + state updated.
- **Deps:** A7, B1, domain live.

### D2. Payment webhook idempotency & reconciliation
- **Priority:** P1 · **Labels:** `area:payments` `P1`
- **Tasks:** [ ] Idempotent webhook handling; reconciliation vs provider dashboard; never log card data.
- **Acceptance:** Duplicate webhook delivery doesn't double-process.
- **Deps:** D1.

### D3. Email deliverability (SPF/DKIM/DMARC)
- **Priority:** P0 · **Labels:** `area:email` `P0`
- **Tasks:** [ ] SPF, DKIM, DMARC on sending domain; SMTP in GoTrue + `send-email`/`process-email-queue`.
- **Acceptance:** mail-tester score ≥ 9/10; magic link + invite land in inbox.
- **Deps:** A7, domain live.

### D4. Email reputation & throttling
- **Priority:** P1 · **Labels:** `area:email` `area:security` `P1`
- **Tasks:** [ ] Domain warm-up; monitor bounce/complaint; per-user/IP send throttle; correct From/reply-to/unsubscribe.
- **Acceptance:** Bounce/complaint under provider thresholds; throttle enforced.
- **Deps:** D3.

### D5. Legal pages + cookie consent
- **Priority:** P0 · **Labels:** `area:compliance` `P0`
- **Tasks:** [ ] Publish Privacy Policy + ToS (linked in footer); cookie/consent banner gating PostHog/marketing cookies.
- **Acceptance:** Analytics only initializes after consent; policies reachable.

### D6. Data subject rights (GDPR)
- **Priority:** P1 · **Labels:** `area:compliance` `P1`
- **Tasks:** [ ] Export-my-data + delete-my-data flows; hard-delete cascades PII across tables + storage; retention policy; DPAs with subprocessors.
- **Acceptance:** Delete request removes all PII incl. storage docs; export returns user's data.
- **Deps:** A4.

### D7. Analytics/error PII scrubbing
- **Priority:** P1 · **Labels:** `area:compliance` `area:observability` `P1`
- **Tasks:** [ ] Audit PostHog + Sentry capture; mask inputs; disable session-replay input capture; set prod environment + release/sourcemaps.
- **Acceptance:** No PII in captured events; Sentry env=production with sourcemaps.

### D8. Accessibility pass
- **Priority:** P1 · **Labels:** `area:a11y` `P1`
- **Tasks:** [ ] Keyboard nav, focus states, form labels, contrast, `aria-*` on custom components; dynamic `lang` attr per active locale.
- **Acceptance:** axe/Lighthouse a11y ≥ 95 on key pages; `<html lang>` updates on language switch.

### D9. i18n locale parity in CI
- **Priority:** P2 · **Labels:** `area:a11y` `area:frontend` `P2`
- **Tasks:** [ ] Run `i18n:check-locale` in CI to block drift (fr/de/pt).
- **Acceptance:** CI fails on missing locale keys.

### D10. Observability & alerting
- **Priority:** P0 · **Labels:** `area:observability` `area:infra` `P0`
- **Tasks:** [ ] Centralized logs (Postgres, Kong, GoTrue, functions) → Loki/ELK/hosted; uptime monitoring + on-call alerts for app, Kong, Postgres, auth, payment webhooks.
- **Acceptance:** Simulated outage triggers alert; logs queryable centrally.
- **Deps:** A1.

### D11. Dashboards + runbook + DR drill
- **Priority:** P1 · **Labels:** `area:observability` `area:infra` `P1`
- **Tasks:** [ ] Dashboards (DB connections, disk, error rate, `partner_webhook_outbox`/`email_queue` depth, rate-limit hits); runbook (deploy/rollback/rotate/restore/scale); DR drill restoring DB+storage into clean env.
- **Acceptance:** Runbook reviewed; DR drill boots app end-to-end from backups.
- **Deps:** A6, D10.

### D12. CI/CD + staging gate
- **Priority:** P1 · **Labels:** `area:infra` `P1`
- **Context:** Single VPS deploy. See `PRODUCTION_SELF_HOST_REVIEW.md` §13.
- **Shipped:**
  - [x] **CI** (`.github/workflows/ci.yml`): `npm ci` → lint (report-only, ~550 pre-existing
    errors) → i18n parity (blocking) → vitest (report-only, 9 pre-existing failing files) →
    build (blocking), on every PR/push to `main`/`develop`. Absorbed the old `i18n.yml`.
  - [x] **CD** (`.github/workflows/deploy-supabase.yml`): pushes DB migrations + edge
    functions via `scripts/deploy-selfhosted.sh` over SSH, only when those paths change.
    Auto on push to `main` (`staging` GitHub Environment); `production` only via manual
    `workflow_dispatch`, gated by that environment's required reviewers.
  - [x] GitHub environment secrets documented in `SECRETS_CHECKLIST.md` §6. No service_role
    or payment/email secrets in GitHub — those stay in Coolify.
  - Frontend is **not** deployed by these workflows — Coolify auto-builds the Dockerfile app
    straight from git pushes (§6 of `COOLIFY_DEPLOYMENT.md`); CI/CD here exists to gate what
    merges into the branch Coolify watches, and to stop migrations/functions from being
    pushed by hand and forgotten.
- **Still open:**
  - [ ] Flip lint + vitest from report-only to blocking once the existing debt (551 lint
    errors, 9 broken test files on a stale `react-i18next` mock) is cleared.
  - [ ] Branch protection rule requiring the CI job to pass before merge to `main`.
  - [ ] Add `staging`/`production` GitHub Environments + secrets in repo settings (workflow
    references them; they don't exist yet).
  - [ ] Test `deploy-supabase.yml` once against a real VPS/staging target — untested as
    written.
  - [ ] Optional: Playwright against `STAGING_URL` in CI.
  - [ ] Staging VPS or second Compose project with separate keys/DB.
- **Acceptance:** PR with failing build cannot merge (branch protection); deploy to prod
  requires passing CI + manual approval; rollback steps documented and tested once.
- **Deps:** A1 (VPS exists), C6 (static path known).

---

## P0 launch gate (must all be closed)

Infra: A1 A2 A3 A4 A8 · Security: B1 B2 B3 B4 B6 · Frontend/SEO: C1 C2 C6 · Payments/Email/Legal/Ops: D1 D3 D5 D10

> A senior reviewer's smell test before sign-off: _Can we restore the DB from backup? Is Postgres/Studio truly private? Is an unauthenticated user blocked from PII and un-captcha'd writes? Do payments + magic-link emails work on the new domain? Do static marketing pages have prerendered meta — and do we accept default OG on shared opportunity links until C2b?_

---

## Appendix — Single VPS consolidated checklist

Same content as `PRODUCTION_SELF_HOST_REVIEW.md` §12. Epics above expand each item with acceptance criteria.

### Topology

```
Internet → Cloudflare → Caddy/nginx (TLS)
  app.domain  → dist/ (Vite static)
  api.domain  → Kong (Supabase)
Compose on same VPS: Postgres, GoTrue, PostgREST, Storage, Realtime, edge-runtime, Studio (locked)
```

### P0

**Infra:** Compose + volumes + restarts · fresh secrets · Postgres/Studio private · TLS · SPA cache rules · DB+storage migrate + restore test · cron workers · Edge Functions + secrets

**Security:** CSP/HSTS headers · Cloudflare WAF/bots · captcha · rate limits · RLS audit · key rotation · CORS lockdown

**SEO:** drop lovable.app · prerender static routes · Helmet on opportunity detail · default OG tradeoff accepted

**Payments/email:** live keys · webhooks on new domain · SPF/DKIM/DMARC · end-to-end email test

**Legal/ops:** Privacy + ToS · cookie consent · logs · uptime alerts

### P1

PgBouncer · scheduled sitemap · hreflang/JSON-LD · Sentry/PostHog scrub · runbook · self-host fonts · npm audit · staging VPS · **CI/CD (§13 / D12)**

### P2

Dynamic OG (C2b) · GDPR flows · tracing · load test · webhook secret encryption

### VPS sizing

Early prod: **4 vCPU, 8–16 GB RAM, 80+ GB SSD**. Pick region near users.

### Smoke test

Captcha signup → magic link · application + upload · partner new opportunity (no rebuild) · payment webhook · security headers · backup restore

### Skip

Vercel, k8s, ISR, Turborepo, Vercel WAF/Speed Insights/Fluid compute
