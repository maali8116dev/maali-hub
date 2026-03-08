

## Partner Onboarding UX Recommendations

### Current State
- Admin creates a partner org in `/admin/partners`, links it to a user account with the `partner` role
- Partner logs in and lands on a bare dashboard with stats (all zeros initially) and a "New Opportunity" button
- Settings page is minimal (just email + role display)
- No guided onboarding exists for partners

### Proposed Flow: Two-Phase Onboarding

**Phase 1: Admin-Side Setup**
The admin creates the partner org entry and links a user account (already built). When the admin saves, the linked user gets an email invite or notification. No changes needed here beyond what exists.

**Phase 2: Partner First-Login Experience**

When a partner user logs in for the first time (detected by checking if their linked partner org has incomplete profile data or if they haven't dismissed onboarding), show a guided setup:

1. **Partner Welcome Dialog (modal wizard, 3 steps)** -- reuse the pattern from `ProfileSetupWizard.tsx`:
   - **Step 1 - Organization Profile**: Pre-filled org name from admin, partner completes description, logo upload, website URL
   - **Step 2 - Contact Details**: Business phone, primary contact name, country/region
   - **Step 3 - First Opportunity**: Optional quick-start to create their first opportunity (title, deadline, funding amount) -- or skip

2. **Dashboard Onboarding Checklist** -- reuse the `OnboardingChecklist` pattern adapted for partners:
   - Complete organization profile
   - Upload organization logo
   - Create your first opportunity
   - Review your first application
   - Dismissible, persisted in localStorage

3. **Contextual In-App Tips** -- reuse `InAppTip` component:
   - On empty opportunities list: "Create your first opportunity to start receiving applications"
   - On dashboard with zero stats: tip explaining what each metric means
   - On first application received: tip about CSV export

### Technical Implementation

**New files:**
- `src/components/partner/PartnerSetupWizard.tsx` -- modal wizard (3 steps), modeled after `ProfileSetupWizard.tsx`
- `src/components/partner/PartnerOnboardingChecklist.tsx` -- checklist component using same pattern as `OnboardingChecklist`

**Files to edit:**
- `src/pages/partner/Dashboard.tsx` -- add `PartnerOnboardingChecklist` and `PartnerSetupWizard` (show wizard on first login)
- `src/pages/partner/Opportunities.tsx` -- add empty-state tip
- `src/hooks/usePartnerStats.ts` -- optionally expose a `isNewPartner` flag based on zero opportunities

**Detection logic:** Check if the partner's linked org entry (from `partners` table where `user_id = auth.uid()`) has a complete profile (logo, description). If incomplete, trigger the wizard. The checklist uses localStorage for dismiss state, same as the existing applicant checklist.

**No database changes required** -- the `partners` table already has all needed columns (logo_url, description, website_url). The wizard just updates the partner's own row.

### Summary
- Wizard on first login to complete org profile (3 steps)
- Persistent checklist on dashboard tracking setup progress
- Contextual tips on empty states
- All built on existing component patterns (`ProfileSetupWizard`, `OnboardingChecklist`, `InAppTip`)

