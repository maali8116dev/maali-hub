# QA Code Review Report

**Project:** Maali Opportunity Hub  
**Date:** 2026-02-12  
**Scope:** Full codebase (frontend, Edge Functions, database migrations, scripts)  
**Reviewer:** LLM Code Review

> **Note (2026-02-24):** Database migrations have been consolidated. All fixes mentioned in this report have been incorporated into the consolidated migrations:
> - `20250827000000_consolidated_schema.sql` (main schema)
> - `20250827000001_storage_buckets_and_policies.sql` (storage setup)
> Individual migration file references are kept for historical context.

---

## Executive Summary

| Severity  | Count  |
| --------- | ------ |
| CRITICAL  | 4      |
| HIGH      | 6      |
| MEDIUM    | 8      |
| LOW       | 6      |
| **Total** | **24** |

The codebase has a solid foundation with RLS enabled on all tables, proper auth checks in Edge Functions, and good file validation on the client. However, there are several critical bugs (a broken storage policy, unsanitized HTML rendering, unvalidated payment amounts) and security gaps (wildcard CORS, missing `search_path` on SECURITY DEFINER functions) that need immediate attention.

---

## CRITICAL Issues

### C1. Broken Storage Policy -- Avatar Uploads Cannot Work

**File:** `supabase/migrations/20250827000002_02_user_management.sql` (lines 344-357)  
**Category:** Bug

The `"Users can upload their own avatars"` storage policy has a broken string literal due to a line-break formatting issue. The bucket name reads `'ser-avatars'` instead of `'user-avatars'`:

```350:357:supabase/migrations/20250827000002_02_user_management.sql
    bucket_id = '
ser-avatars'
    AND auth.uid()

::text =
(storage.foldername
(name))[1]
);
```

**Impact:** Users cannot upload profile avatars. Every upload attempt will be denied by RLS because the policy condition `bucket_id = '\nser-avatars'` never matches the actual bucket `user-avatars`.

**Fix:** Create a new migration to drop and recreate the policy with the correct bucket name:

```sql
DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
CREATE POLICY "Users can upload their own avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

---

### C2. XSS Vulnerability -- Unsanitized Blog HTML Content

**File:** `src/pages/BlogDetail.tsx` (line 136)  
**Category:** Security / XSS

Blog post content is rendered as raw HTML without any sanitization:

```134:137:src/pages/BlogDetail.tsx
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: blogPost.content }}
            />
```

**Impact:** If an admin account is compromised, or a malicious admin writes content, arbitrary JavaScript can be injected into the page. This could steal session tokens, redirect users, or deface the site. Even without malicious intent, pasting HTML from external sources could introduce unexpected script execution.

**Fix:** Install and use DOMPurify to sanitize HTML before rendering:

```bash
npm install dompurify @types/dompurify
```

```tsx
import DOMPurify from "dompurify";

<div
  className="prose prose-sm dark:prose-invert max-w-none"
  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(blogPost.content) }}
