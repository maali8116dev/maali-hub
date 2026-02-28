# Refactoring Roadmap

This document outlines the remaining refactoring opportunities identified in the codebase after implementing the quick wins (status badges, date formatting, and logger utilities).

## ✅ Completed Quick Wins

1. **Status Badge Utilities** (`src/lib/statusBadges.tsx`)
   - Centralized all status badge logic
   - Created reusable functions for application, project, and payment status badges
   - Updated all pages to use the new utilities

2. **Date Formatting Utilities** (`src/lib/dateUtils.ts`)
   - Centralized date formatting with multiple format options
   - Uses `date-fns` for consistent date handling
   - Updated all pages to use the new utilities

3. **Logger Utility** (`src/lib/logger.ts`)
   - Centralized logging with environment-aware behavior
   - Strips console calls in production
   - Provides scoped loggers for better organization

---

## 🔴 High Priority Refactoring

### 1. Consolidate AdminLayout and ReviewerLayout

**Issue:** ~90% code duplication between these two layout components.

**Files:**
- `src/components/admin/AdminLayout.tsx`
- `src/components/reviewer/ReviewerLayout.tsx`

**Solution:** Create a shared `DashboardLayout` component.

**Steps:**
1. Create `src/components/layouts/DashboardLayout.tsx`
2. Extract common layout logic (sidebar, header, footer, sign-out)
3. Accept props: `menuItems`, `panelName`, `panelIcon`, `getPageTitle`
4. Update `AdminLayout` and `ReviewerLayout` to use the shared component

**Estimated Time:** 2-3 hours

**Benefits:**
- Single source of truth for layout logic
- Easier maintenance and bug fixes
- Consistent UI across admin and reviewer panels

---

### 2. Split ProjectDetails.tsx

**Issue:** 511 lines with mixed concerns (data fetching, rendering, business logic).

**File:** `src/pages/projects/ProjectDetails.tsx`

**Solution:** Extract into focused modules.

**Steps:**
1. Create `src/hooks/useProjectDetails.ts` - Data fetching logic
2. Create `src/components/projects/ProjectInfo.tsx` - Project information display
3. Create `src/components/projects/ProjectRequirements.tsx` - Requirements/eligibility rendering
4. Create `src/components/projects/ProjectApplicationSidebar.tsx` - Application sidebar
5. Update `ProjectDetails.tsx` to orchestrate these components

**Estimated Time:** 3-4 hours

**Benefits:**
- Better separation of concerns
- Easier testing
- Improved maintainability
- Reusable components

---

### 3. Extract Duplicate List Item Rendering Logic

**Issue:** Similar patterns for rendering requirements/eligibility in `ProjectDetails.tsx` (lines 293-364).

**File:** `src/pages/projects/ProjectDetails.tsx`

**Solution:** Create a reusable component.

**Steps:**
1. Create `src/components/projects/ListItemsRenderer.tsx`
2. Support bulleted/numbered lists with icons
3. Replace duplicate code in `ProjectDetails.tsx`

**Estimated Time:** 1 hour

**Benefits:**
- DRY principle
- Consistent styling
- Easier to update list rendering logic

---

### 4. Extract Table Column Definitions

**Issue:** Similar column definitions duplicated across Applications pages.

**Files:**
- `src/pages/dashboard/Applications.tsx`
- `src/pages/reviewer/Applications.tsx`
- `src/pages/admin/Applications.tsx`

**Solution:** Create shared column definitions.

**Steps:**
1. Create `src/components/applications/applicationColumns.ts`
2. Export function `getApplicationColumns(role: 'user' | 'reviewer' | 'admin')`
3. Update all Applications pages to use the shared columns

**Estimated Time:** 2-3 hours

**Benefits:**
- Consistent column definitions
- Easier to add/remove columns
- Single source of truth

---

### 5. Extract Status Filter Logic

**Issue:** Similar status filtering logic in multiple Applications pages.

**Solution:** Create a custom hook.

**Steps:**
1. Create `src/hooks/useApplicationFilters.ts`
2. Return `filteredApplications`, `statusCounts`, `statusFilter`, `setStatusFilter`
3. Update all Applications pages to use the hook

**Estimated Time:** 1-2 hours

**Benefits:**
- Reusable filtering logic
- Consistent behavior across pages
- Easier to add new filter types

