

## Plan: Add "Partner" Role with Dedicated Portal

### Overview
Add a new `partner` role to the system. Partners can log in, create/manage their own projects (opportunities), view metrics about their projects, and download applications for their projects.

### 1. Database Migration

**Add `partner` to the `user_role` enum:**
```sql
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'partner';
```

**Update RLS policies on `projects` table** to allow partners to manage their own projects:
- INSERT: `get_user_role(auth.uid()) = 'partner' AND created_by = auth.uid()`
- UPDATE: same pattern
- SELECT: partners can see their own projects (already public for SELECT)
- No DELETE for partners (admin only)

**Update RLS on `applications` table** so partners can view applications for their own projects:
- New SELECT policy: partner role + application's `project_id` matches a project where `created_by = auth.uid()`

**Update RLS on `application_documents` table** similarly for document download access.

### 2. Update `get_user_role` function
No change needed -- it already returns `role::text` from profiles.

### 3. Frontend: Role System Updates

**Files to update:**
- `src/hooks/useUserRole.ts` -- add `"partner"` to `UserRole` type
- `src/components/RoleBasedRoute.tsx` -- add `"partner"` to `allowedRoles` type, add `/partner` to `getDashboardForRole`, add redirect logic for `/partner` routes

### 4. Frontend: Partner Layout & Pages

**New files to create:**

- `src/components/partner/PartnerLayout.tsx` -- sidebar layout (modeled after ReviewerLayout) with menu items: Dashboard, Projects, Settings
- `src/pages/partner/Dashboard.tsx` -- overview with stats (total projects, total applications, pending/approved counts)
- `src/pages/partner/Projects.tsx` -- list of partner's own projects
- `src/pages/partner/ProjectForm.tsx` -- create/edit project form (reuse schema from admin ProjectForm, scoped to partner's `created_by`)
- `src/pages/partner/ProjectDetails.tsx` -- view project details + application metrics
- `src/pages/partner/ProjectApplications.tsx` -- list applications for a project with download capability
- `src/pages/partner/Settings.tsx` -- basic settings page

### 5. Frontend: Partner Hooks

- `src/hooks/usePartnerProjects.ts` -- fetch projects where `created_by = user.id`, plus create/update mutations
- `src/hooks/usePartnerStats.ts` -- aggregate stats for partner's projects
- `src/hooks/usePartnerApplications.ts` -- fetch applications for partner's projects with CSV download utility

### 6. App.tsx Route Registration

Add lazy imports and routes under `/partner/*` path, wrapped with `<RoleBasedRoute allowedRoles={["partner", "admin"]}>`.

### 7. Admin: Assign Partner Role

Update the `manage-user` edge function and admin user management UI to support assigning the `partner` role.

### Technical Details

- The `projects` table already has a `created_by` column, which will be used to scope partner access
- RLS policies use `get_user_role()` (SECURITY DEFINER, bypasses RLS) -- same pattern for partner policies
- The `applications` table references `project_id`, enabling the join for partner access
- CSV download for applications will be a client-side utility that fetches data and generates a downloadable file

### Estimated Scope
- 1 database migration (enum + RLS policies)
- ~8 new frontend files (layout + pages + hooks)
- ~5 existing files updated (role types, routing, edge function)

