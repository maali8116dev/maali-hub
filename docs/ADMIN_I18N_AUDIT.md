# App-wide i18n audit

Audit of **UI internationalization**, **AI-translated dynamic content**, **locale file parity**, and **DRY opportunities** across the full Maali Opportunity Hub app.

**Scope:** All routes in `src/App.tsx`, `src/pages/**`, shared `src/components/**`, `src/hooks/**`, `src/lib/**`, Supabase edge functions (email/notifications).

**Locales:** `src/locales/{en,fr,pt,de}/{common,navigation,landing,footer,dashboard}.json`

**German (`de`):** First-class locale — `src/locales/de/*` + `npm run i18n:translate-de`. `GOOGLE_CLOUD_TRANSLATE_API_KEY` powers **dynamic** AI translation (edge fns). Legal pages follow global language via `useLegalLocale()` (no per-page tabs).

**Last updated:** 2026-06-19 — legal EN/DE/FR/PT + global locale panel; email edge i18n (`email-i18n.ts`); contact uses `LEGAL_CONTACT`; public CMS chrome (blog, partners, success-stories, help); SEO/RouteSEO + Index meta; opportunity detail i18n; admin/partner project pages; translated search RPC; `browseOpportunities` terminology; `/projects` → `/opportunities` redirects; CI locale parity guard.

**Legend**

| Status | Meaning |
|--------|---------|
| **Full** | UI uses `useTranslation`; keys in en/fr/pt (or intentional DB/AI path) |
| **Partial** | Mix of i18n + hardcoded English; or i18n wired but fr/pt keys missing |
| **None** | No `useTranslation` on page/surface |
| **DB** | Content from database (source language); not static JSON |
| **AI** | Cached in entity `translations` JSONB (opportunities, FAQ, mentors, success stories; applications on-demand) |
| **Template** | In-app notifications: `metadata.template` + `params` → client `t()` (no AI) |
| **Legal** | Hardcoded legal copy (EN/DE/FR/PT panels), outside i18next; locale from global switcher |

**DB content vs UI chrome:** User-authored fields stay in DB. **AI translation** caches CMS/opportunity fields in per-entity `translations` JSONB. **Applications** use on-demand AI + cache (`applications.translations`). **Notifications** use template keys in `metadata` — not AI, not stored per locale.

**Document map**

