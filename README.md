# Maali Opportunity Hub

A funding opportunity hub platform for African entrepreneurs to discover, apply for, and manage funding opportunities across various sectors.

## 🎯 Overview

Maali Opportunity Hub is a comprehensive platform that connects African entrepreneurs with funding opportunities. The platform enables entrepreneurs to browse projects, submit applications, track their progress, and receive funding decisions through a streamlined review process.

## ✨ Key Features

- **Project Discovery**: Browse and filter funding opportunities by category, location, and status
- **Application Management**: Multi-step application form with draft auto-save and document upload
- **Review System**: Multi-reviewer evaluation with workload balancing and conflict of interest handling
- **Admin Dashboard**: Comprehensive admin panel for managing projects, applications, reviewers, and users
- **Reviewer Dashboard**: Dedicated interface for reviewers to evaluate applications
- **User Dashboard**: Track applications, manage profile, and view notifications
- **Email Notifications**: Automated emails for application status updates, reviewer assignments, and more
- **Activity Logging**: Complete audit trail of all system actions
- **Payment Processing**: Stripe for membership subscriptions and legacy application fees
- **Draft Auto-save**: Form state in localStorage (Zustand persist); explicit saves sync to DB as `applications.is_draft`

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: shadcn/ui + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Authentication**: Supabase Auth (Email/Password + OAuth)
- **State Management**: Zustand + React Query
- **Form Handling**: React Hook Form + Zod
- **Testing**: Vitest + React Testing Library
- **Analytics**: PostHog
- **Error Tracking**: Sentry
- **Email Service**: Resend (via Supabase Edge Functions)
- **Payment**: Stripe

## 📋 Prerequisites