/>;
```

---

### C3. Payment Amount Not Server-Validated Against Project Fee

**File:** `supabase/functions/create-payment-intent/index.ts` (lines 60-70)  
**Category:** Security / Business Logic

The payment intent amount comes directly from the client request body. While there is a check for `amount > 0`, the server never validates that the amount matches the actual `application_fee` defined on the project:

```60:70:supabase/functions/create-payment-intent/index.ts
    const body: CreatePaymentIntentRequest = await req.json();

    if (!body.amount || body.amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const currency = body.currency || "usd";
    const amountInCents = Math.round(body.amount * 100); // Convert to cents
```

**Impact:** A malicious user can pay $0.01 instead of the actual application fee by modifying the request. The application would still be marked as paid.

**Fix:** Look up the project's `application_fee` from the database and validate:

```typescript
// After getting the body, validate amount against project fee
if (body.projectId) {
  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("application_fee")
    .eq("id", body.projectId)
    .single();

  if (project && parseFloat(project.application_fee) !== body.amount) {
    return new Response(
      JSON.stringify({
        error: "Amount does not match project application fee",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}
```

---

### C4. Missing `search_path` on Multiple SECURITY DEFINER Functions

**File:** `supabase/migrations/20250827000003_03_payment_system.sql`  
**Category:** Security

Several `SECURITY DEFINER` functions are missing `SET search_path = public`. These functions execute with the privileges of the function owner (typically the superuser), and without a pinned `search_path`, they are vulnerable to search_path hijacking attacks:

Affected functions:

- `ensure_single_default_payment_method()` (line 72)
- `auto_generate_invoice_number()` (line 245)
- `generate_invoice_number()` (line 222)
- `ensure_single_default_billing_address()` (line 364)

Also affected in the same file (non-SECURITY DEFINER but should be):

- `update_payment_methods_updated_at()` (line 97)
- `update_transactions_updated_at()` (line 275)
- `update_billing_addresses_updated_at()` (line 389)

**Impact:** An attacker who can create objects in a schema that precedes `public` in the search path could hijack function calls within these SECURITY DEFINER functions, executing arbitrary SQL with elevated privileges.

**Fix:** Create a migration to add `SET search_path = public` to all affected functions. For example:

```sql
CREATE OR REPLACE FUNCTION public.ensure_single_default_payment_method()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- ... existing body ...
$$;
```

---

## HIGH Issues

### H1. Wildcard CORS on All Edge Functions

**Files:** All 5 Edge Functions (`rate-limited-auth`, `auth-email-hook`, `send-email`, `manage-user`, `create-payment-intent`)  
**Category:** Security

Every Edge Function uses `"Access-Control-Allow-Origin": "*"`:

```4:6:supabase/functions/rate-limited-auth/index.ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
```

**Impact:** Any website on the internet can make cross-origin requests to these functions. While the Authorization header provides some protection, this weakens defense-in-depth and could enable CSRF-like attacks if combined with other vulnerabilities.

**Fix:** Restrict the origin to your application domain(s):

```typescript
const ALLOWED_ORIGINS = [
  "https://your-production-domain.com",
  "http://localhost:5173", // dev only
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}
```

---

### H2. Payment Metadata Override Vulnerability

**File:** `supabase/functions/create-payment-intent/index.ts` (lines 73-76)  
**Category:** Security

Client-provided metadata is spread **after** `userId`, allowing a malicious client to override the `userId`:

```73:76:supabase/functions/create-payment-intent/index.ts
    const metadata: Record<string, string> = {
      userId: user.id,
      ...body.metadata,
    };
```

**Impact:** A malicious user could send `{ metadata: { userId: "another-user-id" } }` to attribute the payment to a different user, potentially allowing them to fraudulently mark another user's application as paid.

**Fix:** Spread client metadata first, then set server-controlled fields:

```typescript
const metadata: Record<string, string> = {
  ...body.metadata,
  userId: user.id, // Server-controlled, cannot be overridden
};
```

---

### H3. Invoice Number Race Condition

**File:** `supabase/migrations/20250827000003_03_payment_system.sql` (lines 222-242)  
**Category:** Bug / Concurrency

The `generate_invoice_number()` function is not atomic:

```231:236:supabase/migrations/20250827000003_03_payment_system.sql
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM public.transactions
  WHERE invoice_number LIKE prefix || year || month || '-%';
```

**Impact:** Two concurrent transactions could calculate the same invoice number, causing a unique constraint violation or, worse, duplicate invoice numbers if the constraint is missing.

**Fix:** Use a PostgreSQL sequence or advisory lock:

```sql
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN 'INV-' || TO_CHAR(now(), 'YYYYMM') || '-' || LPAD(nextval('invoice_number_seq')::TEXT, 4, '0');
END;
$$;
```

---

### H4. `auto_generate_invoice_number` Trigger Accesses OLD on INSERT

**File:** `supabase/migrations/20250827000003_03_payment_system.sql` (lines 245-265)  
**Category:** Bug

The trigger function accesses `OLD` in conditions that run on both `INSERT` and `UPDATE`:

```254:261:supabase/migrations/20250827000003_03_payment_system.sql
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at := now();
  END IF;

  IF NEW.status = 'refunded' AND OLD.status != 'refunded' THEN
    NEW.refunded_at := now();
  END IF;
```

**Impact:** On INSERT, `OLD` is NULL, so `OLD.status != 'completed'` evaluates to NULL (not TRUE), meaning `completed_at` is never set on initial INSERT of a completed transaction. Additionally, this could cause unexpected behavior depending on PostgreSQL's handling.

**Fix:** Guard with a TG_OP check:

```sql
IF TG_OP = 'INSERT' THEN
  IF NEW.status = 'completed' THEN
    NEW.completed_at := now();
  END IF;
  IF NEW.status = 'refunded' THEN
    NEW.refunded_at := now();
  END IF;
ELSIF TG_OP = 'UPDATE' THEN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at := now();
  END IF;
  IF NEW.status = 'refunded' AND OLD.status != 'refunded' THEN
    NEW.refunded_at := now();
  END IF;
END IF;
```

---

### H5. No Server-Side File Type Validation on Storage Uploads

**File:** `src/hooks/useDocumentUpload.ts` (lines 35-40)  
**Category:** Security

File type validation only happens on the client side:

```35:40:src/hooks/useDocumentUpload.ts
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];
```

The `application-docs` storage bucket has no server-side MIME type restriction. A user bypassing the frontend (e.g., using curl or Postman) could upload executables, HTML files with scripts, or other malicious file types.

**Impact:** Malicious files could be uploaded to the storage bucket, potentially used for phishing or serving malware through signed URLs.

**Fix:** Add MIME type restrictions to the Supabase storage bucket configuration or add a storage policy that checks the file extension:

```sql
-- In bucket configuration, set allowed MIME types:
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]
WHERE id = 'application-docs';
```

---

### H6. AdminLayout Does Not Verify User Role

**File:** `src/components/admin/AdminLayout.tsx`  
**Category:** Security / Authorization

`AdminLayout` renders the full admin sidebar and interface for any authenticated user. It does not check the user's role:

```39:42:src/components/admin/AdminLayout.tsx
const AdminLayout = ({ children }: AdminLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
```

While `ProtectedRoute` provides some client-side protection and RLS protects data server-side, the admin UI itself is accessible if a user navigates directly to `/admin/*` routes.

**Impact:** Non-admin users could see the admin interface skeleton (sidebar, layout), even if data queries fail. This leaks information about admin capabilities and could confuse users.

**Fix:** Add a role check in AdminLayout that redirects non-admin users:

```tsx
const { user, profile, signOut } = useAuth();

useEffect(() => {
  if (profile && profile.role !== "admin") {
    navigate("/dashboard");
  }
}, [profile, navigate]);
```

---

## MEDIUM Issues

### M1. Email Template HTML Injection

**Files:** `supabase/functions/send-email/index.ts`, `supabase/functions/auth-email-hook/index.ts`  
**Category:** Security

User-provided data like `recipientName` is interpolated directly into HTML email templates without escaping:

```typescript
// In send-email/index.ts email templates:
<p>Dear ${recipientName},</p>
```

**Impact:** A user who registers with a name containing HTML (e.g., `<img src=x onerror=...>`) could inject HTML into emails. While email clients strip most dangerous content, some clients render basic HTML.

**Fix:** Add an HTML escaping helper:

```typescript
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
```

---

### M2. Duplicate Email Template Code Across Edge Functions

**Files:** `supabase/functions/send-email/index.ts`, `supabase/functions/auth-email-hook/index.ts`  
**Category:** Redundancy

Both functions contain nearly identical `emailTemplate()` functions with the same CSS, layout, and structure. The email types also overlap (e.g., `password_reset` exists in both files).

**Impact:** Updates to email styling or content must be made in two places. Inconsistencies can arise over time.

**Fix:** Extract the shared `emailTemplate` function and CSS into a shared module under `supabase/functions/_shared/emailTemplate.ts` that both functions import.

---

### M3. Duplicate CORS Headers Definition Across All Edge Functions

**Files:** All 5 Edge Functions  
**Category:** Redundancy

The identical `corsHeaders` object is defined in every Edge Function:

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
```

**Impact:** Any CORS policy change must be updated in 5 places. This is error-prone and increases maintenance burden.

**Fix:** Create `supabase/functions/_shared/cors.ts` and import it in all functions.

---

### M4. Missing Rate Limiting on Sensitive Edge Functions

**Files:** `create-payment-intent`, `send-email`, `manage-user`  
**Category:** Security

Only the `rate-limited-auth` function has rate limiting. The other Edge Functions accept unlimited requests from authenticated users.

**Impact:** An attacker with valid credentials could:

- Spam the email sending function
- Create excessive payment intents (potentially incurring Stripe charges)
- Flood the manage-user endpoint

**Fix:** Add rate limiting calls in these functions using the existing `check_and_increment_rate_limit` database function, or add configuration entries to `rate_limit_config` for these operation types.

---

### M5. Duplicate `updated_at` Trigger Functions

**File:** `supabase/migrations/20250827000003_03_payment_system.sql`  
**Category:** Redundancy

There are 4 separate trigger functions that all do the exact same thing (`NEW.updated_at = now(); RETURN NEW;`):

- `update_updated_at_column()` (core schema)
- `update_payment_methods_updated_at()` (line 97)
- `update_transactions_updated_at()` (line 275)
- `update_billing_addresses_updated_at()` (line 389)

**Impact:** Unnecessary code duplication. All triggers could reuse `update_updated_at_column()`.

**Fix:** In a new migration, reassign the triggers to use the shared function:

```sql
DROP TRIGGER IF EXISTS update_payment_methods_updated_at ON public.payment_methods;
CREATE TRIGGER update_payment_methods_updated_at
BEFORE UPDATE ON public.payment_methods
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- Repeat for transactions and billing_addresses
```

---

### M6. Hardcoded Supabase Credentials as Fallback Values

**Files:** `src/integrations/supabase/client.ts`, `src/lib/rateLimitedAuth.ts`, and multiple test files  
**Category:** Security / Best Practice

Production Supabase URL and anon key are hardcoded as fallback values:

```6:7:src/integrations/supabase/client.ts
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://alpudhhsmgtpmgpjfuqs.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_x9j94wxK7OqIvyNh0eN5hw_uCBviZiZ";
```

**Impact:** While anon keys are designed to be public (RLS protects data), hardcoding them in source code means they appear in git history forever and make key rotation difficult. The production URL is also leaked to anyone who reads the source.

**Fix:** Remove fallback values and fail loudly if env vars are missing:

```typescript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("Missing Supabase environment variables");
}
```

---

### M7. AdminLayout and ReviewerLayout Code Duplication

**Files:** `src/components/admin/AdminLayout.tsx`, `src/components/reviewer/ReviewerLayout.tsx`  
**Category:** Redundancy

These two components share approximately 90% of their code (sidebar structure, header, footer, sign-out logic). The only differences are the menu items, title, icon, and page title logic.

**Impact:** Any layout bug fix or UI improvement must be applied in both files.

**Fix:** Extract a shared `DashboardLayout` component that accepts `menuItems`, `panelName`, `panelIcon`, and `getPageTitle` as props.

---

### M8. `initRateLimitConfig()` Called at Module Import Time

**File:** `src/lib/rateLimits.ts` (line 131)  
**Category:** Code Quality / Side Effect

The function `initRateLimitConfig()` is called immediately when the module is imported, making an async Supabase query as a side effect of importing:

```typescript
// Call on app startup
initRateLimitConfig();
```

**Impact:** This causes a network request on every module import (including tests), makes the initialization order unpredictable, and makes it impossible to handle errors properly. Test files that import this module will trigger real database calls.

**Fix:** Remove the auto-call and instead call `initRateLimitConfig()` explicitly in `App.tsx` or `main.tsx` during app initialization.

---

## LOW Issues

### L1. Excessive Console Logging in Production Code

**Files:** 200+ instances across `src/` directory  
**Category:** Code Quality

The codebase contains extensive `console.log`, `console.warn`, and `console.error` calls throughout production code.

**Impact:** Log noise in production, potential information leakage, and performance overhead.

**Fix:** Replace with a logging utility that can be configured per environment, or strip console calls in production builds using a Vite plugin.

---

### L2. Widespread `as any` Type Assertions

**Files:** Multiple files across `src/hooks/`, `src/pages/`, `src/components/`  
**Category:** Type Safety

Extensive use of `as any` bypasses TypeScript's type checking, particularly in hook implementations and Supabase query results.

**Impact:** Type errors go undetected at compile time, leading to potential runtime errors.

**Fix:** Gradually replace `as any` with proper types. Use Supabase's generated types from the database schema.

---

### L3. Webhook Error Response Leaks Internal Details

**File:** `supabase/functions/stripe-webhook/index.ts` (lines 76-81)  
**Category:** Security

```76:81:supabase/functions/stripe-webhook/index.ts
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Webhook processing failed",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
```

**Impact:** Internal error messages from the database or Stripe SDK could be exposed to the caller. Stripe retries webhooks on 5xx errors, but if an attacker can trigger webhook calls, they could use error messages to map internal architecture.

**Fix:** Return a generic error message and log the details server-side:

```typescript
console.error("Error processing webhook:", error);
return new Response(JSON.stringify({ error: "Webhook processing failed" }), {
  status: 500,
  headers: { "Content-Type": "application/json" },
});
```

---

### L4. Hardcoded Stripe API Version

**Files:** `supabase/functions/create-payment-intent/index.ts`, `supabase/functions/stripe-webhook/index.ts`  
**Category:** Maintenance

```5:6:supabase/functions/create-payment-intent/index.ts
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2024-11-20.acacia",
```

**Impact:** When upgrading Stripe API versions, you must update multiple files. The version could drift between functions.

**Fix:** Move to `supabase/functions/_shared/stripe.ts`:

```typescript
export const STRIPE_API_VERSION = "2024-11-20.acacia";
```

---

### L5. Missing No-Duplicate-Application Constraint

**File:** `supabase/migrations/20250827000001_01_core_schema.sql`  
**Category:** Data Integrity

There is no unique constraint preventing a user from submitting multiple applications to the same project. The rate limiter limits submissions per time window, but does not prevent duplicates across windows.

**Impact:** A user could submit multiple applications to the same project (e.g., 3 per hour indefinitely).

**Fix:** Add a unique constraint if only one application per user per project is intended:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_unique_user_project
ON public.applications(user_id, project_id)
WHERE is_draft = false;
```

---

### L6. Stripe Webhook Missing CORS Headers

**File:** `supabase/functions/stripe-webhook/index.ts`  
**Category:** Inconsistency

Unlike all other Edge Functions, the Stripe webhook does not include CORS headers in its responses. While this is actually correct (webhooks come from Stripe's servers, not browsers), the inconsistency suggests it was an oversight rather than an intentional decision.

**Impact:** No functional impact since Stripe webhooks are server-to-server calls. This is noted for documentation purposes.

**Recommendation:** Add a comment explaining why CORS headers are intentionally omitted.

---

## Summary of Recommended Priority Actions

### Immediate (before next deploy)

1. **C1** - Fix the broken avatar upload storage policy
2. **C2** - Add DOMPurify for blog content sanitization
3. **C3** - Add server-side payment amount validation
4. **C4** - Add `SET search_path` to all SECURITY DEFINER functions
5. **H2** - Fix payment metadata override vulnerability
6. **H4** - Fix the INSERT/OLD trigger bug

### Short-term (next sprint)

7. **H1** - Restrict CORS origins on Edge Functions
8. **H3** - Fix invoice number race condition with a sequence
9. **H5** - Add server-side MIME type restrictions to storage buckets
10. **H6** - Add role verification to AdminLayout
11. **M1** - Add HTML escaping to email templates
12. **M4** - Add rate limiting to remaining Edge Functions
13. **M8** - Remove `initRateLimitConfig()` side-effect auto-call

### Medium-term (tech debt)

14. **M2, M3** - Extract shared code across Edge Functions
15. **M5** - Consolidate duplicate trigger functions
16. **M6** - Remove hardcoded credentials from source
17. **M7** - Refactor AdminLayout / ReviewerLayout into shared component
18. **L1** - Replace console logging with proper logger
19. **L2** - Reduce `as any` usage
20. **L5** - Add unique application constraint

---

_End of Report_
