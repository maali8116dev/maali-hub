
# Plan: Fix MultiStepApplicationForm Integration Test

## Problem Analysis

After reviewing the test file and the component implementation, I've identified several issues causing test failures:

### Issue 1: Mock `useProjects` Return Structure Mismatch
The test mocks `useProjects` to return:
```typescript
{
  data: [mockProject],
  isLoading: false,
  isError: false,
}
```

However, the actual `useProjects` hook returns a paginated structure with TanStack Query:
```typescript
{
  data: { projects: [...], total: number, page: number, ... },
  isLoading: boolean,
  isError: boolean,
  ...
}
```

### Issue 2: Missing Mock for `createNotification` Function
The component imports and uses `createNotification` from `@/hooks/useNotifications`, but this is not mocked in the test file. This will cause runtime errors during submission tests.

### Issue 3: Zustand Store State Persistence Between Tests
The `useApplicationFormStore` uses `persist` middleware which stores state in localStorage. Between tests, this state isn't being cleared, causing tests to start with unexpected initial state (wrong step number, pre-filled data, etc.).

### Issue 4: Missing `supabase.auth.getUser` Mock Return Value
The mock for `supabase.auth.getUser` returns `vi.fn()` but doesn't specify a return value. The component calls `await supabase.auth.getUser()` and expects `{ data: { user } }`.

### Issue 5: Incomplete Mock Chain for Supabase Queries
The mock query chain doesn't properly handle all the chained methods used in the component, especially:
- `.select().single()` chain (returns different from `.select()` alone)
- The `.rpc()` method for reviewer assignment

### Issue 6: Test Relies on `getByRole('combobox', { name: /Applicant Type/i })`
Some tests use this selector which may fail because Radix Select doesn't expose an accessible name on the trigger in the same way. The first test correctly gets all comboboxes and uses index, but later tests try to use the name selector inconsistently.

---

## Solution

### Changes to `src/components/application/__tests__/MultiStepApplicationForm.integration.test.tsx`

1. **Add mock for `createNotification`** in the mock section:
   ```typescript
   vi.mock('@/hooks/useNotifications', () => ({
     createNotification: vi.fn().mockResolvedValue(undefined),
   }));
   ```

2. **Fix `useProjects` mock return structure** to match the actual hook:
   ```typescript
   (useProjects as any).mockReturnValue({
     data: {
       projects: [mockProject],
       total: 1,
       page: 1,
       itemsPerPage: 9,
       totalPages: 1,
     },
     isLoading: false,
     isError: false,
   });
   ```

3. **Add proper `supabase.auth.getUser` mock** that returns the expected structure:
   ```typescript
   (supabase.auth.getUser as any).mockResolvedValue({
     data: { user: mockUser },
     error: null,
   });
   ```

4. **Reset the Zustand store before each test** by adding to `beforeEach`:
   ```typescript
   import { useApplicationFormStore } from '@/stores/applicationForm';

   beforeEach(() => {
     // Clear localStorage to reset Zustand persisted state
     localStorage.clear();
     // Reset the store state
     useApplicationFormStore.getState().reset();
     // ... rest of beforeEach
   });
   ```

5. **Add `rpc` method to Supabase mock**:
   ```typescript
   (supabase as any).rpc = vi.fn().mockResolvedValue({ data: [], error: null });
   ```

6. **Fix inconsistent combobox selectors** - use consistent approach:
   ```typescript
   // Instead of: screen.getByRole('combobox', { name: /Applicant Type/i })
   // Use: screen.getAllByRole('combobox')[0]
   ```

7. **Enhance the mock query to handle chained methods properly**:
   ```typescript
   const createMockQuery = () => {
     const mockQuery = {
       select: vi.fn().mockReturnThis(),
       eq: vi.fn().mockReturnThis(),
       neq: vi.fn().mockReturnThis(),
       insert: vi.fn().mockReturnThis(),
       update: vi.fn().mockReturnThis(),
       delete: vi.fn().mockReturnThis(),
       in: vi.fn().mockReturnThis(),
       order: vi.fn().mockReturnThis(),
       single: vi.fn().mockResolvedValue({ data: null, error: null }),
     };
     return mockQuery;
   };
   ```

---

## Technical Details

### Files to Modify
- `src/components/application/__tests__/MultiStepApplicationForm.integration.test.tsx`

### Key Changes Summary

| Area | Current Issue | Fix |
|------|---------------|-----|
| useProjects mock | Returns `{ data: [project] }` | Return `{ data: { projects: [project], ... } }` |
| createNotification | Not mocked | Add mock returning Promise |
| Zustand store | State persists between tests | Reset store and clear localStorage in beforeEach |
| supabase.auth.getUser | No return value | Mock to return `{ data: { user }, error: null }` |
| supabase.rpc | Not mocked | Add rpc mock |
| Combobox selectors | Inconsistent naming | Use getAllByRole consistently |

### Testing Strategy
After fixing, all tests should:
1. Render the form correctly on Step 1
2. Allow navigation through steps when filling required fields
3. Handle document upload mocking correctly
4. Skip payment for free projects
5. Complete the full flow without errors
