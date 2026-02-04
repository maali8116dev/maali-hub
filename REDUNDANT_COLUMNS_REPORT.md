# Database Redundant Columns Report

## Summary

This report identifies redundant columns in the database schema that store duplicate information or have been superseded by better alternatives.

---

## 🔴 High Priority Redundancies

### 1. **projects table** - Category Columns

**Location**: `supabase/migrations/20260107124324_create_projects_table.sql` + `20260131000000_create_categories_table.sql`

**Redundant Columns**:

- `category` (TEXT) - Legacy column storing category name as string
- `category_id` (INTEGER) - Foreign key to `categories` table (preferred)

**Status**:

- ✅ `category_id` is now being populated (fixed in `useAdminProjects.ts`)
- ⚠️ `category` column still exists and is being maintained for backward compatibility

**Recommendation**:

- **Short-term**: Keep both columns for backward compatibility during migration period
- **Long-term**: After ensuring all code uses `category_id`, create a migration to:
  1. Remove `category` column
  2. Update all queries to use `category_id` with JOIN to `categories` table
  3. Remove the `idx_projects_category` index (replaced by `idx_projects_category_id`)

**Impact**: Low risk - both columns are currently maintained, but `category_id` is the preferred approach

---

### 2. **reviewer_categories table** - Category Columns

**Location**: `supabase/migrations/20260130000000_create_reviewer_assignment_system.sql` + `20260131000000_create_categories_table.sql`

**Redundant Columns**:

- `category` (TEXT) - Legacy column storing category name as string
- `category_id` (INTEGER) - Foreign key to `categories` table (preferred)

**Status**:

- ✅ `category_id` was added and populated in migration
- ⚠️ `category` column still exists

**Recommendation**:

- **Short-term**: Keep both for backward compatibility
- **Long-term**: Remove `category` column after ensuring all code uses `category_id`
- Update `assign_reviewers_to_application` function to only use `category_id`

**Impact**: Low risk - function already supports both, but should migrate to `category_id` only

---

### 3. **category_rubrics table** - Category Columns

**Location**: `supabase/migrations/20260130000000_create_reviewer_assignment_system.sql` + `20260131000000_create_categories_table.sql`

**Redundant Columns**:

- `category` (TEXT) - Legacy column storing category name as string
- `category_id` (INTEGER) - Foreign key to `categories` table (preferred)

**Status**:

- ✅ `category_id` was added and populated in migration
- ⚠️ `category` column still exists and is marked as UNIQUE

**Recommendation**:

- **Short-term**: Keep both for backward compatibility
- **Long-term**:
  1. Remove UNIQUE constraint from `category` column
  2. Add UNIQUE constraint to `category_id` column
  3. Remove `category` column after migration
  4. Update all queries to use `category_id`

**Impact**: Low risk - but UNIQUE constraint on `category` should be moved to `category_id`

---

## 🟡 Medium Priority - Potential Redundancies

### 4. **profiles table** - business_sector vs role

**Location**: `supabase/migrations/20250827101831_8d15b569-7705-4300-b163-093e3b76bbc2.sql` + `20260107130000_add_user_role_enum.sql`

**Columns**:

- `business_sector` (TEXT) - Originally used for business industry sector, but also used for admin checks
- `role` (ENUM: 'admin', 'reviewer', 'applicant') - System access control role

**Status**:

- ✅ `business_sector` was historically used for admin access checks in old migrations
- ✅ `role` enum is now the preferred method for access control
- ✅ Old RLS policies using `business_sector` have been replaced (see `20260124011353_change_admin_rls_policies.sql`)

**Analysis**:

- These columns serve **different purposes**:
  - `business_sector`: User's business/industry sector (e.g., "Agriculture", "Technology")
  - `role`: System access control (admin, reviewer, applicant)
- `business_sector` was **misused** for admin checks in initial migrations, but this has been corrected

**Recommendation**:

- **Keep both columns** - they serve different purposes
- ✅ **Already cleaned up**: All RLS policies now use `get_user_role()` which checks the `role` enum
- ⚠️ **Verify**: Check application code to ensure no admin checks use `business_sector` directly

**Impact**: Low risk - database policies are correct, but should verify application code

---

## ✅ No Redundancy Found

### Other Tables Checked:

- ✅ `applications` - No redundant columns found
- ✅ `application_documents` - No redundant columns found
- ✅ `application_assignments` - No redundant columns found
- ✅ `review_scores` - No redundant columns found
- ✅ `reviewer_conflicts` - No redundant columns found
- ✅ `transactions` - No redundant columns found
- ✅ `categories` - No redundant columns found

---

## Migration Plan

### Phase 1: Audit (Current)

- ✅ Identify redundant columns
- ⏳ Verify all code uses `category_id` instead of `category`
- ⏳ Verify all admin checks use `role` instead of `business_sector`

### Phase 2: Code Migration (Recommended)

1. Update all queries to use `category_id` with JOINs
2. Update all admin access checks to use `role` enum
3. Remove any remaining references to old columns

### Phase 3: Database Cleanup (Future)

1. Remove `category` columns from:
   - `projects` table
   - `reviewer_categories` table
   - `category_rubrics` table
2. Remove old indexes on `category` columns
3. Update UNIQUE constraints to use `category_id`

---

## Notes

- The `category` columns are maintained for **backward compatibility** during the migration period
- The `get_category_id()` function provides a bridge between old and new approaches
- All new code should use `category_id` with proper foreign key relationships
- The `business_sector` vs `role` issue is more about **correct usage** than redundancy

---

## Recommendations Summary

1. **Immediate**: Continue maintaining both `category` and `category_id` during migration
2. **Short-term**: Audit codebase to ensure all new code uses `category_id`
3. **Medium-term**: Migrate all queries to use `category_id` with JOINs
4. **Long-term**: Remove `category` columns after full migration
5. **Ongoing**: Ensure `business_sector` is only used for business sector, not access control
