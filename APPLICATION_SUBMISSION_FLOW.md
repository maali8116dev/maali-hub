# Application Submission Flow - Files Touched in Order

This document traces every file that is executed/touched when a user submits an application, in chronological order.

---

## **CLIENT-SIDE (Frontend)**

### 1. **`src/components/application/MultiStepApplicationForm.tsx`**

- **Trigger**: User clicks "Submit Application" button
- **Action**: `handleSubmit()` function (line 168)
- **Validations**:
  - Calls `validateAll()` to check form data
  - Checks `isEmailVerified` status
  - Checks `formData.projectId` exists
- **Next**: Calls `submitApplication(draftId)` from hook

### 2. **`src/hooks/useApplicationSubmission.ts`**

- **Entry Point**: `submitApplication()` function (line 140)
- **Actions**:
  - Sets `isSubmitting = true`
  - **If documents exist**: Calls `uploadDocuments()` (line 178)
  - Gets session token via `supabase.auth.getSession()` (line 241)
  - Invokes edge function `submit-application` (line 246)
  - Handles response (success/error/payment redirect)
- **Error Handling**: Calls `cleanupOrphanUploads()` on failure (line 326)

### 3. **`src/hooks/useDocumentUpload.ts`** (if documents are uploaded)

- **Entry Point**: `uploadDocuments()` function (line 206)
- **For each file**:
  - Validates file (size, type) via `validateFile()` (line 67)
  - Uploads to Supabase Storage bucket `application-docs` (line 118)
  - Creates record in `application_documents` table (line 149)
- **Returns**: Array of `UploadedDocument` objects with IDs

### 4. **`src/stores/applicationForm.ts`** (Zustand store)

- **Accessed**: Form data (`formData`, `selectedFiles`, `selectedLibraryDocIds`)
- **Updated**: `reset()` and `setDraftId(null)` called on success (lines 308-309, 319-320)

### 5. **`src/integrations/supabase/client.ts`**

- **Used**: Supabase client instance for all database/storage/auth operations

---

## **SERVER-SIDE (Edge Function)**

### 6. **`supabase/functions/submit-application/index.ts`**

- **Entry Point**: `serve()` handler (line 345)
- **Execution Order**:

#### **Step 1: Request Parsing** (line 354-364)

- Parses JSON body
- Validates request structure

#### **Step 2: Authentication** (line 366-376)

- **Calls**: `authenticateRequest()` from `_shared/auth.ts`
- Extracts JWT token from headers or body
- Validates user via `supabase.auth.getUser(token)`

#### **Step 3: Validation** (line 394-428)

- **Calls RPC**: `validate_application_submission` (line 396)
- **Database Query**: Checks project status, deadline, existing applications
- Returns: `can_submit`, `project_fee`, `project_title`, etc.

#### **Step 4: Application Creation/Update** (line 436-494)

- **If draftId exists**: Updates existing application (line 442)
- **Else**: Inserts new application (line 460)
- **Database Table**: `applications`
- Sets initial status: `pending_payment` (if fee) or `pending` (if free)

#### **Step 5: Document Linking** (line 499-514)

- **Calls**: `linkDocumentsToApplication()` helper (line 122)
- **Database Query**: Updates `application_documents` table
- Links document IDs to the created application
- Sets `is_library_document = false`

#### **Step 6: Side Effects (Fire-and-Forget)** (line 518-526)

- **Calls**: `runSideEffects()` helper (line 224)
- **Does NOT await** - runs asynchronously

#### **Step 7: Payment Checkout (if fee required)** (line 528-615)

- **If `hasFee` is true**:
  - Creates Stripe Checkout Session (line 543)
  - **External API**: Stripe API call
  - Creates transaction record in `transactions` table (line 570)
  - Returns checkout URL to client

#### **Step 8: Response** (line 619-627)

- Returns success response with `applicationId` and payment status

---

## **SHARED MODULES (Edge Function)**

### 7. **`supabase/functions/_shared/auth.ts`**

- **Called From**: `submit-application/index.ts` (line 367)
- **Functions Used**:
  - `extractToken()` - Extracts JWT from headers/body (line 66)
  - `authenticateRequest()` - Validates user (line 95)
  - `jsonResponse()` - Creates JSON response with CORS (line 136)

### 8. **`supabase/functions/_shared/cors.ts`**

- **Called From**: `_shared/auth.ts` → `jsonResponse()` (line 143)
- **Function**: `getCorsHeaders()` - Returns CORS headers (line 20)

---

## **DATABASE OPERATIONS (RPCs & Tables)**

### 9. **`supabase/migrations/20260305111039_fix_validate_application_submission_deadline_type.sql`**

- **RPC Function**: `validate_application_submission`
- **Called From**: `submit-application/index.ts` (line 396)
- **Database Tables Queried**:
  - `projects` - Gets project details, status, deadline, fee
  - `applications` - Checks for existing non-draft applications
