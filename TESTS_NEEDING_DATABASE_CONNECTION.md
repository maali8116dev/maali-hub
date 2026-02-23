# Tests That Need Real Database Connections

> **Note (2026-02-24):** Database migrations have been consolidated into two files:
>
> - `20250827000000_consolidated_schema.sql` (main schema with all RPC functions)
> - `20250827000001_storage_buckets_and_policies.sql` (storage setup)
>   All RPC functions and database schema are now in the consolidated migrations.

## 📊 **Summary**

**Total Test Files**: 27  
**Currently Using Real DB**: 4 (15%)  
**Should Use Real DB**: 12 (44%)  
**Correctly Mocked**: 11 (41%)

---

## ✅ **Tests Already Using Real Database** (Keep As-Is)

These tests correctly use real Supabase connections:

1. **`src/hooks/__tests__/useNotifications.integration.test.ts`** ✅

   - Uses real Supabase client
   - Tests RPC function `create_notification`
   - **Status**: Correct

2. **`src/components/application/__tests__/documents.upload.integration.test.tsx`** ✅

   - Uses real Supabase client
   - Tests document upload to Supabase Storage
   - **Status**: Correct

3. **`src/components/application/__tests__/email.integration.test.tsx`** ✅

   - Uses real Supabase client
   - Tests Edge Function `send-email`
   - **Status**: Correct

4. **`src/hooks/__tests__/auth.validation.test.ts`** ✅ (Partial)
   - Has some real integration tests
   - **Status**: Correct (mixed approach is fine)

---

## 🔴 **HIGH PRIORITY** - Should Use Real Database

These tests mock database calls but test complex logic that would benefit from real database connections:

### 1. **`src/hooks/__tests__/useApplications.test.tsx`** 🔴

**Why**: Tests complex N+1 query pattern (applications + projects join)

- Currently mocks both `applications` and `projects` queries
- Tests data transformation and error handling
- **Benefit**: Would catch real join issues, RLS policy problems, and data transformation bugs
- **Complexity**: Medium (needs test data setup)

### 2. **`src/hooks/__tests__/useProjects.test.tsx`** 🔴

**Why**: Tests filtering, pagination, joins with categories

- Currently mocks complex query chains (select, eq, neq, ilike, or, order, range)
- Tests category joins, search, pagination
- **Benefit**: Would catch real filtering bugs, join issues, pagination edge cases
- **Complexity**: Medium (needs test projects with categories)

### 3. **`src/hooks/__tests__/useProfile.test.tsx`** 🔴

**Why**: Tests profile CRUD with fallback logic (update → insert if not exists)

