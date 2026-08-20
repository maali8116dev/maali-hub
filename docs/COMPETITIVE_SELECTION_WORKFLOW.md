# Competitive Selection Workflow

## Overview

This system uses a **competitive selection process** where multiple applicants apply to the same project, but only 1-2 winners are selected. Applications are ranked by average reviewer scores, and admins manually select winners.

## Key Principles

1. **No Auto-Approval/Rejection**: Applications remain in `under_review` status until admin manually selects winners
2. **Score-Based Ranking**: Applications are ranked by average score (highest first)
3. **Admin Selection**: Admins review ranked list and select winners based on scores
4. **Conflict Resolution**: Conflicting recommendations (approve/reject) are resolved using average scores

## Workflow

### 1. Application Submission
- Applicant submits application → Status: `pending`
- System automatically assigns 2 reviewers based on project category

### 2. Review Process
- When first review is submitted → Status: `under_review`
- Reviewers submit scores and recommendations
- System calculates:
  - Average score across all reviewers
  - Score variance (disagreement metric)
  - Individual reviewer scores and recommendations

### 3. Review Completion
- When all assigned reviewers complete → Status remains: `under_review`
- **No automatic approval/rejection**
- Application is ready for admin review

### 4. Project Completion Check
- System checks if ALL applications for a project are fully reviewed
- If yes → Notifies all admins: "Project ready for winner selection"
- Admin can view ranked list of all applicants

### 5. Admin Winner Selection
- Admin views ranked applications using `get_project_applications_ranked(project_id)`
- Applications are sorted by:
  1. Average score (highest first)
  2. Variance (lowest first - for tie-breaking)
  3. Submission date (earliest first - for tie-breaking)
- Admin selects winners (1-2 based on project settings)
- Admin bulk approves winners, rejects others

## Database Functions

### `get_project_applications_ranked(project_id)`

Returns all applications for a project ranked by score.

**Returns:**
- `application_id`: UUID of the application
- `applicant_name`: Full name of applicant
- `applicant_email`: Contact email
- `submitted_at`: When application was submitted
- `status`: Current application status
- `average_score`: Average score across all reviewers
- `score_variance`: Variance in scores (higher = more disagreement)
- `total_reviews`: Number of completed reviews
- `reviewer_scores`: JSONB array with all reviewer scores and details
- `recommendations`: JSONB object with counts (approve/reject/request_info)
- `rank_position`: Rank position (1 = highest score)

**Example Usage:**
```sql
SELECT * FROM get_project_applications_ranked(1)
ORDER BY rank_position;
```

## Handling Conflicts

When reviewers have conflicting recommendations (one approves, one rejects):

1. **Use Average Score**: The average score determines ranking position
2. **Check Variance**: High variance indicates significant disagreement
3. **Admin Review**: Admin can see both scores and make informed decision
4. **No Third Reviewer**: Scores are sufficient for ranking

**Example:**
- Reviewer A: 9.0/10 (approve)
- Reviewer B: 3.0/10 (reject)
- Average: 6.0/10
- Variance: High (9.0)
- Admin sees both scores and can decide based on context

## Admin Interface Recommendations

### View: Project Applications (Ranked)

1. **Filter by Project**: Select project to view all applications
2. **Ranked List**: Show applications sorted by average score
3. **Score Display**: 
   - Average score prominently displayed
   - Individual reviewer scores expandable
   - Variance indicator (high/low)
4. **Selection Tools**:
   - Checkbox to select winners
   - Bulk approve/reject actions
   - Show project max winners (1-2)
5. **Details Panel**:
   - Full application details
   - All reviewer comments
   - Recommendation breakdown

### Actions

1. **Select Winners**: 
   - Check applications to approve
   - Respect project max winners limit
   - Bulk approve action
2. **Reject Others**: 
   - Automatically reject non-selected applications
   - Or manually review each
3. **Request More Info**: 
   - Can request additional information before final decision

## Status Flow

```
pending → under_review → [admin selects] → approved/rejected
```

- `pending`: Application submitted, awaiting reviews
- `under_review`: Reviews in progress or completed, awaiting admin selection
- `approved`: Selected as winner by admin
- `rejected`: Not selected as winner

## Notifications

### To Admins
- **"Project Ready for Winner Selection"**: Sent when all applications for a project are fully reviewed
- Includes link to ranked applications view
- Includes project title and total application count

### To Applicants
- **"Application Under Review"**: When first review is submitted
- **"Application Approved"**: When selected as winner
- **"Application Rejected"**: When not selected

## Best Practices

1. **Wait for All Reviews**: Don't select winners until all applications are fully reviewed
2. **Review Scores Carefully**: Check variance and individual scores, not just average
3. **Consider Context**: Read reviewer comments, not just scores
4. **Fair Selection**: Use consistent criteria across all applications
5. **Document Decisions**: Add notes when selecting winners for audit trail

## Technical Notes

- Trigger: `trigger_handle_review_completion` fires on review submission
- Function: `handle_review_completion()` updates status and checks project completion
- Ranking: Uses `RANK()` window function with score, variance, and date
- Variance: Calculated as sum of squared differences from mean