| Section | Coverage |
|---------|----------|
| [Summary](#summary) | High-level by app zone |
| [App route matrix](#app-route-coverage-matrix) | Every route — master checklist |
| [Language detection](#language-detection-best-practice) | Browser default, no geo |
| [Static fr/pt parity](#static-ui-locale-coverage-fr--pt) | JSON file gaps |
| [Public marketing](#public-marketing--landing) | `/`, landing components |
| [Opportunities & apply](#public-opportunities--application-flow) | List, detail, multi-step form |
| [Auth & onboarding](#auth-onboarding--payments) | Sign-in, membership, Paystack |
| [Public CMS pages](#public-cms-pages-db-backed) | Blog, FAQ, mentors, etc. |
| [Legal & compliance](#legal--compliance-pages) | Terms, privacy, cookies |
| [SEO & metadata](#seo--metadata) | Titles, structured data |
| [Email & server messages](#email--server-generated-messages) | Edge functions + in-app notification templates |
| [In-app notifications](#in-app-notifications-template-i18n) | Template keys, client resolver |
| [Role dashboards](#partner-member--reviewer-dashboards-ui-i18n) | Member, partner, reviewer, admin |
| [AI translations](#ai-translations-google-cloud-translate) | Opportunity cache |
| [DRY plan](#cross-dashboard-overlap-dry-matrix) | Shared components |

---

## Summary

| Zone | UI i18n | fr/pt keys | Dynamic content |
|------|---------|------------|-----------------|
| **Landing / marketing** (`/`, nav, footer) | **Mostly done** | `landing`, `navigation`, `footer` OK | Featured opps **AI** |
| **Public opportunities** | **Mostly done** | List + detail chrome i18n’d | Detail body **AI** |
| **Application flow** (`/opportunities/:id/apply`) | **Full** | `applications.form.*` wired | Opp title **AI** |
| **Auth / onboarding / billing** | **Partial** | `Auth`, `Onboarding`, `Join` i18n’d | — |
| **Public CMS** (blog, FAQ, mentors…) | **Mostly done** | Page chrome **Full** | FAQ/mentors/stories **AI**; blog/partners body **DB** (no AI yet) |
| **Legal** (terms, privacy…) | **Legal** | EN/DE/FR/PT inline copy | Global lang switcher; `LegalLocalePanel` + `useLegalLocale` |
| **Member dashboard** | **Mostly done** | **Done** (keys) | Notifications **Template** |
| **Partner dashboard** | **Mostly done** | **Done** (keys) | Opps **AI** on list |
| **Reviewer dashboard** | **Mostly done** | **Done** (keys) | App detail **on-demand translate** |
| **Admin dashboard** | **Mostly done** | **Done** (keys) | Opps **AI**; app **on-demand translate** |
| **In-app notifications** | **Done** | `common.notifications.messages.*` en/fr/de/pt | **Template** keys in `metadata` |
| **Email (edge)** | **Partial** | `email-i18n.ts` en/fr/de/pt | `send-email` localized subjects/bodies; `Contact.tsx` passes `locale` |
| **Language detection** | **Done** | — | Browser + localStorage |

**Top gaps (app-wide priority):** (1) **same-as-EN quality pass** in fr/pt/de (`npm run i18n:check-locale` + `npm run i18n:translate-same-as-en` when API key set), (2) **CMS AI** for blog/resources/partners when wired to DB, (3) **email locale** on all callers (stripe-webhook, submit-application, invite-partner — not only contact), (4) **`<html lang>`** sync on language change, (5) **Footer** contact block still stale (not `LEGAL_CONTACT`).
---

## Language detection (best practice)

**Current behaviour** (`src/lib/i18n.ts` + `i18next-browser-languagedetector`):

| Priority | Source | Notes |
|----------|--------|-------|
| 1 | `localStorage` | Return visit — user’s last manual choice wins |
| 2 | `?lang=` query | Shareable deep links (e.g. `?lang=fr`) |
| 3 | URL path prefix | Configured; routes don’t use `/fr/...` today |
| 4 | **`navigator.language`** | **First-visit default** — browser/OS locale (`fr-FR` → `fr`) |
| 5 | `<html lang>` | Fallback |

**Not used:** geo-IP / country (France ≠ auto-French). Location alone does not change language.

**Best practice (aligned with current setup):**

- First visit → browser language if supported (`en`, `fr`, `pt`, `de`), else `en`
- Return visit → persisted choice beats detection
- Always expose language switcher (header, dashboard settings)
- Unsupported locale → `fallbackLng: 'en'`

**Optional later (not implemented):** update `<html lang>` on `i18n.changeLanguage`; `hreflang` if locale URL paths added; soft geo banner (“Switch to French?”) — not silent geo-default.

---

## Static UI locale coverage (fr / pt / de)

**Goal:** Every user-visible UI string in `t()` has matching keys in **both** `fr` and `pt` — not only English.

**Status: Key parity done (2026-06-19).** Every `en` leaf key exists in `fr`, `pt`, and `de` across all namespaces. Verify: `npm run i18n:check-locale` (exits 0).

**Remaining quality gap:** Some values still identical to English (`same as EN` in check output) — manual or patch translation, not missing keys.

### File parity (line counts, approximate)

| Namespace | `en` | `fr` | `pt` | `de` | Gap |
|-----------|------|------|------|-----|-----|
| `dashboard.json` | ~1744 | ~1744 | ~1744 | ~1744 | **Key parity OK** — run `npm run i18n:check-locale` |
| `common.json` | ~521 | ~521 | ~521 | ~521 | patches via `scripts/locale-patches.mjs` |
| `navigation.json` | ~15 | ~15 | ~15 | ~15 | OK |
| `landing.json` | ~281 | ~281 | ~279 | ~281 | OK |
| `footer.json` | ~30 | ~30 | ~30 | ~30 | OK |

**Rule in codebase:** Mirror every new key in `fr`, `pt`, and `de` locale files.

### What “full fr/pt copy” still excludes (by design)

| Type | i18n approach |
|------|----------------|
| User-authored DB content | Source language in DB; opportunities use AI `translations` JSONB |
| Brand name `"Maali"` | Usually kept as-is |
| In-app notification bodies | **Template i18n** — `metadata.template` + client `resolveNotificationText`; legacy rows fall back to stored EN |
| Email bodies | Localized in `send-email` via `data.locale` + `email-i18n.ts` (en/fr/de/pt); not all callers pass locale yet |

### Known English-only surfaces (outside dashboard rollout)

| Area | Examples |
|------|----------|
| Footer contact block | `Footer.tsx` — still hardcoded Nairobi / old email (Contact page uses `LEGAL_CONTACT`) |
| Some admin form edge copy | e.g. `PartnerForm` toasts, `ResourceForm` “Select type”, `BlogForm` placeholders |
| `DataProtection.tsx` | English only |
| OAuth callback | `OAuthCallback.tsx` — loading/error English |
| `NotFound.tsx` | English 404 |

### Recommended follow-up (fr / pt / de completeness)

1. **Same-as-EN pass** — `npm run i18n:check-locale` (parity) + `npm run i18n:translate-same-as-en` (bulk translate when API key set).
2. **CI guard** — `npm run validate:i18n` in `.github/workflows/i18n.yml` (key parity on PR).
3. **Smoke test** — switch to `fr` / `pt` / `de` on public + dashboards; note raw keys or English fallbacks.
4. **German UI** — keep `src/locales/de/*` in sync with `en` via translate script + patches.

---

## App route coverage matrix

Master checklist from `src/App.tsx`. **UI** = static chrome via i18next. **Content** = DB or AI cache.

### Public — marketing & info

| Route | Page | UI | Content | Notes |
|-------|------|-----|---------|-------|
| `/` | `Index.tsx` | **Full** | **AI** (featured) | `landing.*` + localized SEO via `SEO` |
| `/about` | `About.tsx` | **Full** | — | `landing` namespace |
| `/contact` | `Contact.tsx` | **Full** | — | `common.contactPage.*`; contact details from `LEGAL_CONTACT` |
| `/apply` | `Apply.tsx` | **Full** | — | `landing` — how to apply steps |
| `/resources` | `Resources.tsx` | **Full** | **DB** | UI i18n; resource titles/descriptions from DB |
| `/partners` | `Partners.tsx` | **Full** | **DB** | `landing.partnersPage.*`; partner names from DB |
| `/success-stories` | `SuccessStories.tsx` | **Full** | **AI** | `landing.successStoriesPage.*` + `useLocalizedSuccessStories` |
| `/blog` | `Blog.tsx` | **Full** | **DB** | `landing.blogPage.*` |
| `/blog/:id` | `BlogDetail.tsx` | **Full** | **DB** | `landing.blogPage.*` |
| `/faq` | `FAQ.tsx` | **Full** | **AI** | `landing.faqPage.*` + `useLocalizedFaqs` |
| `/mentors` | `Mentors.tsx` | **Full** | **AI** | `landing.mentorsPage.*` + `useLocalizedMentors` |
| `/help` | `Help.tsx` | **Full** | — | `landing.helpPage.*` |
| `/guide` | `Guide.tsx` | **Full** | — | `landing.guidePage.*` + `QuickLinks` help section |
| `/privacy` | `Privacy.tsx` | **Legal** | — | EN/DE/FR/PT panels; `LegalLocalePanel` + `legalMeta` titles |
| `/terms` | `Terms.tsx` | **Legal** | — | Same pattern |
| `/cookies` | `Cookies.tsx` | **Legal** | — | Same pattern |
| `/projects`, `/projects/:id` | redirects | — | — | → `/opportunities` (legacy URLs) |
| `/data-protection` | `DataProtection.tsx` | **None** | — | English |
| `*` | `NotFound.tsx` | **None** | — | English 404 |

### Public — opportunities & applications

| Route | Page | UI | Content | Notes |
|-------|------|-----|---------|-------|
| `/opportunities` | `projects/Opportunities.tsx` | **Full** | **AI** | Filters, table, empty states; `localizeOpportunityFields` |
| `/opportunities/:id` | `projects/ProjectDetails.tsx` | **Partial** | **AI** | `ProjectInfo` / `Requirements` localized; SEO via `landing`; sidebar `common` |
| `/opportunities/:id/apply` | `projects/ApplicationForm.tsx` | **Full** | **Partial** | `applications.form.*`; all steps use `useTranslation` |

### Auth, onboarding & payments

| Route | Page | UI | Notes |
|-------|------|-----|-------|
| `/auth` | `Auth.tsx` | **Full** | `common.auth.*` |
| `/auth/callback` | `OAuthCallback.tsx` | **None** | Loading/error English |
| `/onboarding` | `Onboarding.tsx` | **Full** | `common.onboarding.*` |
| `/join` | `Join.tsx` | **Full** | `common.join.*` |
| `/payment/*` | redirects | — | → onboarding |

### Member — `/dashboard/*`

| Route | Page | UI | Notes |
|-------|------|-----|-------|
| `/dashboard` | `dashboard/Dashboard.tsx` | **Full** | `dashboard.*` |
| `/dashboard/applications` | `Applications.tsx` | **Full** | |
| `/dashboard/applications/:id` | `ApplicationDetails.tsx` | **Full** | Shared cards + **on-demand translate** bar (admin/reviewer) |
| `/dashboard/documents` | `Documents.tsx` | **Partial** | Delegates to `UserDocumentLibrary` (i18n’d) |
| `/dashboard/notifications` | `Notifications.tsx` | **Full** | Thin → `NotificationsPage` |
| `/dashboard/profile` | `Profile.tsx` | **Full** | |
| `/dashboard/settings` | `Settings.tsx` | **Full** | Language `en/fr/pt/de` |
| `/dashboard/billing` | `Billing.tsx` | **Full** | Some error paths English |

### Partner — `/partner/*`

| Route | Page | UI | Content |
|-------|------|-----|---------|
| `/partner` | `partner/Dashboard.tsx` | **Full** | — |
| `/partner/opportunities` | `partner/Opportunities.tsx` | **Full** | **AI** titles via `createOpportunityColumns` |
| `/partner/opportunities/new`, `/:id/edit` | `partner/OpportunityForm.tsx` | **Partial** | Thin → `OpportunityForm` (i18n’d) |
| `/partner/opportunities/:id/applications` | `partner/OpportunityApplications.tsx` | **Full** | **AI** opp via `useLocalizedOpportunity` |
| `/partner/qualified-applicants` | `partner/QualifiedApplicants.tsx` | **Full** | |
| `/partner/notifications` | `partner/Notifications.tsx` | **Full** | Thin wrapper |
| `/partner/settings` | `partner/Settings.tsx` | **Full** | |

### Reviewer — `/reviewer/*`

| Route | Page | UI |
|-------|------|-----|
| `/reviewer` | `reviewer/Dashboard.tsx` | **Full** |
| `/reviewer/applications` | `reviewer/Applications.tsx` | **Full** |
| `/reviewer/applications/:id` | `reviewer/ReviewApplication.tsx` | **Full** | + **on-demand translate** bar |
| `/reviewer/notifications` | `reviewer/Notifications.tsx` | **Full** (wrapper) |
| `/reviewer/settings` | `reviewer/Settings.tsx` | **Full** |

### Admin — `/admin/*`

| Route | Page | UI | Content |
|-------|------|-----|---------|
| `/admin` | `admin/Dashboard.tsx` | **Full** | Activity text i18n’d |
| `/admin/opportunities` | `admin/Projects.tsx` | **Full** | **AI** table |
| `/admin/opportunities/new`, `/:id/edit` | `admin/ProjectForm.tsx` | **Partial** | Thin → `OpportunityForm` |
| `/admin/opportunities/:id` | `admin/ProjectDetails.tsx` | **Full** | **AI** | `useLocalizedOpportunity` for read view |
| `/admin/opportunities/:id/applications` | `admin/ProjectApplications.tsx` | **Full** | **AI** project title |
| `/admin/applications` | `admin/Applications.tsx` | **Full** | |
| `/admin/applications/:id` | `dashboard/ApplicationDetails.tsx` | **Full** | Shared cards + translate bar |
| `/admin/users`, `/users/:id` | `Users.tsx`, `UserDetails.tsx` | **Full** | |
| `/admin/kyc` | `admin/Kyc.tsx` | **Full** | |
| `/admin/financial` | `admin/Financial.tsx` | **Full** | |
| `/admin/inbound` | `admin/Inbound.tsx` | **Full** | |
| `/admin/notifications` | `admin/Notifications.tsx` | **Full** | wrapper |
| `/admin/sectors` | `admin/Categories.tsx` | **Full** | **DB** sector names |
| `/admin/activity-logs` | `admin/ActivityLogs.tsx` | **Full** | **DB** descriptions often EN |
| `/admin/settings` | `admin/Settings.tsx` | **Full** | |
| `/admin/review-management` | `ReviewManagement.tsx` + tabs | **Full** | `RubricForm.tsx` — no `useTranslation` on file (check parent) |
| `/admin/reviewers/:id` | `admin/ReviewerDetails.tsx` | **Full** | |
| `/admin/blog`, `/blog/new`, `/blog/:id/edit` | `Blog.tsx`, `BlogForm.tsx` | **Full** | **DB** posts |
| `/admin/partners`, forms | `Partners.tsx`, `PartnerForm.tsx` | **Partial** | Some toasts/placeholders EN |
| `/admin/faq`, forms | `FAQ.tsx`, `FAQForm.tsx` | **Full** | **DB** |
| `/admin/mentors`, forms | `Mentors.tsx`, `MentorForm.tsx` | **Full** | **DB** |
| `/admin/resources`, forms | `Resources.tsx`, `ResourceForm.tsx` | **Partial** | Some placeholders EN |
| `/admin/success-stories`, forms | `SuccessStories.tsx`, `SuccessStoryForm.tsx` | **Full** | **DB** |

*Detailed per-admin-page notes (historical) remain in [Per-page audit (admin)](#per-page-audit-admin) below.*

---

## Public marketing & landing

| Piece | Path | Status | Namespace / notes |
|-------|------|--------|-------------------|
| Navigation | `components/Navigation.tsx` | **Full** | `navigation.*`; `en/fr/pt/de` in selector |
| Footer | `components/Footer.tsx` | **Full** | `footer.*` |
| Cookie consent | `components/CookieConsent.tsx` | **Full** | `common.cookies.*` |
| Hero, benefits, how-it-works, etc. | `components/landing/*` | **Full** | `landing.*` |
| Membership CTA | `components/MembershipSection.tsx` | **Full** | `landing.*` |
| Featured opportunities | `components/landing/FeaturedProjects.tsx` | **Partial** | Card chrome i18n; opp fields **AI** |
| Homepage | `pages/Index.tsx` | **Full** | Composes i18n children; localized SEO via `landing.seo.*` |
| Language switcher | `components/ui/language-switcher.tsx` | **Full** | `en`, `fr`, `pt`, `de` |

**Gaps:** `landing.json` may still mention “English and French” only — update if marketing copy should list `pt`/`de`. Public terminology consolidated to **Browse Opportunities** (`browseOpportunities` key); legacy `/projects` redirects to `/opportunities`.

---

## Public opportunities & application flow

### Opportunity list & detail — **Partial**

| Component | i18n | AI read |
|-----------|------|---------|
| `pages/projects/Opportunities.tsx` | **Full** | `localizeOpportunityFields` |
| `components/projects/ProjectInfo.tsx` | Partial | `useLocalizedOpportunity` |
| `components/projects/ProjectRequirements.tsx` | Partial | `useLocalizedOpportunity` |
| `components/projects/ProjectApplicationSidebar.tsx` | **Full** | `common.*` |
| `pages/projects/ProjectDetails.tsx` | **Partial** | Back button, loading i18n via `landing`; SEO localized |

### Multi-step application — **Full** (UI)

| File | Status |
|------|--------|
| `pages/projects/ApplicationForm.tsx` | **Full** — `applications.form.*` |
| `components/application/MultiStepApplicationForm.tsx` | **Full** |
| `components/application/form/steps/Step1ApplicantInfo.tsx` … `Step9Submit.tsx` | **Full** — labels, Zod via `createApplicationSchema(t)` |
| `components/application/form/countries.ts` | Country names English (often kept as-is) |

**Admin/reviewer read:** On-demand AI via `translate-application` edge fn + `ApplicationTranslationBar` (originals preserved in DB).

---

## Auth, onboarding & payments

| Surface | Path | Status |
|---------|------|--------|
| Sign in / sign up | `pages/Auth.tsx` | **Full** — `common.auth.*` |
| Member onboarding + Paystack | `pages/Onboarding.tsx` | **Full** — `common.onboarding.*` |
| Join flow | `pages/Join.tsx` | **Full** — `common.join.*` |
| Profile setup wizard | `components/ProfileSetupWizard.tsx` | **Full** — `common.profileWizard.*` |
| Partner org setup | `components/partner/PartnerSetupWizard.tsx` | **Partial** — wizard i18n via locale patches |
| OAuth callback | `pages/OAuthCallback.tsx` | **None** |
| Membership gate | `components/MembershipRequiredBanner.tsx`, `MemberFeatureGate.tsx` | **Partial** / **Full** |

---

## Public CMS pages (DB-backed)

| Route | Admin CMS | Public UI | Content |
|-------|-----------|-----------|---------|
| `/blog` | i18n’d | **Full** | **DB** `blog_posts` — no AI |
| `/faq` | i18n’d + **AI on save** | **Full** | **AI** `faqs.translations` via `translate-cms` |
| `/mentors` | i18n’d + **AI on save** | **Full** | **AI** `mentors.translations` |
| `/partners` | i18n’d | **Full** | **DB** `partners` |
| `/success-stories` | i18n’d + **AI on save** | **Full** | **AI** `success_stories.translations` |
| `/resources` | i18n’d | **Full** | **DB** `resources` |

**Hooks:** `useTranslateCms` triggers translation on admin save. **Read:** `useLocalizedFaqs`, `useLocalizedMentors`, `useLocalizedSuccessStories` in `localizedContent.ts`.

---

## Legal & compliance pages

| Page | Approach | i18next? |
|------|----------|----------|
| `Privacy.tsx` | Inline EN/DE/FR/PT bodies | **No** — hardcoded legal copy |
| `Terms.tsx` | Inline EN/DE/FR/PT | **No** |
| `Cookies.tsx` | Inline EN/DE/FR/PT | **No** |
| `DataProtection.tsx` | English only | **No** |

**Implementation:** `useLegalLocale()` maps site language → legal locale. `LegalLocalePanel` renders one panel (no per-page language tabs). Page titles/updated labels in `legalMeta.ts`. Company contact single source: `legalContact.ts` (used on Contact page).

**Remaining gap:** `DataProtection.tsx` — no FR/PT/DE copy. Legal text still outside i18next JSON (by design for legal review stability).

---

## SEO & metadata

| Area | Status | Examples |
|------|--------|----------|
| `components/seo/SEO.tsx` | Consumer passes props | — |
| `pages/Index.tsx` | **Full** | `landing.seo.*` via `useTranslation` |
| `pages/projects/ProjectDetails.tsx` | **Partial** | Localized title/description when opp fields available |
| `components/seo/RouteSEO.tsx` | **Full** | Route-level defaults via `landing.seo.routes.*` |
| `<html lang>` | **Static** | Not updated on `i18n.changeLanguage` |

**Remaining:** sync `document.documentElement.lang` on language change; localized opp SEO when only `translations` JSONB has target locale.

## Email & server-generated messages

| Source | Status | Notes |
|--------|--------|-------|
| `supabase/functions/send-email/index.ts` | **Partial** | Localized via `_shared/email-i18n.ts` (en/fr/de/pt); uses `data.locale` |
| `src/lib/email.ts` | **Partial** | `locale?: string` on payloads; `Contact.tsx` passes `i18n.language` |
| In-app `notifications` table | **Template** | New rows: `metadata.template` + `params`; client `resolveNotificationText` |

**In-app writers (template metadata):**

| Writer | Templates |
|--------|-----------|
| `submit-application` | `application.submitted` |
| `stripe-webhook/handlers.ts` | `payment.confirmed`, `membership.activated`, `membership.ended`, `admin.reviewerCapacityNeeded`, `review.assigned` |
| SQL `notify_application_status_change` | `application.submitted`, `application.approved`, `application.rejected`, `application.statusPending`, `review.newApplicationRequiresReview` |
| SQL `notify_reviewer_assignment` | `review.assigned` |
| SQL `admin_update_application_status` | `application.approved`, `application.rejected` |

**Migration:** `20260619170000_notification_templates.sql` (applied). **Translated search:** `20260619180000_opportunity_translated_search.sql` (applied).

**Legacy notifications** without `metadata.template` still show stored English `title`/`message`.

**Email gap:** Pass `locale` from all email callers (stripe-webhook, submit-application, invite-partner, queue payloads) when user locale known — not only contact form.

---

## In-app notifications (template i18n)

| Piece | Path |
|-------|------|
| Client resolver | `src/lib/notificationText.ts` — `resolveNotificationText()` |
| Shared metadata helper | `supabase/functions/_shared/notifications.ts` — `buildNotificationMetadata()` |
| UI consumers | `NotificationsPage.tsx`, `NotificationsDropdown.tsx` |
| Locale keys | `common.notifications.messages.<template>.title|message` — dot templates map to nested JSON (e.g. `application.submitted` → `messages.application.submitted`) |

**Not AI** — deterministic `t()` at render time. User language from i18next; no per-user notification locale column required.

---

## Shared components inventory (app-wide)

| Component / lib | Namespace | Status |
|-----------------|-----------|--------|
| `lib/statusBadges.tsx` | `common.status.*` | **Done** |
| `lib/projectAvailability.ts` | `common.applicationWindow.*` | **Done** |
| `lib/localizedContent.ts` | — | **AI read** path |
| `hooks/useFormattedDistance.ts` | date-fns locales | **Done** |
| `components/ui/data-table.tsx` | `common.dataTable.*` | **Done** |
| `components/notifications/NotificationsPage.tsx` | `common.notifications.*` | **Done** — + `resolveNotificationText` |
| `components/dashboard/NotificationsDropdown.tsx` | `common.notifications.*` | **Done** — template resolver |
| `lib/notificationText.ts` | `common.notifications.messages.*` | **Done** |
| `lib/applicationTranslation.ts` | — | **Done** — on-demand app translate display |
| `hooks/useTranslateApplication.ts` | — | **Done** |
| `hooks/useTranslateCms.ts` | — | **Done** — FAQ, mentors, success stories |
| `components/legal/legalContact.ts` | — | **Done** — company contact (Terms-aligned) |
| `components/legal/LegalLocalePanel.tsx` | — | **Done** — legal copy by site locale |
| `hooks/useLegalLocale.ts` | — | **Done** — en/de/fr/pt |
| `components/application/shared/*` | `applications.*` | **Done** |
| `components/opportunities/OpportunityForm.tsx` | `opportunities.form.*` | **Done** |
| `components/opportunities/createOpportunityColumns.tsx` | `opportunities.table.*` | **Done** |
| `components/admin/KycReviewCard.tsx` | dashboard | **Done** |
| `components/dashboard/UserDocumentLibrary.tsx` | dashboard | **Done** |
| `components/ThemeToggle.tsx` | — | **None** (icons only — OK) |
| `components/form/CustomFormField.tsx` | — | Pass-through labels from parents |

### Layout shells

| Layout | Menu | Language switcher |
|--------|------|-------------------|
| `Navigation` (public) | **Full** | **Full** |
| `DashboardLayout` | **Full** | **Full** |
| `AdminLayout` | **Full** | **Full** |
| `PartnerLayout` | **Full** | **Full** |
| `ReviewerLayout` | **Full** | **Full** |

---

## Shell — `AdminLayout.tsx`

| Area | Status | Notes |
|------|--------|-------|
| Sidebar menu | Done | `admin.menu.*` |
| Footer links / sign out | Done | `admin.footer.*`, `header.*` |
| Desktop header title | **Done** | `getPageTitle()` covers nested admin routes |
| Mobile header | Done | Email + `admin.roleFallback` |
| Brand | N/A | `"Maali"` — usually keep as-is |

---

## Per-page audit (admin)

*Historical detail from pre-rollout scan. For current status use [App route matrix](#app-route-coverage-matrix) first; many items below are now **Done**.*

## Shared infrastructure (fix once → many pages)

| File | Status | Notes |
|------|--------|-------|
| `src/lib/statusBadges.tsx` | **Done** | `common.status.*` |
| `src/lib/projectAvailability.ts` | **Done** | `common.applicationWindow.*` |
| `src/components/ui/data-table.tsx` | **Done** | `common.dataTable.*` |
| `src/components/notifications/NotificationsPage.tsx` | **Done** | `common.notifications.*`; thin wrappers on all role routes |
| `src/components/application/shared/**` | **Done** | `applications.*` keys |
| `src/components/admin/KycReviewCard.tsx` | **Done** | i18n’d in rollout |
| `src/components/admin/PartnerLinkedUserCombobox.tsx` | **Partial** | Some placeholders still English |
| `src/hooks/useFormattedDistance.ts` | **Done** | `en` / `fr` / `pt` / `de` date-fns locales |

**Hooks — toasts** (rollout moved most to `common.toasts.*`):

| Hook | Status |
|------|--------|
| `useAdminProjects.ts` | **Done** — incl. `translationFailed` |
| `useSectors.ts` | **Done** |
| `useUsers.ts` | **Done** |
| `useFAQs.ts` | **Done** |
| `useMentors.ts` | **Done** |
| `useResources.ts` | **Done** |

---

## Per-page audit

### `/admin` — `Dashboard.tsx` — **Partial**

**Done:** Stats, quick actions, recent activity empty state, combined-event label (`adminDashboard.*`).

**Still English:**

- Page H1: hardcoded `"Admin Dashboard"` (should use `admin.pages.dashboard` or `adminDashboard.title`)
- `formatActivityDescription()` — full sentences (“submitted an application”, etc.)
- `toTitleCase(actionType)` / `entityType` in activity rows
- `formatDistanceToNow()` — no `date-fns` locale from `i18n.language`

---

### `/admin/opportunities` — `Projects.tsx` — **Partial**

**Done:** Title, subtitle, create, columns, delete dialog, empty state, action tooltips, dev translate-all (`admin.opportunitiesPage.*`).

**Still English:**

- `getProjectStatusBadge()` labels
- `getProjectApplicationStateLabel()` labels
- Opportunity type column (`capitalize` + underscore replace)
- Create/update/delete toasts via `useAdminProjects`
- `"Uncategorized"` sector fallback in hook transform

**DB:** Titles use `pickLocalizedField` when `translations` populated.

---

### `/admin/opportunities/new`, `/admin/opportunities/:id/edit` — `ProjectForm.tsx` — **None**

- Back link, page title/subtitle
- All Zod validation messages
- Form labels, placeholders, section headers
- Save/cancel, status/type selects
- Toasts from `useAdminProjects` on save

---

### `/admin/opportunities/:id` — `ProjectDetails.tsx` — **None**

- Back, View Public Page, Edit Project
- Loading / not found
- Featured badge, inline status
- Section titles: Requirements & Eligibility, Project Details, Metadata
- Field labels: Funding Amount, Deadline, Location, Applicants, Created/Updated

---

### `/admin/opportunities/:id/applications` — `ProjectApplications.tsx` — **None**

- Page title, rank-by-score copy
- Project selector, Applicants/Reviewed badges
- Table: Rank, Applicant, Avg Score, Variance, Reviews, Recommendations, Actions
- Low/Medium/High variance, N/A, View Details
- Reviewer Scores dialog, “Not submitted”

---

### `/admin/applications` — `Applications.tsx` — **None**

- Title/subtitle (“Review Applications” / “Applications”)
- Role-separation banner
- Status filters: All, Pending, Payment Pending, Under Review, Approved, Rejected
- Table headers, review progress (`completed/total`, “No reviews”)
- View Details, error/retry
- `getApplicationStatusBadge()` in status column

---

### `/admin/applications/:id` — `ApplicationDetails.tsx` — **None**

Shared with member dashboard. All chrome via `src/components/application/shared/*` — no i18n.

---

### `/admin/users` — `Users.tsx` — **None**

- Manage Users, All Users
- Columns: Name, Role, Status, Joined, Applications
- Role badges: Admin, Reviewer, Partner, Applicant
- Suspend/Activate, dialogs, empty state
- `useUsers` toasts

---

### `/admin/users/:userId` — `UserDetails.tsx` — **None**

- Back to Users, not found, No business name
- Email, Joined, Applications, Business Details, Bio
- Role Management, Select role, role options
- Change Role dialog, “You cannot change your own role”
- `KycReviewCard` (all English)

---

### `/admin/kyc` — `Kyc.tsx` — **None**

- KYC Requests, subtitle, All requests
- Columns: User, ID Type, Status, Submitted, Action
- Review, Retry, load error
- Raw status values from DB (`pending`, `verified`, …)

---

### `/admin/notifications` — `Notifications.tsx` — **Partial**

Wrapper passes English `title`/`subtitle` props.  
`NotificationsPage.tsx`: mark all read, delete all, stats, empty states, type labels, time ago, action buttons.

**DB:** Notification title/message body.

---

### `/admin/inbound` — `Inbound.tsx` — **None**

- Inbound, Contact/Newsletter tabs
- Subject labels: Funding, Application, Partnership, Technical, General
- Table headers, status filters, sheet fields (Phone, Country, Message, Admin notes)
- Save changes, Saved/Update failed toasts, search placeholders

---

### `/admin/financial` — `Financial.tsx` — **None**

- Financial Management, stat cards, Revenue Breakdown
- Filters: All Status, All Types, date ranges
- Transaction table headers, Invoice/Receipt actions, N/A
- `getPaymentStatusBadge()`, `getTypeBadge()`

---

### `/admin/sectors` — `Categories.tsx` — **Full** (page UI)

**Done:** `admin.sectorsPage.*` — forms, validation, list, dialogs, empty state.

**Gap:** `useSectors.ts` toasts still English.

**DB:** Sector names/descriptions (content).

---

### `/admin/activity-logs` — `ActivityLogs.tsx` — **None**

- Activity Logs, Recent Activity
- Filters: All Actions, Create/Update/Delete, entity types
- Date range, table headers, empty state, pagination
- Export/print toasts, CSV/print report headers

**DB:** `log.description` often English from server.

---

### `/admin/settings` — `Settings.tsx` — **None**

- Admin Settings, General Settings, Maintenance Mode
- Notifications, Application access, System Information
- Database/API status labels, Save Settings, saved toast

---

### `/admin/review-management` — **None**

| File | Still English |
|------|----------------|
| `ReviewManagement.tsx` | Title, tabs: Reviewers, Conflicts, Settings |
| `ReviewerCategoriesTab.tsx` | Workload, sectors, Add sector, search, toasts |
| `ConflictsTab.tsx` | Reviewer, Application, Reason, Declared, Unknown, N/A |
| `SettingsTab.tsx` | Reviewers per assignment, Save, invalid-value toast |
| `RubricsTab.tsx` / `RubricForm.tsx` | System Rubric, criteria, Weight/Max, validation |
| `AddCategoryForm.tsx` | Select reviewer/sector placeholders |

---

### `/admin/reviewers/:reviewerId` — `ReviewerDetails.tsx` — **None**

- Back, stats, sectors
- Reviews table: Application, Project Title, Overall, Status, Recommendation, Submitted/Assigned
- Pending/completed badges, empty/error, search placeholder

---

### `/admin/blog` — `Blog.tsx` — **None**

- Manage Blog Posts, Create Post, search, All Posts
- Published/Draft/Archived badges, actions, delete dialog, empty state  
- *(Mock data in dev)*

---

### `/admin/blog/new`, `/admin/blog/:id/edit` — `BlogForm.tsx` — **None**

- Back to Blog, labels, validation, publish/draft, save buttons

---

### `/admin/partners` — `Partners.tsx` — **None**

- Manage Partners, Add Partner
- Columns: Name, Status, Linked User, Order, Website
- Featured, Unnamed, delete dialog, fetch/delete toasts

---

### `/admin/partners/new`, `/admin/partners/:id/edit` — `PartnerForm.tsx` — **None**

- Titles, Zod messages, all labels/placeholders, invite copy, save toasts
- `PartnerLinkedUserCombobox` strings

---

### `/admin/success-stories` — `SuccessStories.tsx` — **None**

- List UI, search, delete toasts, empty/error states

---

### `/admin/success-stories/new`, `/:id/edit` — `SuccessStoryForm.tsx` — **None**

- Zod validation, titles, form fields, sector select, Create/Update Story toasts

---

### `/admin/faq` — `FAQ.tsx` — **None**

- Manage FAQs, Create FAQ, All Categories
- Published/Draft/Order badges, Unpublish/Publish tooltips, delete dialog
- `useFAQs` sonner toasts

---

### `/admin/faq/new`, `/admin/faq/:id/edit` — `FAQForm.tsx` — **None**

- Back to FAQs, labels, validation, save/cancel

---

### `/admin/mentors` — `Mentors.tsx` — **None**

- Mentor Management, stats, filters, table headers
- Published/Draft, empty state, delete confirm
- `useMentors` toasts

---

### `/admin/mentors/new`, `/:id/edit` — `MentorForm.tsx` — **None**

- Titles, Zod messages, hardcoded sector/country option labels, placeholders

---

### `/admin/resources` — `Resources.tsx` — **None**

- Subtitle, Add Resource, filters
- Columns: Title, Sector, Type, Size, Downloads, Status
- Published/Draft, action titles, delete dialog
- `useResources` toasts

---

### `/admin/resources/new`, `/admin/resources/:id` — `ResourceForm.tsx` — **None**

- Edit/Add Resource, Zod validation, upload toasts, Create/Update Resource

---

## Recommended implementation order (app-wide)

1. **Untranslated fr/pt/de copy** — keys exist; run `npm run i18n:translate-same-as-en` or manual patches for high-traffic keys
2. **Email locale propagation** — pass `locale` from stripe-webhook, submit-application, invite-partner, etc.
3. **Footer contact block** — wire `LEGAL_CONTACT` (Contact page already done)
4. **CMS AI** — blog/resources/partners when content is DB-backed on public pages
5. **`<html lang>` sync** — on `i18n.changeLanguage`
6. **DataProtection.tsx** — FR/PT/DE legal copy if required
7. ~~Public CMS page chrome~~ **Done**
8. ~~Email edge templates (core)~~ **Done** — `email-i18n.ts` + `send-email`
9. ~~Legal FR/PT + global locale~~ **Done** — `LegalLocalePanel`, no duplicate tabs
10. ~~Admin `ProjectDetails.tsx` AI read~~ **Done**
11. ~~SEO + RouteSEO + Index meta~~ **Done**
12. ~~Translated opportunity search RPC~~ **Done**
13. ~~Partner ranked applications i18n~~ **Done**
14. ~~Multi-step application form~~ **Done**
15. ~~Auth / onboarding / Join~~ **Done**
16. ~~Public FAQ / mentors / guide / contact~~ **Done**
17. ~~In-app notification template i18n~~ **Done**
18. ~~CMS AI (FAQ, mentors, success stories)~~ **Done**
19. ~~Application on-demand translate (admin/reviewer)~~ **Done**
20. ~~Dashboard shared libs, notifications page, opportunity form/table~~ **Done**
21. ~~DB migrations (`notification_templates`, `opportunity_translated_search`)~~ **Done**
22. ~~Public terminology (`browseOpportunities`, `/projects` redirects)~~ **Done**

---

## Locale key conventions (suggested)

```
admin.pages.<route>           # header titles (extend existing)
admin.menu.<key>              # sidebar (done)
admin.<page>Page.*            # per-page copy (opportunitiesPage, sectorsPage pattern)
admin.toasts.<action>         # shared mutation toasts from hooks
admin.status.<key>            # statusBadges / application states
admin.forms.<formName>.*      # Zod + labels for large forms
```

Mirror every new key in `src/locales/fr/dashboard.json` and `src/locales/pt/dashboard.json`.

---

## AI translations (Google Cloud Translate)

Dynamic content cached in DB — separate from UI i18n JSON.

### Edge functions (3)

| Function | Entity | Trigger |
|----------|--------|---------|
| `translate-opportunity` | `opportunities` | On admin/partner save |
| `translate-cms` | `faqs`, `mentors`, `success_stories` | On admin save (`useTranslateCms`) |
| `translate-application` | `applications` | **On-demand** (admin/reviewer); cache by `content_version` |

**Shared:** `supabase/functions/_shared/translate.ts` — targets `fr`, `pt`, `de`.

### Opportunities (on save)

| Piece | Notes |
|-------|-------|
| Column | `opportunities.translations` JSONB |
| Hooks | `useTranslateOpportunity`, `useAdminProjects`, `usePartnerOpportunities` |
| Read | `pickLocalizedField`, `useLocalizedOpportunity` |
| Fields | `title`, `description`, `requirements`, `eligibility_criteria` |

### CMS (on save)

| Entity | Migration | Read hook |
|--------|-----------|-----------|
| FAQs | `20260619140000_cms_translations.sql` | `useLocalizedFaqs` |
| Mentors | same | `useLocalizedMentors` |
| Success stories | `20260619150000_success_stories_translations.sql` | `useLocalizedSuccessStories` |

### Applications (on demand)

| Piece | Notes |
|-------|-------|
| Migration | `20260619160000_application_translations.sql` |
| UI | `ApplicationTranslationBar` — admin + reviewer |
| Submit | Sets `submitted_locale`; clears `translations` on resubmit |

**Cost:** Google API on write/backfill/on-demand; reads from JSONB cache.

### Where AI is **shown**

| Surface | Status |
|---------|--------|
| Public opps list + detail + featured | **Done** |
| Public `/faq`, `/mentors` | **Done** |
| Success stories content (not page chrome) | **Done** |
| Admin/partner opp tables, ranked apps | **Done** |
| Admin/reviewer application detail | **Done** — on-demand bar |
| Admin `ProjectDetails.tsx` | **Missing** |
| Search RPC | **Missing** |
| Blog, resources, partners | **No pipeline** |

### AI gaps

| Gap | Action |
|-----|--------|
| fr/pt key parity | Backfill via `i18n:translate-{locale}` + patches | **Done** |
| `ProjectDetails.tsx` | `useLocalizedOpportunity` |
| Success stories page chrome | `landing` keys |
| Blog/resources/partners | Extend `translate-cms` |
| Translated search | RPC over `translations` JSONB |

**Future priority:** `blog_posts`, `resources`, `partners`.

---

## Partner, member & reviewer dashboards (UI i18n)

*See also [App route matrix](#app-route-coverage-matrix).*

Shell layouts i18n’d; dashboard pages wired. **Key parity done** — polish untranslated values as needed.

### Layout shells

| Layout | Menu / header | Page UI (post-rollout) |
|--------|---------------|------------------------|
| `AdminLayout` | **Done** | Most admin pages use `useTranslation` |
| `PartnerLayout` | **Done** | Partner dashboard, opps, settings, qualified applicants i18n’d |
| `DashboardLayout` (member) | **Done** | Dashboard, applications, settings, notifications, profile, billing i18n’d |
| `ReviewerLayout` | **Done** | Dashboard, applications, review page, settings i18n’d |

**Caveat:** All keys present; some `t()` values may still fall back to English text until translated in JSON.

### Partner routes — **Partial** (UI wired; locale parity pending)

| Route | File | Notes |
|-------|------|-------|
| `/partner` | `partner/Dashboard.tsx` | i18n’d |
| `/partner/opportunities` | `partner/Opportunities.tsx` | Shared table + AI title via `createOpportunityColumns` |
| `/partner/opportunities/new`, `/:id/edit` | `partner/OpportunityForm.tsx` | Shared `OpportunityForm` |
| `/partner/opportunities/:id/applications` | `partner/OpportunityApplications.tsx` | i18n’d |
| `/partner/qualified-applicants` | `partner/QualifiedApplicants.tsx` | i18n’d |
| `/partner/notifications` | `partner/Notifications.tsx` | Thin wrapper → `NotificationsPage` |
| `/partner/settings` | `partner/Settings.tsx` | i18n’d |

**AI:** Partner create/update triggers translation; list reads cache via shared columns.

### Member routes — **Partial** (UI + locale parity)

| Route | File | Status |
|-------|------|--------|
| `/dashboard` | `Dashboard.tsx` | i18n’d |
| `/dashboard/applications` | `Applications.tsx` | i18n’d |
| `/dashboard/notifications` | `Notifications.tsx` | Thin wrapper → `NotificationsPage` |
| `/dashboard/settings` | `Settings.tsx` | i18n’d — `en`/`fr`/`pt`/`de` in selector |
| `/dashboard/documents` | `Documents.tsx` | Uses `UserDocumentLibrary` (i18n’d) |
| `/dashboard/profile` | `Profile.tsx` | i18n’d |
| `/dashboard/billing` | `Billing.tsx` | i18n’d |
| `/dashboard/applications/:id` | `ApplicationDetails.tsx` | Shared components i18n’d |

### Reviewer routes — **Partial** (UI wired; locale parity pending)

| Route | File |
|-------|------|
| `/reviewer` | `reviewer/Dashboard.tsx` — i18n’d |
| `/reviewer/applications` | `reviewer/Applications.tsx` — i18n’d |
| `/reviewer/applications/:id` | `reviewer/ReviewApplication.tsx` — i18n’d |
| `/reviewer/notifications` | `reviewer/Notifications.tsx` — thin wrapper |
| `/reviewer/settings` | `reviewer/Settings.tsx` — i18n’d |

---

## Cross-dashboard overlap (DRY matrix)

Same UX in multiple roles → **one implementation, one locale namespace**.

| Concern | Admin | Partner | Member | Reviewer | DRY target |
|---------|-------|---------|--------|----------|------------|
| **Shell** (sidebar, sign out, language) | `AdminLayout` | `PartnerLayout` | `DashboardLayout` | `ReviewerLayout` | `useRoleShell(role)` hook: menu keys `shell.menu.<key>`, titles `shell.pages.<key>`; layouts pass `role` only |
| **Notifications list** | `NotificationsPage` wrapper | same component | inline page (~duplicate) | inline page (~duplicate) | **One** `NotificationsPage` with i18n; all roles import it |
| **Settings** | `admin/Settings.tsx` | `partner/Settings.tsx` | `dashboard/Settings.tsx` | `reviewer/Settings.tsx` | Shared `AccountSettingsForm` + `dashboard.settings.*` keys |
| **Opportunities list** | `admin/Projects.tsx` | `partner/Opportunities.tsx` | — | — | `OpportunityAdminTable` component + `opportunities.table.*` keys; role props for actions |
| **Opportunity form** | `admin/ProjectForm.tsx` | `partner/OpportunityForm.tsx` | — | — | **Merge** → `OpportunityForm` + `opportunityForm.schema.ts` with i18n Zod |
| **Opportunity detail (read)** | `admin/ProjectDetails.tsx` | — | public `ProjectDetails` | — | `OpportunityDetailView` + AI `useLocalizedOpportunity` |
| **Ranked applications** | `admin/ProjectApplications.tsx` | `partner/OpportunityApplications.tsx` | — | — | Single `OpportunityApplicationsTable` |
| **Application detail** | `dashboard/ApplicationDetails.tsx` | — | same file | `reviewer/ReviewApplication.tsx` (partial overlap) | i18n `components/application/shared/*` once |
| **Status badges** | all tables | all tables | applications | applications | `getStatusBadge(type, status, t)` in `statusBadges.tsx` → `common.status.*` |
| **Application window labels** | admin opps table | partner opps | — | — | `projectAvailability.ts` → `common.applicationWindow.*` |
| **DataTable chrome** | used everywhere | used | — | — | Done — `common.dataTable.*` |
| **Hook toasts** | admin hooks | partner hooks | member hooks | — | `common.toasts.<entity>.<action>` |
| **AI opportunity text** | partial | missing read | public pages | review UIs | Always `pickLocalizedField` / `useLocalizedOpportunity` — never duplicate per page |
| **date-fns relative time** | activity, notifications | — | notifications | notifications | `useFormattedDistance(date)` with `i18n.language` locale |

---

## DRY implementation plan

### 1. Locale structure (single source of truth)

```
common.status.*              # opportunity, application, payment, KYC badges
common.applicationWindow.*   # open/closed labels
common.dataTable.*           # done
common.toasts.*              # all mutation toasts from hooks
common.notifications.*       # shared notifications page

opportunities.table.*        # columns, empty, search — admin + partner
opportunities.form.*         # labels, validation — admin + partner forms
opportunities.detail.*       # read-only sections — admin + public

applications.*               # list + detail chrome — member, admin, reviewer

dashboard.settings.*         # done — reuse for partner/reviewer/admin account prefs

admin.*                      # admin-only copy (financial, KYC, users, CMS…)
partner.*                    # partner-only copy (portal branding, qualified applicants)
reviewer.*                   # reviewer-only copy (scoring, conflicts)
```

**Rule:** If two roles show the same string, it lives under `common.*` or `opportunities.*` / `applications.*` — not under `admin.*` and `partner.*` separately.

### 2. Component extraction (priority)

1. **`NotificationsPage`** — add `useTranslation`; delete duplicate notification UIs in member/reviewer pages (or make them thin wrappers like admin).
2. **`statusBadges.tsx` + `projectAvailability.ts`** — accept `t` or use `useTranslation` internally.
3. **`OpportunityForm`** — merge admin `ProjectForm` + partner `OpportunityForm`; one Zod schema factory `createOpportunitySchema(t)`.
4. **`OpportunityTable`** — shared columns factory `createOpportunityColumns(t, { role, onEdit, onDelete })`.
5. **`ApplicationShared`** — i18n all `components/application/shared/*` (fixes admin + member application detail).
6. **`useLocalizedOpportunity`** — use everywhere opportunity title/description renders (partner/admin/review).

### 3. Layout DRY

Four layouts copy the same pattern (sidebar, theme toggle, language switcher, sign out). Optional refactor:

```ts
// src/components/shell/RoleDashboardLayout.tsx
<RoleDashboardLayout
  role="admin" | "partner" | "member" | "reviewer"
  menuItems={...}
  pageTitle={t(`shell.pages.${pageKey}`)}
/>
```

Menu labels: `t(\`${role}.menu.${key}\`)` today — could flatten to `shell.menus.${role}.${key}` or keep role namespaces (already mirrored in fr/pt).

### 4. AI translation DRY

| Do | Don’t |
|----|--------|
| One `localizedContent.ts` for all entities | Per-page copy of locale resolution |
| One edge function pattern per entity type | Separate translate logic per hook |
| Trigger translate in mutation hooks only | Translate on every page view |
| `invalidateOpportunityTranslationQueries` after success | Manual per-query invalidation lists |

Add `useLocalizedFields(entity, fieldMap)` when second entity (FAQ, blog) gets translations.

### 5. Rollout status (cross-dashboard)

| Phase | Status |
|-------|--------|
| `common.status.*`, badges, application window, hook toasts | **Done** |
| `NotificationsPage` + template resolver + thin role wrappers | **Done** |
| `createOpportunityColumns` + AI `pickLocalizedField` | **Done** |
| Merged `OpportunityForm` + `createOpportunitySchema(t)` | **Done** |
| Application form + shared components | **Done** |
| Application on-demand translate (admin/reviewer) | **Done** |
| CMS AI (FAQ, mentors, success stories) | **Done** |
| Admin/partner/member/reviewer page chrome | **Done** |
| Public CMS page chrome (blog, partners, stories, help) | **Done** |
| Legal EN/DE/FR/PT + global locale panel | **Done** |
| Email edge i18n (`email-i18n.ts`) | **Done** (caller locale propagation ongoing) |
| SEO / RouteSEO / Index meta | **Done** |
| Translated opportunity search RPC | **Done** |
| `browseOpportunities` terminology + `/projects` redirects | **Done** |
| **Full fr/pt/de locale JSON key parity** | **Done** — `npm run i18n:check-locale` |
| Untranslated values (same as EN) | **Ongoing** — `npm run i18n:translate-same-as-en` + manual patches |
| Blog/resources/partners AI, `RoleDashboardLayout` merge | **Deferred** |

---

*Generated from full-app codebase review. Updated 2026-06-19 (legal, email, contact, terminology, CMS chrome). Re-run `npm run i18n:check-locale` when adding `en` keys.*
