# Migration Guide: Self-Hosted → Lovable + Managed Supabase

Move the Maali Opportunity Hub from a self-hosted setup to **Lovable** (website hosting) + **Supabase** (database, login, files, backend). The app code already lives on **GitHub**.

> **Note for anyone using AI to help with this migration:** Before asking an assistant to change code in the GitHub repo, point it at the project's AI instructions in [`README.md`](./README.md) → *Contributing & AI agent instructions* (`CLAUDE.md`, `AGENTS.md`, `.cursor/rules/`). That keeps edits aligned with how this codebase is maintained.

---

## Overview

| Today (self-hosted) | After migration |
|---------------------|-----------------|
| You run the website server | **Lovable** hosts the website |
| You run the database/backend | **Supabase** runs database + backend |
| Stripe & email point at old URLs | Stripe & email point at **new Supabase** URLs |
| Custom domain → old server | Custom domain → **Lovable** |

**Unchanged:** App features, Stripe account, Resend account. GitHub remains the code source.

**Accounts needed before you start:**

| Service | Used for |
|---------|----------|
| [Lovable](https://lovable.dev) | Website hosting, publish, custom domain |
| [Supabase](https://supabase.com) | Database, auth, storage, payment webhooks |
| [GitHub](https://github.com) | Source code |
| [Stripe](https://stripe.com) | Payments |
| [Resend](https://resend.com) | Email |
| Domain registrar | DNS for your domain |

Use one **owner email** for Lovable and Supabase billing. Enable 2FA on both. Store passwords in a password manager — do not share logins.

---

## Step 1: Create Lovable account and project

**Time:** ~10 minutes

1. Go to [lovable.dev](https://lovable.dev) → **Sign up** (owner email).
2. Choose **Pro ($25/mo)** for production (private project, custom domain, no Lovable badge). Free tier is test-only.
3. Enable **two-factor authentication** in account settings.
4. Create a new project named e.g. `Maali Opportunity Hub`.

You will connect the real GitHub code in Step 2.

---
>
## Step 2: Connect GitHub code to Lovable

Lovable cannot import an existing GitHub repo with one click ([Lovable GitHub docs](https://docs.lovable.dev/integrations/github)). Use this one-time sync:

1. In Lovable: **Settings → Connectors → GitHub** → authorize GitHub → **Connect project**.
2. Select the GitHub account/org → **Install & Authorize** → **Connect project** → **Transfer anyway**.
3. Lovable creates a **new GitHub repository** and starts two-way sync on `main`.

If your Maali code is already in a **different** GitHub repo:

4. Clone both repos to your computer:
   - Existing Maali repo (your current code)
   - The new repo Lovable just created
5. Copy all Maali project files into the Lovable repo folder (keep the `.git` folder from the Lovable repo).
6. Commit and push to `main`:
   ```bash
   git add .
   git commit -m "Import Maali Opportunity Hub codebase"
   git push origin main
   ```
7. Wait for Lovable to sync — the project should show the real Maali app.
8. Confirm the site builds in Lovable preview. Do not commit `.env` files or secrets to GitHub.

---

## Step 3: Create Supabase project

**Time:** ~15 minutes

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → sign up or log in.
2. **New project** → set organization, name (`maali-production`), strong database password (save in password manager), region closest to users.
3. Choose **Pro plan ($25/mo)** — Free tier pauses when inactive; not for production.
4. Wait until status is **Active** (~2 minutes).
5. Open **Project Settings → API** and save securely:
   - **Project URL** (`https://xxxxxxxx.supabase.co`)
   - **anon public** key
   - **service_role** key (secret — never put in the website frontend)

---

## Step 4: Set up the Supabase database and backend

1. Apply all migration files from the repo folder `supabase/migrations/` to the new Supabase project:
   - Via Supabase CLI: `npm run supabase:link` then `npm run supabase:push`
   - Or paste migration SQL in Supabase Dashboard → **SQL Editor** (in filename order)

2. Deploy Edge Functions from `supabase/functions/` (minimum set):
   ```bash
   supabase functions deploy stripe-webhook
   supabase functions deploy submit-application
   supabase functions deploy send-email
   supabase functions deploy auth-email-hook
   supabase functions deploy create-payment-intent
   ```
   Deploy any other functions your production setup uses.

3. In Supabase Dashboard → **Edge Functions → Secrets**, add:

   ```
   STRIPE_SECRET_KEY
   STRIPE_WEBHOOK_SECRET
   RESEND_API_KEY
   SITE_URL=https://your-domain.com
   INTERNAL_EMAIL_SECRET
   FROM_EMAIL
   ```

   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are usually injected automatically.

See [README.md](./README.md) for the full secrets and deploy list.

---

## Step 5: Connect Lovable to Supabase

1. In Lovable → **Settings** (or **Integrations**) → **Supabase** → **Connect**.
2. Select the Supabase project created in Step 3.
3. Set environment variables in Lovable (**Settings → Environment / Secrets**):

   ```
   VITE_SUPABASE_URL=<Project URL from Step 3>
   VITE_SUPABASE_ANON_KEY=<anon public key>
   VITE_SITE_URL=<Lovable preview URL first, then custom domain>
   VITE_STRIPE_PUBLISHABLE_KEY=<from Stripe Dashboard>
   ```

   Add PostHog, Sentry, or other keys from your old setup if used.

4. **Publish** (Share → Publish) in Lovable.
5. Open the published URL → test **Sign up** and **Log in**. Auth working = Lovable ↔ Supabase connected.

---

## Step 5a: Enable Google sign-in (Supabase)

The app supports **Sign in with Google** (`Auth.tsx` → redirect to `/auth/callback`). Configure once per Supabase project.

### 1. Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/) → select or create a project.
2. **APIs & Services → OAuth consent screen** — configure app name, support email, publish (or add test users while in Testing).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
4. Application type: **Web application**.
5. **Authorized redirect URIs** — add exactly (replace `<project-ref>` with your Supabase project ID from the Project URL):

   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```

   Example: if Project URL is `https://alpudhhsmgtpmgpjfuqs.supabase.co`, use  
   `https://alpudhhsmgtpmgpjfuqs.supabase.co/auth/v1/callback`

6. Copy the **Client ID** and **Client secret**.

> Do **not** put the Lovable site URL in Google redirect URIs. Google redirects to Supabase; Supabase redirects back to your app.

### 2. Supabase Dashboard — Google provider

1. Supabase project → **Authentication → Providers → Google**.
2. Turn **Google enabled** on.
3. Paste **Client ID** and **Client secret** from Google Cloud → **Save**.

### 3. Supabase Dashboard — URL configuration

1. **Authentication → URL Configuration**.
2. **Site URL** — your primary live URL (custom domain when ready, or Lovable publish URL until then).
3. **Redirect URLs** — add every URL users may sign in from (one per line):

   ```
   https://your-domain.com/auth/callback
   https://your-project.lovable.app/auth/callback
   http://localhost:8080/auth/callback
   ```

   Replace with your real domain and Lovable preview URL. Include `www` if you use it (e.g. `https://www.your-domain.com/auth/callback`).

4. Save.

### 4. Test

1. Open the live (or preview) site → **Sign in** → **Continue with Google**.
2. Complete Google login → you should land on `/auth/callback` then the dashboard.
3. If it fails: check browser URL for errors; verify redirect URI in Google matches Supabase callback exactly; verify your site URL is listed in Supabase Redirect URLs.

Local development: see [docs/LOCAL_DB_SETUP.md](./docs/LOCAL_DB_SETUP.md) (Google via `supabase/config.toml` + `.env.supabase`).

---

## Step 6: Configure Stripe and email

Payments and receipts run through **Supabase Edge Functions**, not Lovable.

### Stripe

1. [Stripe Dashboard](https://dashboard.stripe.com) → **Developers → Webhooks** → **Add endpoint**:
   ```
   https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook
   ```
2. Subscribe to: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `invoice.paid`, `customer.subscription.deleted`, `customer.subscription.updated`.
3. Copy the **Signing secret** (`whsec_...`) → set as `STRIPE_WEBHOOK_SECRET` in Supabase Edge Function secrets (Step 4).
4. Update Stripe Checkout / Customer portal return URLs if they still point at the old domain.
5. Remove or disable old webhooks pointing at the self-hosted server.

### Resend

1. Confirm `RESEND_API_KEY` is set in Supabase secrets.
2. Verify SPF, DKIM, DMARC DNS records for your sending domain at your registrar.

---

## Step 7: Move existing data (if users already on old server)

Skip this step if launching fresh with no live users.

1. Schedule a **maintenance window** (2–4 hours). Show “Upgrading — back soon” on the old site.
2. Export data from the old Postgres database (users, profiles, applications, opportunities, etc.).
3. Import into Supabase. Auth users may need Supabase migration tools or a password-reset email to users.
4. Copy files from old storage into Supabase Storage buckets (`receipts`, `application-docs`, etc.).
5. Keep a backup of the old database for at least 30 days.

---

## Step 8: Custom domain

**Time:** 15 minutes – 48 hours (DNS propagation)

1. Lovable → **Project Settings → Domains** → add your domain (e.g. `maali.co`, `www.maali.co`).
2. Copy the DNS records Lovable provides.
3. At your **domain registrar**, replace old server DNS with Lovable’s records.
4. Wait for DNS to propagate. Confirm HTTPS (padlock) on the domain.
5. Update `VITE_SITE_URL` in Lovable and `SITE_URL` in Supabase secrets to `https://your-domain.com`.
6. **Publish** again in Lovable.

Point the domain to **Lovable**, not Supabase. The API stays on `*.supabase.co`.

---

## Step 9: Test before go-live

- [ ] Homepage loads on custom domain (HTTPS)
- [ ] New user sign-up + verification email
- [ ] **Google sign-in** (Continue with Google → lands on dashboard)
- [ ] Existing user log-in (if data migrated)
- [ ] Browse opportunities
- [ ] Application: draft → submit
- [ ] Membership payment (Stripe test mode first if possible)
- [ ] Payment receipt email received
- [ ] Admin dashboard shows applications
- [ ] Reviewer sees assigned application after payment
- [ ] Document upload on application

---

## Step 10: Shut down self-hosted server

Only after Step 9 passes:

- [ ] DNS points to Lovable (verify with registrar)
- [ ] Final backup exported from old server
- [ ] Old hosting / VPS subscription cancelled
- [ ] Old Stripe webhook removed
- [ ] Lovable + Supabase login details stored securely for the team

---

## Monthly cost (after migration)

| Service | Plan | Cost |
|---------|------|------|
| Lovable | Pro | $25/mo |
| Supabase | Pro | $25/mo |
| Resend | Free → Pro | $0–20/mo |
| Stripe | Per transaction | 2.9% + 30¢ |
| Domain | Registrar | ~$10–20/yr |
| **Fixed total** | | **~$50/mo** + Stripe fees |

No separate website server bill.

---

## Environment variables reference

**Lovable (frontend — safe in browser)**

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_SITE_URL
VITE_STRIPE_PUBLISHABLE_KEY
VITE_POSTHOG_KEY          (if used)
VITE_SENTRY_DSN           (if used)
```

**Supabase Edge Function secrets (never in frontend)**

```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
SITE_URL
INTERNAL_EMAIL_SECRET
FROM_EMAIL
SUPABASE_SERVICE_ROLE_KEY
```

---

## FAQ

**Do we still need GitHub?**  
Yes. GitHub holds the code. Lovable syncs with it on every publish.

**Can we edit the site in Lovable?**  
Yes for UI and copy. Database schema, payments, and backend logic live in Supabase and the repo.

**Will users lose accounts?**  
Not if Step 7 is done correctly. Otherwise plan a maintenance window or password reset.

**Something breaks after go-live?**  
Keep old server backup 30 days. Check Stripe webhook logs and Supabase → Edge Functions → Logs. DNS can temporarily point back to old server in emergency.

**Where to log in**

| Task | URL |
|------|-----|
| Publish website | [lovable.dev](https://lovable.dev) |
| Database, auth, files | [supabase.com/dashboard](https://supabase.com/dashboard) |
| Payments | [dashboard.stripe.com](https://dashboard.stripe.com) |
| Email | [resend.com](https://resend.com) |
| Domain DNS | Your registrar |

---

**Related:** [README.md](./README.md), [docs/STRIPE_SETUP.md](./docs/STRIPE_SETUP.md), [migration-lovable-to-vercel.md](./migration-lovable-to-vercel.md) (opposite direction)
