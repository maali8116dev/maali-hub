# Admin Ranking UI Recommendations

## Overview

The system now uses a competitive selection process where admins select winners from ranked applications. This document outlines UI improvements needed to support this workflow.

## Current State

- ✅ Database trigger updates status to `under_review` when reviews complete
- ✅ Database function `get_project_applications_ranked()` returns ranked applications
- ✅ Admin notifications when project is ready for selection
- ⚠️ Admin UI needs enhancement to show ranked list and enable winner selection

## Recommended UI Enhancements

### 1. Project Applications View (New Page)

**Route:** `/admin/projects/:id/applications`

**Features:**
- Filter/select project to view applications
- Show ranked list of all applications for selected project
- Display key metrics: average score, variance, review count
- Expandable rows to see individual reviewer scores
- Bulk selection for winners
- Respect project max winners limit

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Project: [Dropdown Selector]                           │
│                                                         │
│ 📊 Project Statistics                                   │
│ Total Applications: 15 | Fully Reviewed: 15          │
│ Max Winners: 2                                          │
│                                                         │
│ 🏆 Ranked Applications (Select Winners)                │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ☑ Rank 1 | Score: 9.2/10 | Low Variance            │ │
│ │   Applicant: John Doe | 2 reviews                   │ │
│ │   [Expand] to see reviewer details                   │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ☐ Rank 2 | Score: 8.5/10 | Low Variance            │ │
│ │   Applicant: Jane Smith | 2 reviews                 │ │
│ └─────────────────────────────────────────────────────┘ │
│ ...                                                     │
│                                                         │
│ [Select Winners] [Approve Selected] [Reject Others]   │
└─────────────────────────────────────────────────────────┘
```

### 2. Enhanced Applications Table

**Update:** `/admin/applications`

**Add Columns:**
- Average Score (sortable)
- Score Variance (indicator: low/medium/high)
- Rank Position (when viewing by project)
- Individual Reviewer Scores (expandable)

**Add Filters:**
- Filter by Project
- Filter by Review Status (pending, under_review, completed)
- Sort by Score (highest first)

### 3. Application Detail View

**Update:** `/admin/applications/:id`

**Add Section:**
- **Review Summary Card:**
  - Average Score (large, prominent)
  - Score Variance (with visual indicator)
  - Individual Reviewer Scores (expandable list)
  - Recommendations breakdown (approve/reject/request_info)
  - Reviewer comments

- **Ranking Context:**
  - Show rank position among all applications for this project
  - Show how many applications are ranked higher/lower
  - Link to view all ranked applications for project

### 4. Bulk Actions

**New Component:** `WinnerSelectionToolbar`

**Actions:**
- Select/Deselect All
- Select Top N (where N = max winners)
- Approve Selected (winners)
- Reject Others (non-selected)
- Export Rankings (CSV/PDF)

**Validation:**
- Warn if selecting more than max winners
- Confirm before bulk approve/reject
- Show count of selected applications

## Implementation Steps

### Step 1: Create Ranking Hook

```typescript
// src/hooks/useProjectApplicationsRanked.ts
export const useProjectApplicationsRanked = (projectId: number) => {
  return useQuery({
    queryKey: ['project-applications-ranked', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'get_project_applications_ranked',
        { p_project_id: projectId }
      );
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
};
```

### Step 2: Create Ranking Page Component

```typescript
// src/pages/admin/ProjectApplications.tsx
- Use useProjectApplicationsRanked hook
- Display ranked list with scores
- Add selection checkboxes
- Implement bulk approve/reject
```

### Step 3: Update Applications Table

```typescript
// src/pages/admin/Applications.tsx
- Add project filter dropdown
- Add average score column
- Add variance indicator
- Add link to project ranking view
```

### Step 4: Add Bulk Actions

```typescript
// src/components/admin/WinnerSelectionToolbar.tsx
- Selection controls
- Bulk approve/reject buttons
- Max winners validation
```

## Data Structure

### From `get_project_applications_ranked()`:

```typescript
interface RankedApplication {
  application_id: string;
  applicant_name: string;
  applicant_email: string;
  submitted_at: string;
  status: string;
  average_score: number;
  score_variance: number | null;
  total_reviews: number;
  reviewer_scores: Array<{
    reviewer_id: string;
    reviewer_name: string;
    overall_score: number;
    recommendation: 'approve' | 'reject' | 'request_info';
    comments: string | null;
    submitted_at: string;
    scores: Record<string, number>;
  }>;
  recommendations: {
    approve: number;
    reject: number;
    request_info: number;
  };
  rank_position: number;
}
```

## User Flow

1. **Admin receives notification**: "Project ready for winner selection"
2. **Admin clicks notification** → Goes to `/admin/projects/:id/applications`
3. **Admin sees ranked list** → Applications sorted by score
4. **Admin reviews scores** → Expands rows to see reviewer details
5. **Admin selects winners** → Checks boxes for top applications
6. **Admin approves winners** → Bulk approve action
7. **System rejects others** → Automatic or manual reject
8. **Notifications sent** → Winners and non-winners notified

## Visual Indicators

### Score Display
- **High Score (8.0+)**: Green badge
- **Medium Score (5.0-8.0)**: Yellow badge
- **Low Score (<5.0)**: Red badge

### Variance Indicator
- **Low Variance (<1.0)**: ✅ Green checkmark (reviewers agree)
- **Medium Variance (1.0-2.0)**: ⚠️ Yellow warning (some disagreement)
- **High Variance (>2.0)**: ⚠️ Red warning (significant disagreement)

### Rank Badge
- **Rank 1-3**: 🥇🥈🥉 Medal icons
- **Rank 4+**: Number badge

## Best Practices

1. **Always show context**: Display project max winners prominently
2. **Make scores prominent**: Average score should be large and clear
3. **Show variance**: Help admins identify applications with reviewer disagreement
4. **Enable comparison**: Side-by-side view or expandable details
5. **Validate selections**: Prevent selecting more than max winners
6. **Confirm actions**: Require confirmation before bulk approve/reject
7. **Audit trail**: Log all winner selections with admin name and timestamp

## Example UI Components Needed

1. `ProjectApplicationsRanking.tsx` - Main ranking view
2. `RankedApplicationCard.tsx` - Individual application card with score
3. `ScoreVarianceIndicator.tsx` - Visual variance indicator
4. `WinnerSelectionToolbar.tsx` - Bulk action toolbar
5. `ReviewerScoresExpansion.tsx` - Expandable reviewer details
6. `ProjectFilter.tsx` - Project selector dropdown

## Next Steps

1. ✅ Database migration complete
2. ✅ Ranking function created
3. ⏳ Create ranking hook
4. ⏳ Build ranking page component
5. ⏳ Update applications table
6. ⏳ Add bulk actions
7. ⏳ Test end-to-end workflow

