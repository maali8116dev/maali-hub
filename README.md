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
- **Payment Processing**: Stripe integration for application fees (in progress)

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
- `STRIPE_SECRET_KEY` - Stripe secret key (if using payments)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret (if using payments)
- `FROM_EMAIL` - Custom from email address (optional)

### 6. Deploy Edge Functions

```bash
supabase functions deploy auth-email-hook
supabase functions deploy send-email
supabase functions deploy create-payment-intent
supabase functions deploy stripe-webhook
supabase functions deploy rate-limited-auth
supabase functions deploy manage-user
supabase functions deploy generate-invoice
```

### 7. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:8080`

## 📚 Documentation

- **[PROJECT_MANAGEMENT_SUMMARY.md](./PROJECT_MANAGEMENT_SUMMARY.md)** - Comprehensive project status and features
- **[REVIEW_SYSTEM.md](./REVIEW_SYSTEM.md)** - Review system documentation
- **[SEO_GUIDE.md](./SEO_GUIDE.md)** - SEO implementation guide
- **[DATABASE_SETUP.md](./DATABASE_SETUP.md)** - Database setup instructions
- **[BACKEND_SETUP.md](./BACKEND_SETUP.md)** - Backend configuration guide
- **[STRIPE_SETUP.md](./STRIPE_SETUP.md)** - Stripe payment integration guide
- **[SUPABASE_EMAIL_HOOK_SETUP.md](./SUPABASE_EMAIL_HOOK_SETUP.md)** - Email hook configuration
- **[MAINTENANCE_MODE.md](./MAINTENANCE_MODE.md)** - Maintenance mode configuration

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

## 🚢 Deployment

### Build for Production

```bash
npm run build
```

The production build will be in the `dist/` directory.

### Deploy to Production

The project can be deployed to any static hosting service (Vercel, Netlify, etc.) or via Lovable's built-in deployment.

## 🔐 Security

- Row Level Security (RLS) enabled on all database tables
- XSS protection in email templates and content rendering
- Server-side payment validation
- Dynamic origin-based CORS headers
- Rate limiting for authentication operations
- Activity logging for audit trails

## 📝 License

[Add your license here]

## 🤝 Contributing

[Add contribution guidelines here]

## 📧 Support

For support, please contact [your support email] or open an issue in the repository.

---

**Built with ❤️ for African entrepreneurs**
