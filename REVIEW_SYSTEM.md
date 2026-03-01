# Review System Documentation

## Overview

The Maali Opportunity Hub review system provides a comprehensive workflow for evaluating applications through multiple reviewers, structured scoring, and automated decision recommendations. The system uses workload-balanced reviewer assignment, category-specific rubrics, and conflict of interest handling to ensure fair and efficient reviews.

---

## Key Features

✅ **Category-Scoped Reviewer Pools** - Reviewers are assigned to specific categories they can review  
✅ **2-3 Reviewers Per Application** - Configurable number of reviewers per application  
✅ **Workload Balancing** - Automatically distributes work by selecting reviewers with fewer pending assignments  
✅ **Conflict of Interest Handling** - Explicit conflict declarations prevent biased reviews  
✅ **Category-Specific Rubrics** - Flexible scoring criteria per category  
✅ **Aggregation & Audit Trail** - Complete history of assignments and scores  
✅ **Decision Engine** - Rule-based automatic decision recommendations  
✅ **Competitive Selection** - Admin-driven winner selection based on ranked scores

---

## Review Process Workflow

### 1. Application Submission

When an applicant submits a non-draft application:
- Application status is set to `pending`
- System automatically assigns 2-3 reviewers based on:
  - Project category
  - Reviewer workload (lowest first)
  - Conflict of interest exclusions
- Assigned reviewers receive notifications
- Application status changes to `under_review` when first review is submitted

### 2. Reviewer Assignment

The system uses a **simple workload-aware selection**:

- Count pending + in_progress assignments per reviewer
- Order reviewers by workload (fewer = higher priority)
- Random selection for tie-breaking
- Select top N reviewers (typically 2)

**Why this approach:**
- ✅ Simple to understand and maintain
- ✅ Naturally distributes work fairly
- ✅ No complex algorithms that can break
- ✅ Handles edge cases gracefully

### 3. Review Scoring

Each reviewer independently evaluates the application using category-specific rubrics:

- **Structured Scoring**: Fixed criteria (e.g., innovation, feasibility, impact, team) scored on a bounded scale
- **Overall Score**: Calculated based on rubric weights
- **Recommendation**: Approve, reject, or request more information
- **Comments**: Optional detailed feedback

### 4. Review Aggregation

After all reviewers submit their evaluations:

- **Per-criterion averages**: Average score for each criterion across all reviewers
- **Overall average score**: Mean of all overall scores
- **Score variance**: Disagreement metric (higher = more disagreement)
- **Per-criterion variances**: Variance for each individual criterion
- **Recommendation counts**: Tally of approve/reject/request_info recommendations

### 5. Decision Making

#### Competitive Selection Model (Current)

The system uses a **competitive selection workflow**:

1. **All applications remain `under_review`** until admin manually selects winners
2. **Applications are ranked** by:
   - Average score (highest first)
   - Score variance (lowest first for tie-breaking)
   - Submission date (earliest first)
3. **Admin reviews ranked list** and manually selects winners
4. **Selected winners** are approved, others are rejected
5. **Email notifications** are sent to all applicants
6. **Project status** is updated to "closed" when winners are selected

#### Decision Engine (Available but Not Auto-Applied)

The system includes a decision engine that provides recommendations (not automatically applied):

**Default Thresholds (1-10 Scale):**
- **Approve**: `avg_score ≥ 8.0` AND `variance ≤ 1.5`
- **Reject**: `avg_score ≤ 5.0`
- **Request Info**: `variance > 1.5` OR scores in middle range

**Confidence Calculation:**
- Score-based confidence: How far the score is from thresholds
- Consensus-based confidence: Agreement among reviewer recommendations
- Final confidence: Weighted blend of both

---

## Database Schema

```sql
-- Reviewer categories (which categories each reviewer can review)
reviewer_categories (reviewer_id, category)

-- Application assignments (who is assigned to what)
application_assignments (application_id, reviewer_id, status)

-- Conflict of interest declarations
reviewer_conflicts (reviewer_id, application_id, conflict_reason)

-- Review scores and rubrics
review_scores (application_id, reviewer_id, scores, overall_score, recommendation, comments)
system_rubric (id, rubric) -- Single system-wide rubric
```

---

## Usage

### Assign Reviewers to Application

```typescript
import { useAssignReviewers } from '@/hooks/useReviewerAssignments';

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
import { useSubmitReview } from '@/hooks/useReviewScores';

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
import { useReviewAggregation } from '@/hooks/useReviewAggregation';

const { data: aggregation } = useReviewAggregation('app-123');

// aggregation contains:
// - total_reviews: 2
// - average_score: 7.5
// - score_variance: 1.2
// - per_criterion_averages: { innovation: 8.5, feasibility: 7.2, ... }
// - per_criterion_variances: { innovation: 0.5, feasibility: 1.2, ... }
// - recommendations: { approve: 2, reject: 0, request_info: 0 }
// - scores: [array of individual scores]
```

### Get Decision Engine Recommendation

