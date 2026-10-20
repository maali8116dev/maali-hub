# Migration Plan: Lovable → Vercel + Supabase

## Overview

This document covers the steps to migrate the Maali Opportunity Hub from Lovable hosting to a self-managed stack: **Vercel** (frontend) + **Supabase** (backend/database), with **Resend** (email) and **Stripe** (payments) continuing as external services.

---

## Infrastructure & Pricing

### Vercel — Frontend Hosting
**Start on: Hobby (Free)**

| Plan | Price | Notes |
|------|-------|-------|
| Hobby | $0/mo | 100GB bandwidth, unlimited deployments, custom domains |
| Pro | $20/mo per member | Needed if team collaboration or advanced analytics required |

- Free plan supports custom domains and SSL — sufficient to start.
- Upgrade to Pro if you need password-protected previews, team members, or >100GB bandwidth.
- [vercel.com/pricing](https://vercel.com/pricing)

---

### Supabase — Database, Auth & Edge Functions
**Start on: Pro ($25/mo)**

| Plan | Price | Includes |
|------|-------|----------|
| Free | $0/mo | 500MB DB, 50MB file storage, 2 projects — **not suitable for production** |
| Pro | $25/mo | 8GB DB, 100GB file storage, daily backups, no project pausing |

- The Free plan pauses inactive projects after 1 week — avoid for production.
- Pro includes point-in-time restore add-on availability and team access.
- [supabase.com/pricing](https://supabase.com/pricing)

---

### Resend — Transactional Email
Currently used for auth emails, notifications, and application confirmations.

| Plan | Price | Includes |
|------|-------|----------|
| Free | $0/mo | 3,000 emails/mo, 1 domain |
| Pro | $20/mo | 50,000 emails/mo, multiple domains |

- No changes needed to Resend during migration — it is already a standalone service.
- Ensure the sending domain (e.g. `mail.maali.co`) DNS records remain valid after the domain moves.
- [resend.com/pricing](https://resend.com/pricing)

---

### Stripe — Payments & Subscriptions
Currently used for membership billing and application payments.

| Plan | Price | Notes |
|------|-------|-------|
| Standard | 2.9% + 30¢ per transaction | No monthly fee |

- No changes needed to Stripe during migration — webhooks will need the new Supabase Edge Function URLs updated in the Stripe dashboard.
- Update the webhook endpoint from the Lovable URL to your new Supabase project URL.
- [stripe.com/pricing](https://stripe.com/pricing)

---

## Custom Domain

> **Important:** The custom domain must be pointed to **Vercel**, not Supabase.

- Add the domain in the Vercel project dashboard under **Settings → Domains**.
- Update your DNS provider to point the apex domain (`maali.co`) and `www` subdomain to Vercel's nameservers or A/CNAME records as instructed.
- Vercel handles SSL automatically once DNS propagates.
- Supabase uses its own subdomain (`<project-ref>.supabase.co`) for API/auth — your app connects to it via environment variables, not via your custom domain.

---

## Migration Steps

### 1. Supabase Project Setup
- [ ] Create a new Supabase project (Pro plan)
- [ ] Run all migrations from `supabase/migrations/` against the new project
- [ ] Copy environment variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Deploy Edge Functions (`stripe-webhook`, `submit-application`, etc.) via Supabase CLI
- [ ] Verify RLS policies and auth settings match production requirements

### 2. Vercel Project Setup
- [ ] Import the GitHub repository into Vercel
- [ ] Set all environment variables in Vercel project settings (copy from Lovable)
- [ ] Confirm build command (`npm run build`) and output directory (`dist`) are correct
- [ ] Deploy and smoke-test on the Vercel preview URL before switching the domain

### 3. Domain Cutover
- [ ] Add the custom domain in Vercel dashboard
- [ ] Update DNS records at your registrar to point to Vercel
- [ ] Confirm SSL certificate is issued (can take up to 48hrs for DNS propagation)
- [ ] Remove the domain from Lovable once Vercel is confirmed live

### 4. Stripe Webhook Update
- [ ] Go to Stripe Dashboard → Developers → Webhooks
- [ ] Update the endpoint URL to the new Supabase Edge Function URL:
  `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
- [ ] Rotate or confirm the `STRIPE_WEBHOOK_SECRET` env var matches the new endpoint

### 5. Resend DNS Check
- [ ] Confirm sending domain DNS records (SPF, DKIM, DMARC) are still valid
- [ ] Send a test email post-migration to verify delivery

### 6. Decommission Lovable
- [ ] Confirm all traffic is routing through Vercel
- [ ] Cancel Lovable subscription / remove project

---

## Environment Variables Checklist

These must be set in Vercel project settings before go-live:

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_STRIPE_PUBLISHABLE_KEY
```

These must be set in Supabase Edge Function secrets:

```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
```

---

## Estimated Monthly Cost at Launch

| Service | Plan | Cost |
|---------|------|------|
| Vercel | Hobby | $0 |
| Supabase | Pro | $25 |
| Resend | Free | $0 |
| Stripe | Standard | 2.9% + 30¢ per txn |
| **Total fixed** | | **$25/mo** |

---

## Cost Projections by User Scale

These estimates are derived from the actual code — specifically the 14 email types in `send-email/index.ts`, the `receipts` and `application-docs` storage buckets, the 14 deployed Edge Functions, and the $2/mo Stripe subscription in `create-membership-payment/index.ts`.

### Assumptions per user tier

| Assumption | 1,000 users | 5,000 users | 10,000 users |
|---|---|---|---|
| Monthly active users | ~400 | ~2,000 | ~4,500 |
| Membership conversion (paid $2/mo) | 10% → 100 | 12% → 600 | 15% → 1,500 |
| Applications submitted/mo | ~80 | ~500 | ~1,200 |
| Emails per user/mo (auth + notifications + status updates) | ~4 | ~4 | ~4 |

---

### Resend

The `send-email` function handles 14 email types: `welcome`, `email_verification`, `password_reset`, `application_submitted`, `application_approved`, `application_rejected`, `application_under_review`, `status_update`, `contact_submission`, `contact_confirmation`, `payment_receipt`, `kyc_verified`, `kyc_rejected`, `partner_invite`.

Each application submission triggers at minimum 2 emails (submitted + receipt). Auth flows add 2 more per new user (verify + welcome).

| Scale | Emails/mo | Plan | Cost |
|---|---|---|---|
| 1,000 users | ~1,600 new-user emails + ~160 application emails = **~1,800/mo** | Free (3,000 limit) | **$0** |
| 5,000 users | ~2,000 active-user emails + ~1,000 application emails = **~13,000/mo** | Pro (50,000 limit) | **$20/mo** |
| 10,000 users | ~4,500 active-user emails + ~2,400 application emails = **~28,000/mo** | Pro | **$20/mo** |

> Upgrade trigger: exceed 3,000/mo — likely around 750–800 total users.

---

### Supabase

**Database:** Each application row is large (30+ columns per `buildApplicationRow` in `submit-application/index.ts`). Storage buckets: `receipts` (one PDF per payment via `pdf-receipt.ts`) and `application-docs` (user-uploaded files).

**Edge Function invocations:** 14 functions. The `stripe-webhook` alone handles `checkout.session.completed`, `invoice.paid`, `customer.subscription.*` — roughly 3–5 invocations per paying user per month.

| Scale | DB size estimate | Storage (receipts + docs) | Edge fn invocations/mo | Plan | Cost |
|---|---|---|---|---|---|
| 1,000 users | ~200MB | ~50MB (100 PDFs + uploads) | ~15,000 | Pro | **$25/mo** |
| 5,000 users | ~1.2GB | ~400MB (600 PDFs + uploads) | ~80,000 | Pro | **$25/mo** |
| 10,000 users | ~3GB | ~1GB (1,500 PDFs + uploads) | ~200,000 | Pro + compute add-on likely | **$25–$75/mo** |

> Pro includes 8GB DB and 100GB storage — comfortably covers up to ~10,000 users. Compute add-on (~$50/mo) may be needed at 10k if Edge Function cold starts become a latency issue under sustained load.

---

### Stripe

Membership is a $2/mo recurring subscription (`STRIPE_MEMBER_PRICE_ID`). Application fees may also apply (checkout sessions in `create-checkout-session/index.ts`). Fee: 2.9% + $0.30 per transaction.

| Scale | Paying members | Monthly subscription revenue | Stripe fee (2.9% + $0.30/txn) | Net to platform |
|---|---|---|---|---|
| 1,000 users | 100 members | $200 | ~$36 (100 × $0.358) | **~$164/mo** |
| 5,000 users | 600 members | $1,200 | ~$215 (600 × $0.358) | **~$985/mo** |
| 10,000 users | 1,500 members | $3,000 | ~$537 (1,500 × $0.358) | **~$2,463/mo** |

> Does not include application fee transactions, which add additional Stripe volume at whatever fee amount is configured.

---

### Vercel

The app is a Vite/React SPA (`dist/` output). Bandwidth usage is driven by the JS bundle size and active users loading the dashboard. Vercel Hobby includes 100GB/mo.

| Scale | Estimated bandwidth/mo | Plan | Cost |
|---|---|---|---|
| 1,000 users | ~5GB (400 MAU × ~12MB bundle + assets) | Hobby | **$0** |
| 5,000 users | ~30GB (2,000 MAU × ~15MB) | Hobby | **$0** |
| 10,000 users | ~80GB (4,500 MAU × ~18MB) | Hobby (approaching limit) | **$0–$20/mo** |

> At 10,000 users you may brush the 100GB/mo Hobby limit depending on asset caching. Consider enabling Vercel's Edge Cache or moving to Pro ($20/mo) at that point.

---

### Total Monthly Fixed Cost Summary

| Scale | Vercel | Supabase | Resend | Stripe (fees) | **Total fixed** |
|---|---|---|---|---|---|
| Launch | $0 | $25 | $0 | per txn | **$25/mo** |
| 1,000 users | $0 | $25 | $0 | ~$36 | **$61/mo** |
| 5,000 users | $0 | $25 | $20 | ~$215 | **$260/mo** |
| 10,000 users | $0–$20 | $25–$75 | $20 | ~$537 | **$580–$650/mo** |
