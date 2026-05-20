# Projects to Opportunities Migration Status

## Completed ✅

### Database Layer

1. ✅ Created ENUM types (opportunity_type, program_format, funding_type, experience_level)
2. ✅ Created opportunity_tags and opportunity_tag_map tables
3. ✅ Created opportunities table with all required fields
4. ✅ Migrated data from projects to opportunities
5. ✅ Updated foreign key references (applications.opportunity_id, application_documents.opportunity_id)
6. ✅ Created performance indexes
7. ✅ Updated triggers (update_opportunity_applicant_count)
8. ✅ Updated RLS policies for opportunities
9. ✅ Created/updated RPC functions:
   - get_opportunities_with_filters
   - get_opportunity_applications_ranked
   - get_user_applications_with_opportunities
   - get_application_details (updated)
   - validate_application_submission (updated)
   - get_eligible_reviewers_for_application (updated)
   - admin_set_application_reviewers (updated)
   - get_user_dashboard_stats (updated)

### Frontend Hooks

1. ✅ Created useOpportunities.ts (replaces useProjects.ts)
2. ✅ Created useOpportunityDetails.ts (replaces useProjectDetails.ts)
3. ✅ Updated useUserDrafts.ts (added useOpportunityDraft)
4. ✅ Updated useApplications.ts (uses opportunities)

### Utilities

1. ✅ Created opportunityAvailability.ts (replaces projectAvailability.ts)

## In Progress / Remaining 🔄

### Edge Functions

The following Edge Functions need systematic updates to replace project_id with opportunity_id:

1. **submit-application/index.ts** - Partially updated (interfaces done, needs full replacement)

   - Replace all `projectId` → `opportunityId`
   - Replace all `projectTitle` → `opportunityTitle`
   - Update RPC calls to use `p_opportunity_id`
   - Update validation function calls
   - Update metadata references

2. **stripe-webhook/index.ts** - Needs full update

   - Replace project_id references with opportunity_id
   - Update notification metadata

3. **Other Edge Functions** (lower priority, can be done incrementally):
   - generate-invoice/index.ts
   - update-application-status/index.ts
   - create-payment-intent/index.ts
   - create-checkout-session/index.ts

### Frontend Components & Pages

1. **src/pages/projects/Projects.tsx** → Rename to `Opportunities.tsx`

   - Update imports to use useOpportunities
   - Update filter UI to include new filters (opportunity_type, program_format, etc.)
   - Update route if needed

2. **src/pages/projects/ApplicationForm.tsx**

   - Update projectId → opportunityId
   - Update queries

3. **src/pages/admin/Projects.tsx** → Rename to `Opportunities.tsx`

   - Update form to include new fields
   - Add tag selection UI
   - Update all CRUD operations

4. **src/pages/admin/ProjectApplications.tsx** → Rename to `OpportunityApplications.tsx`

   - Update all queries and references

5. **src/pages/dashboard/ApplicationDetails.tsx**

   - Update project_id → opportunity_id references

6. **Other components** - Search and update:
   - All files importing from useProjects → useOpportunities
   - All files using Project type → Opportunity type
   - All route references to /projects → /opportunities (if changing routes)

### TypeScript Types

1. **src/integrations/supabase/types.ts**
   - Run `npx supabase gen types typescript --local` after migration is applied
   - This will auto-generate types for opportunities table
   - Manually verify applications table has opportunity_id instead of project_id

### Additional Hooks Needing Updates

1. **useAdminProjects.ts** → Rename to `useAdminOpportunities.ts`
2. **useProjectApplicationsRanked.ts** → Rename to `useOpportunityApplicationsRanked.ts`
3. **useAdminApplications.ts** - Update references
4. **useReviewerApplications.ts** - Update references
5. **useApplicationSubmission.ts** - Update references
6. **useUserDashboardStats.ts** - Update references (should use new RPC)

### Database Cleanup

1. **Drop old projects table** (after verification)
   - Uncomment the DROP statements in migration file
   - Verify all data migrated correctly
   - Verify all references updated

## Migration Files Created

1. `supabase/migrations/20260306225716_replace_projects_with_opportunities.sql`

   - Main migration: ENUMs, tables, data migration, foreign keys, indexes, triggers, RLS, RPC updates

2. `supabase/migrations/20260306225717_update_rpc_functions_for_opportunities.sql`
   - Additional RPC function updates

## Testing Checklist

Before dropping the projects table:

- [ ] Verify all opportunities data migrated correctly
- [ ] Verify all applications have opportunity_id set
- [ ] Verify all application_documents have opportunity_id set
- [ ] Test opportunity listing/filtering
- [ ] Test opportunity details page
- [ ] Test application submission
- [ ] Test admin opportunity management
- [ ] Test reviewer assignment (uses category via tags)
- [ ] Test dashboard stats
- [ ] Verify no broken references in logs

## Notes

- The migration preserves all existing data
- Categories are mapped to tags via opportunity_tag_map
- All existing applications maintain their relationships
- The old projects table is kept (commented out DROP) for safety until verification is complete
- Reviewer assignment still uses categories (via tags mapping) - this may need refinement