```typescript
import { useDecisionEngine } from '@/hooks/useReviewAggregation';

const { data: decision } = useDecisionEngine('app-123', 2); // 2 expected reviewers

if (decision) {
  console.log("Recommended Decision:", decision.recommendedDecision);
  console.log("Confidence:", decision.confidence);
  console.log("Reasoning:", decision.reasoning);
  console.log("Can Auto-Approve:", decision.canAutoApprove);
}
```

### Custom Decision Engine Configuration

```typescript
const { data: decision } = useDecisionEngine('app-123', 2, {
  approveThreshold: 8.0, // Minimum score for approval (1-10 scale)
  rejectThreshold: 5.0, // Maximum score for rejection (1-10 scale)
  varianceThreshold: 1.5, // Maximum variance for approval
  requireAllReviewers: true, // Require all reviewers before decision
});
```

---

## Admin Review Management

### Accessing the Page

Navigate to `/admin/review-management` in the admin panel.

### Features

#### 1. **Assignments Tab**
- View all applications and their assigned reviewers
- See review status for each assignment
- View aggregated review scores and recommendations
- Manually assign reviewers to applications
- See which reviewers are assigned and their status

#### 2. **Reviewer Categories Tab**
- View all reviewers and their assigned categories
- Add categories to reviewers
- Remove categories from reviewers
- See which reviewers can review which categories

#### 3. **Rubrics Tab**
- View system rubric
- Edit rubric criteria with weights
- Set max scores and descriptions for each criterion

#### 4. **Conflicts Tab**
- View all declared conflicts of interest
- See which reviewers have conflicts with which applications
- View conflict reasons

#### 5. **Workload Tab**
- View current workload for each reviewer
- See pending + in_progress assignment counts
- Identify reviewers with high/low workload
- Color-coded badges (red for >5, yellow for >3, green for ≤3)

### Assigning Reviewers

1. Go to **Assignments** tab
2. Find the application you want to assign reviewers to
3. Click **Assign** button
4. Select number of reviewers (2 or 3)
5. Click **Assign Reviewers**

The system will automatically:
- Select reviewers with lowest workload for that category
- Exclude reviewers with conflicts
- Notify assigned reviewers

### Managing Reviewer Categories

1. Go to **Reviewer Categories** tab
2. Click **Add Category Assignment**
3. Select reviewer and category
4. Click **Add Category**

To remove a category, click the X on the category badge.

### Creating Rubrics

1. Go to **Rubrics** tab
2. Click **Edit Rubric**
3. Add criteria:
   - Criterion name (e.g., "innovation")
   - Max score (e.g., 10)
   - Weight (0-1, will be normalized)
   - Description (optional)
4. Click **Save Rubric**

Weights are automatically normalized so they sum to 1.0.

---

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

### 2. Create System Rubric

The system uses a single system-wide rubric stored in the `system_rubric` table. Admins can edit this rubric through the admin panel.

### 3. Declare Conflicts

```sql
-- Reviewer or admin declares conflict
INSERT INTO reviewer_conflicts (reviewer_id, application_id, conflict_reason)
VALUES ('reviewer-1-uuid', 'app-123', 'same_organization');
```

---

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

---

## Edge Cases Handled

1. **Not enough reviewers** → Clear error message, admin can assign manually
2. **All reviewers have conflicts** → Error, admin intervention needed
3. **Reviewer declines** → Status updated, can reassign
4. **Missing rubric** → Uses default scoring (simple average)
5. **Partial reviews** → Aggregation works with available scores
6. **All reviews complete** → Admin notified that project is ready for winner selection

---

## Admin Winner Selection

### Ranked Applications View

Admins can view ranked applications for each project at `/admin/projects/:id/applications`.

**Ranking Criteria:**
1. Average score (highest first)
2. Score variance (lowest first for tie-breaking)
3. Submission date (earliest first)

**Features:**
- View all applications with scores, variance, and review counts
- Select multiple winners
- Bulk approve selected winners
- Bulk reject others
- View detailed reviewer scores in modal
- Email notifications sent automatically

**Workflow:**
1. All applications for a project are fully reviewed
2. Admin receives notification that project is ready for selection
3. Admin views ranked applications
4. Admin selects winners
5. Selected winners are approved, others are rejected
6. Project status is updated to "closed"
7. Email notifications are sent to all applicants

---

## Benefits

1. **Quality Assurance**: Multiple reviewers ensure thorough evaluation
2. **Efficiency**: Workload balancing distributes work fairly
3. **Consistency**: Standardized scoring criteria across all applications
4. **Transparency**: Complete audit trail of all reviews
5. **Scalability**: Handles high volume without proportional human effort
6. **Fairness**: Conflict of interest handling prevents bias

---

## Technical Details

- Uses React Query for data fetching
- Real-time updates when assignments change
- Optimistic updates for better UX
- Error handling with toast notifications
- Loading states for all async operations
- Activity logging for all review actions

---

## Permissions

- Only admins can access review management page
- RLS policies enforce security at database level
- All mutations require admin role
- Reviewers can only view their own assignments
- Applicants can only view their own application reviews

---

## Future Enhancements

- Machine learning-based threshold optimization
- Category-specific decision rules
- Historical performance tracking
- Automatic threshold adjustment based on outcomes
- Reviewer feedback system (detailed comments)
- Collaborative review features