- Node.js 18+ (recommended: use [nvm](https://github.com/nvm-sh/nvm))
- npm or yarn
- Supabase account and project
- (Optional) Stripe account for payment processing

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd maali-opportunity-hub
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SITE_URL=http://localhost:8080
VITE_POSTHOG_KEY=your_posthog_key
VITE_POSTHOG_HOST=https://app.posthog.com
VITE_SENTRY_DSN=your_sentry_dsn
```

### 4. Set Up Supabase

#### Link Your Project

```bash
npm run supabase:login
npm run supabase:link
```

#### Start Local Supabase (Optional)

```bash
npm run supabase:start
```

#### Apply Migrations

```bash
npm run supabase:push
```

#### Generate TypeScript Types

```bash
npm run supabase:types:remote
```

### 5. Set Up Supabase Secrets

In your Supabase Dashboard, configure the following secrets for Edge Functions:

- `RESEND_API_KEY` - Resend API key for sending emails
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `SITE_URL` - Public app URL (receipt emails, notification links)
- `INTERNAL_EMAIL_SECRET` - Shared secret for internal `send-email` calls from Edge Functions
- `FROM_EMAIL` - Custom from email address (optional)

Supabase injects `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` automatically for Edge Functions.

### Google OAuth (hosted Supabase)

Required for **Sign in with Google** on the live site.

1. **Google Cloud Console** → Credentials → OAuth client (Web) → **Authorized redirect URI**:
   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```
2. **Supabase Dashboard** → **Authentication → Providers → Google** → enable, paste Client ID + secret.
3. **Authentication → URL Configuration**:
   - **Site URL** — production app URL (Lovable publish URL or custom domain)
   - **Redirect URLs** — include each app callback, e.g. `https://your-domain.com/auth/callback`, your Lovable URL + `/auth/callback`, and `http://localhost:8080/auth/callback` for local dev

Full steps: [migration-selfhosted-to-lovable.md](./migration-selfhosted-to-lovable.md) (Step 5a). Local Supabase: [docs/LOCAL_DB_SETUP.md](./docs/LOCAL_DB_SETUP.md).

### 6. Deploy Edge Functions

```bash
supabase functions deploy auth-email-hook
supabase functions deploy send-email
supabase functions deploy create-payment-intent
supabase functions deploy stripe-webhook
supabase functions deploy submit-application
supabase functions deploy rate-limited-auth
supabase functions deploy manage-user
supabase functions deploy generate-invoice
```

After deploy, point Stripe webhooks at `https://<project-ref>.supabase.co/functions/v1/stripe-webhook` and subscribe to at least: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `invoice.paid`, `customer.subscription.deleted`, `customer.subscription.updated`.

### 7. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:8080`

## 📚 Documentation

Guides live in [`docs/`](./docs/) — see [`docs/README.md`](./docs/README.md) for the full list.

- **[COOLIFY_DEPLOYMENT.md](./docs/COOLIFY_DEPLOYMENT.md)** - Coolify + self-hosted Supabase
- **[SECRETS_CHECKLIST.md](./docs/SECRETS_CHECKLIST.md)** - Env vars & secrets
- **[LOCAL_DB_SETUP.md](./docs/LOCAL_DB_SETUP.md)** - Local Supabase, OAuth, Stripe
- **[STRIPE_SETUP.md](./docs/STRIPE_SETUP.md)** - Stripe payments and webhooks
- **[REVIEW_SYSTEM.md](./docs/REVIEW_SYSTEM.md)** - Review system
- **[SEO_GUIDE.md](./docs/SEO_GUIDE.md)** - SEO
- **[MAINTENANCE_MODE.md](./docs/MAINTENANCE_MODE.md)** - Maintenance mode

## 🧪 Testing

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## 🏗️ Project Structure

```
maali-opportunity-hub/
├── src/
│   ├── components/       # React components
│   │   ├── admin/        # Admin-specific components
│   │   ├── application/  # Application form components
│   │   ├── auth/         # Authentication components
│   │   ├── dashboard/    # Dashboard layouts
│   │   ├── landing/      # Landing page components
│   │   ├── onboarding/   # Onboarding components
│   │   ├── projects/     # Project-related components
│   │   ├── reviewer/     # Reviewer-specific components
│   │   └── ui/           # Reusable UI components
│   ├── hooks/            # Custom React hooks
│   ├── integrations/     # Third-party integrations
│   ├── lib/              # Utility functions
│   ├── locales/          # i18n translation files
│   ├── pages/            # Page components
│   ├── stores/            # Zustand stores
│   └── types/             # TypeScript types
├── supabase/
│   ├── functions/        # Edge Functions
│   │   └── stripe-webhook/
│   │       ├── index.ts  # Signature verify, dedup, event router
│   │       └── handlers.ts  # Payment + subscription handlers
│   └── migrations/       # Database migrations
└── scripts/               # Utility scripts
```

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run supabase:start` - Start local Supabase
- `npm run supabase:push` - Push migrations to remote
- `npm run supabase:types:remote` - Generate TypeScript types
- `npm run seed:projects` - Seed projects data
- `npm run seed:users` - Seed users and reviewers

## 💳 Payments & Stripe Webhooks

Frontend is a Vite SPA hosted on **Lovable**. **Payment logic runs on Supabase Edge Functions**, not the Lovable frontend host.

### Flow

1. User pays via Stripe (membership subscription or legacy application fee checkout).
2. Stripe sends events to `stripe-webhook`.
3. `index.ts` verifies signature, records the event in `stripe_events`, dispatches to `handlers.ts`.
4. Handlers update memberships/transactions, generate PDF receipts, send emails, and **assign reviewers** (paid applications only).

`submit-application` does **not** assign reviewers — that happens after payment confirmation in the webhook.

### Idempotency (`stripe_events`)

Migrations: `20260528000000_stripe_events.sql`, `20260528000001_stripe_events_status.sql`

| Column | Purpose |
|--------|---------|
| `id` | Stripe event ID (PK) |
| `type` | Event type |
| `status` | `processing` → `completed` or `failed` |
| `attempts` | Retry count when Stripe redelivers after failure |
| `error` | Last handler error message |

- Duplicate delivery of a **completed** event → 200, skipped.
- Retry after **failed** handler → re-processed (Stripe gets 500 on failure).

### Stuck events (ops)

```sql
select id, type, status, attempts, error, received_at
from stripe_events
where status = 'failed'
   or (status = 'processing' and received_at < now() - interval '10 minutes');
```

## 🚢 Deployment

This project is deployed via **[Lovable](https://lovable.dev)**. The Lovable project hosts the static frontend; Supabase handles auth, database, storage, and Edge Functions.

### Deploy from Lovable

1. Open the project in Lovable.
2. Use **Share → Publish** (or the project’s publish flow) to ship frontend changes.
3. Set `VITE_SITE_URL` / Supabase secret `SITE_URL` to your published Lovable URL so emails and Stripe redirects use the correct domain.

### Local production build (optional)

```bash
npm run build
```

Output goes to `dist/` for local preview only (`npm run preview`). Production hosting is managed by Lovable.

### Supabase (required alongside Lovable)

After schema or Edge Function changes, deploy backend separately:

```bash
npm run supabase:push          # migrations
supabase functions deploy ...  # see Edge Functions list above
```

Configure Stripe webhooks against your **Supabase** function URL, not the Lovable frontend URL.

### Usage at scale (~10k users)

Supabase is usually the binding constraint — not the Lovable frontend:

| Resource | Typical risk at ~10k users |
|----------|---------------------------|
| Edge Function invocations | Low (~100k–250k/mo) |
| DB egress | Medium — unbounded list queries |
| Auth MAUs | Low |
| Storage | Low (receipt PDFs) |

Client-side egress guards: notifications capped at 50 rows + separate unread count; billing history capped at 50 transactions with explicit column projection. Admin `useFinancialData` still loads all transactions — paginate or aggregate if admin volume grows.

Receipt PDFs in a public storage bucket: anyone with the URL can download. Consider signed URLs if hot-linking becomes a cost concern.

## 🔐 Security

- Row Level Security (RLS) enabled on all database tables
- XSS protection in email templates and content rendering
- Server-side payment validation
- Dynamic origin-based CORS headers
- Rate limiting for authentication operations
- Activity logging for audit trails

## 📝 License

[Add your license here]

## 🤝 Contributing & AI agent instructions

Anyone (or any AI assistant) editing this repo should read these first:

| File | Purpose |
|------|---------|
| [`CLAUDE.md`](./CLAUDE.md) | Full coding guidelines, form patterns (`react-hook-form` + Zod + `CustomFormField`) |
| [`AGENTS.md`](./AGENTS.md) | Short agent instructions for MAALI |
| [`.cursor/rules/`](./.cursor/rules/) | Cursor-specific rules (DRY, concise output, Karpathy, etc.) |

Karpathy's four rules (summarized):

1. **Think before coding** — State assumptions. If multiple interpretations exist, surface them. Ask when unclear.
2. **Simplicity first** — Minimum code for the request. No speculative features or abstractions.
3. **Surgical changes** — Touch only what the task requires. Match existing style. Don't refactor unrelated code.
4. **Goal-driven execution** — Define verifiable success (tests, repro steps, before/after). Multi-step work: `step → verify: [check]`.

For forms: use **react-hook-form** + **Zod** + **`CustomFormField`** for every editable input (details in `CLAUDE.md`).

## 📧 Support

For support, please contact [your support email] or open an issue in the repository.

---

**Built with ❤️ for African entrepreneurs**
