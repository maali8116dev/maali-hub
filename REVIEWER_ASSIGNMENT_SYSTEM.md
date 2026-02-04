# Reviewer Assignment System

## Overview

A simple, efficient reviewer assignment system with workload balancing, category-scoped pools, conflict handling, and rubric-based scoring.

## Key Features

✅ **Category-Scoped Reviewer Pools** - Reviewers are assigned to specific categories they can review  
✅ **2-3 Reviewers Per Application** - Configurable number of reviewers per application  
✅ **Workload Balancing** - Automatically distributes work by selecting reviewers with fewer pending assignments  
✅ **Conflict of Interest Handling** - Explicit conflict declarations prevent biased reviews  
✅ **Category-Specific Rubrics** - Flexible scoring criteria per category  
✅ **Aggregation & Audit Trail** - Complete history of assignments and scores  

## How It Works

### 1. Workload-Aware Assignment (Not Complex Load Balancing)

Instead of complex load balancing algorithms, we use a **simple workload-aware selection**:

- Count pending + in_progress assignments per reviewer
- Order reviewers by workload (fewer = higher priority)
- Random selection for tie-breaking
- Select top N reviewers

**Why this is better:**
- ✅ Simple to understand and maintain
- ✅ Naturally distributes work fairly
- ✅ No complex algorithms that can break
- ✅ Handles edge cases gracefully (not enough reviewers, conflicts, etc.)

### 2. Database Schema

```sql
-- Reviewer categories (which categories each reviewer can review)
reviewer_categories (reviewer_id, category)

-- Application assignments (who is assigned to what)
application_assignments (application_id, reviewer_id, status)

-- Conflict of interest declarations
reviewer_conflicts (reviewer_id, application_id, conflict_reason)

-- Review scores and rubrics
review_scores (application_id, reviewer_id, scores, overall_score, recommendation)
category_rubrics (category, rubric)
```

### 3. Assignment Flow

1. **Application Submitted** → Auto-assigns 2 reviewers (configurable)
2. **Assignment Function** → Selects reviewers with lowest workload for that category
3. **Conflict Check** → Excludes reviewers with conflicts
4. **Notification** → Notifies assigned reviewers
5. **Review Process** → Reviewers submit scores using category-specific rubric
6. **Aggregation** → System calculates average scores and recommendations

## Usage

### Assign Reviewers to Application

```typescript
import { useAssignReviewers } from '@/hooks/useReviewerAssignment';

const { mutate: assignReviewers } = useAssignReviewers();

// Assign 2 reviewers (default)
await assignReviewers({
  applicationId: 'app-123',
  numReviewers: 2,
});

// Assign 3 reviewers
await assignReviewers({
  applicationId: 'app-123',
  numReviewers: 3,
});
```

### Submit Review Score

```typescript
import { useSubmitReview } from '@/hooks/useReviewerAssignment';

const { mutate: submitReview } = useSubmitReview();

await submitReview({
  applicationId: 'app-123',
  reviewerId: 'reviewer-456',
  assignmentId: 'assignment-789',
  scores: {
    innovation: 8,
    feasibility: 7,
    impact: 9,
    team: 6,
  },
  comments: 'Strong proposal with clear impact',
  recommendation: 'approve',
});
```

### View Aggregated Results

```typescript
import { useReviewAggregation } from '@/hooks/useReviewerAssignment';

const { data: aggregation } = useReviewAggregation('app-123');

// aggregation contains:
// - total_reviews: 2
// - average_score: 7.5
// - recommendations: { approve: 2, reject: 0, request_info: 0 }
// - scores: [array of individual scores]
```

## Setting Up Reviewers

### 1. Assign Categories to Reviewers

```sql
-- Admin assigns categories to reviewers
INSERT INTO reviewer_categories (reviewer_id, category)
VALUES 
  ('reviewer-1-uuid', 'Agriculture'),
  ('reviewer-1-uuid', 'Technology'),
  ('reviewer-2-uuid', 'Health'),
  ('reviewer-2-uuid', 'Education');
```

### 2. Create Category Rubrics

```sql
INSERT INTO category_rubrics (category, rubric)
VALUES ('Agriculture', '{
  "criteria": [
    {"name": "innovation", "weight": 0.3, "max_score": 10, "description": "Innovation in agricultural practices"},
    {"name": "feasibility", "weight": 0.25, "max_score": 10, "description": "Feasibility of implementation"},
    {"name": "impact", "weight": 0.25, "max_score": 10, "description": "Impact on farmers and communities"},
    {"name": "sustainability", "weight": 0.2, "max_score": 10, "description": "Environmental sustainability"}
  ]
}');
```

### 3. Declare Conflicts

```sql
-- Reviewer or admin declares conflict
INSERT INTO reviewer_conflicts (reviewer_id, application_id, conflict_reason)
VALUES ('reviewer-1-uuid', 'app-123', 'same_organization');
```

## Workload Distribution

The system automatically balances workload:

- **Reviewer A**: 3 pending assignments
- **Reviewer B**: 1 pending assignment  
- **Reviewer C**: 2 pending assignments

When assigning a new application:
- Reviewer B gets priority (lowest workload)
- Reviewer C is next (second lowest)
- Reviewer A is last (highest workload)

This ensures fair distribution without complex algorithms.

## Edge Cases Handled

1. **Not enough reviewers** → Clear error message, admin can assign manually
2. **All reviewers have conflicts** → Error, admin intervention needed
3. **Reviewer declines** → Status updated, can reassign
4. **Missing rubric** → Uses default scoring (simple average)
5. **Partial reviews** → Aggregation works with available scores

## Benefits Over Complex Load Balancing

| Simple Workload-Aware | Complex Load Balancing |
|----------------------|------------------------|
| ✅ Easy to understand | ❌ Complex algorithms |
| ✅ Fewer edge cases | ❌ Many failure modes |
| ✅ Natural distribution | ❌ Requires tuning |
| ✅ Maintainable | ❌ Hard to debug |
| ✅ Fast queries | ❌ May need caching |

## Next Steps

1. **Run Migration**: Apply `20260130000000_create_reviewer_assignment_system.sql`
2. **Set Up Reviewers**: Assign categories to reviewers via admin panel
3. **Create Rubrics**: Define scoring criteria for each category
4. **Test Assignment**: Submit test application and verify assignment
5. **Review Process**: Test scoring and aggregation

## UI Components

- `ReviewScoringForm` - Component for reviewers to submit scores
- Admin panel for managing reviewer categories
- Admin panel for viewing assignments and conflicts
- Dashboard showing reviewer workload