---

## 🟡 Medium Priority Refactoring

### 6. Extract Edge Function Shared Code

**Issue:** Duplicate email templates and CORS headers across Edge Functions.

**Files:**
- `supabase/functions/send-email/index.ts`
- `supabase/functions/auth-email-hook/index.ts`
- All other Edge Functions

**Solution:** 
- ✅ Already partially done (`_shared/cors.ts`)
- Extract email template to `supabase/functions/_shared/emailTemplate.ts`
- Ensure all functions use shared CORS

**Estimated Time:** 2 hours

**Benefits:**
- Consistent email styling
- Single source of truth for CORS policy
- Easier maintenance

---

### 7. Improve Type Safety

**Issue:** Widespread `as any` type assertions.

**Solution:** Gradually replace with proper types.

**Steps:**
1. Use Supabase generated types from `src/integrations/supabase/types.ts`
2. Create proper type guards
3. Add strict type checking for query results
4. Replace `as any` assertions one file at a time

**Estimated Time:** Ongoing (can be done incrementally)

**Benefits:**
- Better type safety
- Catch errors at compile time
- Improved IDE autocomplete

---

### 8. Create Reusable Empty State Configurations

**Issue:** Similar empty state patterns across pages.

**Solution:** Create configuration object.

**Steps:**
1. Create `src/lib/emptyStates.ts`
2. Export `EMPTY_STATES` object with configurations for different contexts
3. Update pages to use the configurations

**Estimated Time:** 1-2 hours

**Benefits:**
- Consistent empty states
- Easier to update messaging
- Better UX consistency

---

### 9. Extract Project Status Utilities

**Issue:** `getStatusColor`, `getStatusText` duplicated.

**Solution:** Consolidate in `src/lib/projectAvailability.ts` (already exists, but expand it).

**Estimated Time:** 30 minutes

**Benefits:**
- Single source of truth
- Consistent status handling

---

### 10. Create Shared Data Table Utilities

**Issue:** Similar sorting/filtering logic in multiple DataTable usages.

**Solution:** Create utility functions.

**Steps:**
1. Create `src/lib/tableUtils.ts`
2. Export `createSortableColumn`, `createFilterableColumn` helpers
3. Update DataTable usages to use the utilities

**Estimated Time:** 2 hours

**Benefits:**
- Consistent table behavior
- Easier to add new table features
- Reduced code duplication

---

## 🟢 Low Priority / Nice to Have

### 11. Extract Form Validation Schemas

**Issue:** Validation logic mixed with components.

**Solution:** Already partially done, but consolidate all Zod schemas in `src/lib/validation/`

**Estimated Time:** 1 hour

---

### 12. Replace Console Logging

**Issue:** 200+ `console.log` calls throughout codebase.

**Solution:** 
- ✅ Logger utility created
- Gradually replace `console.log` with `logger.log`
- Use scoped loggers for better organization

**Estimated Time:** Ongoing (can be done incrementally)

---

### 13. Create Performance Monitoring Utilities

**Issue:** No centralized performance monitoring.

**Solution:** 
- Create `src/lib/performance.ts`
- Add React Profiler wrapper
- Track component render times
- Monitor API call performance

**Estimated Time:** 2-3 hours

---

## 📊 Refactoring Priority Summary

### Immediate (Next Sprint)
1. Consolidate AdminLayout and ReviewerLayout
2. Split ProjectDetails.tsx
3. Extract table column definitions

### Short Term (Next Month)
4. Extract status filter logic
5. Extract list item rendering
6. Improve type safety (incremental)

### Long Term (Ongoing)
7. Replace console logging (incremental)
8. Extract Edge Function shared code
9. Create reusable empty states
10. Performance monitoring utilities

---

## 🎯 Success Metrics

- **Code Duplication:** Reduce by 30%+
- **File Size:** No file over 400 lines
- **Type Safety:** Reduce `as any` by 50%+
- **Maintainability:** Improve test coverage for refactored modules
- **Performance:** No performance regressions

---

## 📝 Notes

- All refactoring should be done incrementally
- Each refactoring should be tested before moving to the next
- Maintain backward compatibility where possible
- Update tests as you refactor
- Document any breaking changes

---

**Last Updated:** 2026-02-29
**Status:** Quick wins completed ✅