- Currently mocks complex update/insert fallback pattern
- Tests PGRST116 error handling (profile doesn't exist → create)
- **Benefit**: Would catch real RLS policy issues, data transformation bugs
- **Complexity**: Low (simple profile CRUD)

### 4. **`src/hooks/__tests__/admin.hooks.test.tsx`** 🔴

**Why**: Tests RPC functions (`get_admin_applications`, `get_admin_stats`)

- Currently mocks RPC calls
- Tests admin-only access, data aggregation
- **Benefit**: Would catch RPC function bugs, RLS policy issues, aggregation errors
- **Complexity**: Medium (needs admin user setup)

### 5. **`src/hooks/__tests__/reviewer.assignment.test.tsx`** 🔴

**Why**: Tests RPC function `assign_reviewers_to_application`

- Currently mocks RPC calls
- Tests reviewer assignment logic, workload balancing
- **Benefit**: Would catch RPC function bugs, assignment logic errors
- **Complexity**: High (needs reviewers, applications, categories setup)

### 6. **`src/hooks/__tests__/reviewer.aggregation.test.tsx`** 🔴

**Why**: Tests RPC function `get_application_review_scores_with_reviewers`

- Currently mocks RPC calls
- Tests complex aggregation logic
- **Benefit**: Would catch RPC function bugs, aggregation calculation errors
- **Complexity**: High (needs review scores, assignments setup)

### 7. **`src/hooks/__tests__/reviewer.scoring.test.tsx`** 🔴

**Why**: Tests RPC function `calculate_review_score`

- Currently mocks RPC calls
- Tests scoring calculations
- **Benefit**: Would catch RPC function bugs, calculation errors
- **Complexity**: Medium (needs category rubrics setup)

### 8. **`src/hooks/__tests__/useReviewerAssignment.test.tsx`** 🔴

**Why**: Tests reviewer assignment hooks that call RPC functions

- Currently mocks RPC calls
- Tests assignment status updates, conflict handling
- **Benefit**: Would catch RPC function bugs, RLS policy issues
- **Complexity**: High (needs full reviewer system setup)

---

## 🟡 **MEDIUM PRIORITY** - Should Use Real Database

These tests would benefit from real connections but are less critical:

### 9. **`src/hooks/__tests__/auto-save-draft.test.tsx`** 🟡

**Why**: Tests draft save/load logic

- Currently mocks Supabase calls
- Tests draft creation, updates, loading
- **Benefit**: Would catch RLS policy issues, draft state bugs
- **Complexity**: Low (simple CRUD operations)
- **Note**: Already has `draft-workflow.integration.test.tsx` but it's also mocked

### 10. **`src/hooks/__tests__/draft-workflow.integration.test.tsx`** 🟡

**Why**: Named "integration" but still mocks Supabase

- Currently mocks all Supabase calls
- Tests complete draft workflow (create → save → load → submit)
- **Benefit**: Would catch real workflow bugs, state management issues
- **Complexity**: Medium (needs application setup)
- **Note**: Should be a true integration test!

### 11. **`src/hooks/__tests__/application-review-workflow.integration.test.tsx`** 🟡

**Why**: Named "integration" but still mocks Supabase

- Currently mocks all Supabase calls
- Tests complete review workflow
- **Benefit**: Would catch real workflow bugs, RPC function issues
- **Complexity**: High (needs full review system setup)
- **Note**: Should be a true integration test!

---

## 🟢 **LOW PRIORITY** - Can Stay Mocked

These tests are correctly mocked (unit tests for UI/business logic):

### Component Tests (Correctly Mocked)

- `src/components/application/__tests__/step1.applicant.test.tsx` ✅
- `src/components/application/__tests__/step2.organization.test.tsx` ✅
- `src/components/application/__tests__/step3.project.test.tsx` ✅
- `src/components/application/__tests__/review.submit.test.tsx` ✅
- `src/components/application/__tests__/documents.upload.test.tsx` ✅ (unit test, has integration version)
- `src/components/application/__tests__/happy-path.integration.test.tsx` ⚠️ (named integration but mocked - could be real)

### Page Tests (Correctly Mocked)

- `src/pages/dashboard/__tests__/Dashboard.test.tsx` ✅
- `src/pages/projects/__tests__/Projects.test.tsx` ✅
- `src/pages/reviewer/__tests__/ReviewApplication.test.tsx` ✅

### Business Logic Tests (Correctly Mocked)

- `src/lib/__tests__/rateLimitedAuth.test.ts` ✅ (tests client-side logic)
- `src/lib/__tests__/rateLimits.test.ts` ✅ (tests configuration loading)
- `src/lib/projectAvailability.test.ts` ✅ (tests date calculations)

---

## 🎯 **Recommended Action Plan**

### **Phase 1: High Priority RPC Tests** (Week 1)

Convert these to use real database connections:

1. `admin.hooks.test.tsx` - Test `get_admin_applications` and `get_admin_stats` RPCs
2. `reviewer.assignment.test.tsx` - Test `assign_reviewers_to_application` RPC
3. `reviewer.aggregation.test.tsx` - Test `get_application_review_scores_with_reviewers` RPC
4. `reviewer.scoring.test.tsx` - Test `calculate_review_score` RPC

### **Phase 2: Data Fetching Tests** (Week 2)

Convert these to use real database: 5. `useApplications.test.tsx` - Test applications + projects join 6. `useProjects.test.tsx` - Test filtering, pagination, joins 7. `useProfile.test.tsx` - Test profile CRUD with fallback

### **Phase 3: Integration Workflow Tests** (Week 3)

Convert these "integration" tests to actually use real DB:

8. `draft-workflow.integration.test.tsx` - Make it a true integration test
9. `application-review-workflow.integration.test.tsx` - Make it a true integration test
10. `auto-save-draft.test.tsx` - Add real DB version or convert existing

---

## 📝 **Implementation Pattern**

Use this pattern for converting mocked tests to real database tests:

```typescript
// Before (Mocked)
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

// After (Real Database)
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// For local testing, use Supabase local instance
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "http://127.0.0.1:54321"; // Local Supabase default
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "your-anon-key";

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Use real supabase client in tests
// Clean up test data in afterEach/afterAll
// Ensure migrations are applied: `supabase db reset` or `supabase migration up`
```

---

## ⚠️ **Important Considerations**

### **Test Data Management**

- Create test data in `beforeEach` or `beforeAll`
- Clean up test data in `afterEach` or `afterAll`
- Use unique identifiers (UUIDs, timestamps) to avoid conflicts
- Consider using a test database or test schema
- **Important**: Ensure consolidated migrations are applied before running tests
  - Run `supabase db reset` for a clean state, or
  - Run `supabase migration up` to apply migrations

### **Authentication**

- Use test user accounts for authenticated operations
- Sign in before tests that require auth
- Sign out and clean up after tests

### **RLS Policies**

- Ensure RLS policies are properly configured in the database
- Test data setup may require bypassing RLS (use service role key)
- May need to use service role key for setup/teardown
- Verify policies work correctly with test user roles (admin, reviewer, applicant)

### **Performance**

- Real DB tests are slower than mocked tests
- Consider running them separately (e.g., `npm test:integration`)
- Use test database or isolated test data

### **CI/CD**

- Ensure CI environment has access to test database
- Use environment variables for test credentials
- Consider using Supabase local development for CI (`supabase start` + `supabase db reset`)
- Run consolidated migrations before running integration tests

---

## 📊 **Current Test Coverage**

| Category                   | Mocked | Real DB | Total  |
| -------------------------- | ------ | ------- | ------ |
| RPC Function Tests         | 4      | 1       | 5      |
| Data Fetching Tests        | 3      | 0       | 3      |
| Integration Workflow Tests | 3      | 0       | 3      |
| Component/UI Tests         | 11     | 0       | 11     |
| **Total**                  | **21** | **1**   | **22** |

**Recommendation**: Convert at least the RPC function tests and integration workflow tests to use real database connections for better confidence in production behavior.