- **Returns**: Validation result with `can_submit` boolean

### 10. **Database Table: `applications`**

- **Operation**: INSERT or UPDATE (line 442 or 460)
- **Columns Set**: All application fields + `status`, `is_draft`, `application_fee_paid`

### 11. **Database Table: `application_documents`**

- **Operation**: UPDATE (line 150-159)
- **Updates**: `application_id`, `project_id`, `is_library_document = false`
- **Condition**: Only documents owned by user and currently unlinked

### 12. **Database Table: `transactions`** (if fee required)

- **Operation**: INSERT (line 570)
- **Columns**: `user_id`, `application_id`, `status = 'pending'`, Stripe session ID

---

## **SIDE EFFECTS (Asynchronous - Not Awaited)**

### 13. **`supabase/functions/submit-application/index.ts` → `runSideEffects()`** (line 224)

- **Called**: After application creation (line 518)
- **Executes** (in order):

#### **13a. Activity Log** (line 244-255)

- **Database Table**: `activity_logs`
- **Operation**: INSERT
- **Data**: User action, application ID, project ID, metadata

#### **13b. Notification** (line 262-277)

- **Calls RPC**: `create_notification` (line 263)
- **Database Table**: `notifications`
- **Message**: Different for fee vs free applications

#### **13c. Reviewer Assignment** (line 279-338) - **Only if no fee**

- **Calls RPC**: `assign_reviewers_to_application` (line 283)
- **Database Table**: `application_assignments`
- **Assigns**: 2 reviewers (default)
- **Then**: Creates notifications for each reviewer (line 314-333)

---

## **EXTERNAL SERVICES**

### 14. **Stripe API** (if fee required)

- **Called From**: `submit-application/index.ts` (line 543)
- **Method**: `stripe.checkout.sessions.create()`
- **Returns**: Checkout session with payment URL

---

## **CLIENT-SIDE RESPONSE HANDLING**

### 15. **`src/hooks/useApplicationSubmission.ts`** (continued)

- **After Edge Function Response**:

#### **If Error** (line 262-299):

- Handles `ALREADY_APPLIED` error code → navigates to existing application
- Handles `PROJECT_CLOSED` error code → navigates to project page
- Calls `cleanupOrphanUploads()` on failure (line 269, 326)

#### **If Payment Required** (line 302-311):

- Shows toast notification
- Resets form store
- Redirects to Stripe checkout URL

#### **If Success (Free Application)** (line 314-321):

- Shows success toast
- Resets form store
- Navigates to `/dashboard/applications`

---

## **SUMMARY: Complete File Execution Order**

1. `src/components/application/MultiStepApplicationForm.tsx` - Form validation & submit trigger
2. `src/hooks/useApplicationSubmission.ts` - Main submission orchestration
3. `src/hooks/useDocumentUpload.ts` - Document uploads (if files exist)
4. `src/integrations/supabase/client.ts` - Supabase client operations
5. `supabase/functions/submit-application/index.ts` - Main edge function handler
6. `supabase/functions/_shared/auth.ts` - Authentication & response helpers
7. `supabase/functions/_shared/cors.ts` - CORS headers
8. **Database RPC**: `validate_application_submission` - Validation check
9. **Database Table**: `applications` - INSERT/UPDATE application
10. **Database Table**: `application_documents` - UPDATE document links
11. **Database Table**: `transactions` - INSERT transaction (if fee)
12. **Stripe API** - Create checkout session (if fee)
13. **Database Table**: `activity_logs` - INSERT activity log (async)
14. **Database RPC**: `create_notification` - Create user notification (async)
15. **Database RPC**: `assign_reviewers_to_application` - Assign reviewers (async, if free)
16. **Database Table**: `application_assignments` - INSERT reviewer assignments (async)
17. **Database RPC**: `create_notification` - Create reviewer notifications (async, per reviewer)
18. `src/hooks/useApplicationSubmission.ts` - Response handling & navigation
19. `src/stores/applicationForm.ts` - Form state reset

---

## **Database Tables Modified**

1. `applications` - INSERT or UPDATE
2. `application_documents` - UPDATE (link documents)
3. `transactions` - INSERT (if fee required)
4. `activity_logs` - INSERT (async)
5. `notifications` - INSERT (async, multiple)
6. `application_assignments` - INSERT (async, if free application)

---

## **External API Calls**

1. **Supabase Auth API** - `getUser(token)` - Validate JWT
2. **Supabase Storage API** - Upload files (if documents)
3. **Stripe API** - `checkout.sessions.create()` - Create payment session (if fee)

---

## **Notes**

- **Side effects** (activity logs, notifications, reviewer assignment) run asynchronously and do NOT block the response
- **Document cleanup** only happens on client-side if submission fails
- **Server-side cleanup** happens in edge function catch block
- **Payment flow** redirects user to Stripe, webhook handles completion later
