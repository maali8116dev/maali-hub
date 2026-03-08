

# KYC/ID Verification on Profile -- Plan

## Concept

Move KYC from the application form to the user profile so it's done once and reused across all applications. Add a selfie upload for visual comparison against the ID document photo.

## Database Changes

**New table: `kyc_verifications`**
- `id` (uuid, PK), `user_id` (uuid, unique, references profiles), `id_type` (enum: passport, national_id, drivers_license, business_registration), `id_number` (text), `full_name_on_id` (text)
- `id_document_url` (text -- storage path), `selfie_url` (text -- storage path)
- `status` (enum: pending, verified, rejected, expired), `rejection_reason` (text)
- `verified_by` (uuid), `verified_at` (timestamptz), `admin_notes` (text)
- `created_at`, `updated_at`
- RLS: users can insert/select/update their own (only when status is pending/rejected); admins can select/update all

**New storage bucket: `kyc-documents`** (private, not public)
- RLS: users can upload/read files in their own folder (`user_id/`); admins can read all

## Application Form Changes

- **Remove** `registrationIdNumber` field from Step 1 (`Step1ApplicantInfo.tsx`)
- **Remove** `registrationIdNumber` from `step1Schema` in `schemas.ts`
- Instead, show a read-only KYC status badge in Step 1 (or Step 7 Compliance) with a link to complete KYC on the profile page if not yet done
- Optionally block submission if KYC status is not `verified` or `pending`

## Profile Page Changes (`src/pages/dashboard/Profile.tsx`)

Add a new **"Identity Verification"** card below the Personal Information card:
- Shows current KYC status (not started, pending, verified, rejected)
- If not started or rejected: shows a form with:
  - **ID Type** dropdown (Passport, National ID, Driver's License, Business Registration)
  - **ID Number** field with basic regex validation per type
  - **Full Name as on ID** (pre-filled from profile name)
  - **ID Document Upload** (image only: JPG/PNG, max 5MB) with preview
  - **Selfie Upload** (image only: JPG/PNG, max 5MB) with instructions ("Take a clear photo of your face, similar to your ID photo")
- If pending: shows submitted info (read-only) with "Pending Review" badge
- If verified: shows green verified badge with verification date

## Admin Verification UI

Add a **KYC Verification card** to admin user details (`src/pages/admin/UserDetails.tsx`):
- Side-by-side display: ID document image vs selfie image
- ID type, masked ID number, name on ID vs profile name
- Verify / Reject buttons with notes field
- On action, updates `kyc_verifications` status

## New Files
- `src/hooks/useKycVerification.ts` -- CRUD hook for kyc_verifications + file upload to kyc-documents bucket
- `src/components/profile/KycVerificationSection.tsx` -- the profile KYC form/status component
- `src/components/admin/KycReviewCard.tsx` -- admin review card with side-by-side comparison
- Migration SQL for table, bucket, and RLS policies

## Files to Edit
- `src/pages/dashboard/Profile.tsx` -- add KycVerificationSection
- `src/components/application/form/steps/Step1ApplicantInfo.tsx` -- remove registrationIdNumber, add KYC status indicator
- `src/components/application/form/schemas.ts` -- remove registrationIdNumber from step1Schema
- `src/pages/admin/UserDetails.tsx` -- add KycReviewCard
- `src/integrations/supabase/types.ts` -- auto-updated after migration

## Validation Logic
- ID number format regex per type (passport: 6-9 alphanum, national ID: 5-20, etc.)
- Name mismatch flag: compare `full_name_on_id` vs profile `first_name + last_name` (warning to admin, not blocking)
- File restrictions: images only (JPG/PNG), max 5MB each

