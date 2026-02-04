# Admin Review Management Page

## Overview

A comprehensive admin page for managing the entire reviewer assignment system, accessible at `/admin/review-management`.

## Features

### 1. **Assignments Tab**
- View all applications and their assigned reviewers
- See review status for each assignment
- View aggregated review scores and recommendations
- Manually assign reviewers to applications
- See which reviewers are assigned and their status

### 2. **Reviewer Categories Tab**
- View all reviewers and their assigned categories
- Add categories to reviewers
- Remove categories from reviewers
- See which reviewers can review which categories

### 3. **Rubrics Tab**
- View all category rubrics
- Create/edit rubrics for each category
- Define scoring criteria with weights
- Set max scores and descriptions for each criterion

### 4. **Conflicts Tab**
- View all declared conflicts of interest
- See which reviewers have conflicts with which applications
- View conflict reasons

### 5. **Workload Tab**
- View current workload for each reviewer
- See pending + in_progress assignment counts
- Identify reviewers with high/low workload
- Color-coded badges (red for >5, yellow for >3, green for ≤3)

## Usage

### Accessing the Page

1. Navigate to `/admin/review-management` in the admin panel
2. Or click "Review Management" in the admin sidebar menu

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
2. Click **Add Rubric**
3. Select category
4. Add criteria:
   - Criterion name (e.g., "innovation")
   - Max score (e.g., 10)
   - Weight (0-1, will be normalized)
   - Description (optional)
5. Click **Save Rubric**

Weights are automatically normalized so they sum to 1.0.

### Viewing Workload

1. Go to **Workload** tab
2. See all reviewers sorted by workload (highest first)
3. Color coding:
   - 🔴 Red: >5 assignments (overloaded)
   - 🟡 Yellow: 3-5 assignments (moderate)
   - 🟢 Green: <3 assignments (available)

## Integration with Assignment System

This page works seamlessly with the automatic assignment system:

- **Auto-assignment**: When applications are submitted, reviewers are automatically assigned
- **Manual override**: Admins can manually assign or reassign reviewers
- **Workload balancing**: System considers workload when auto-assigning
- **Conflict handling**: Conflicts are automatically excluded

## Technical Details

- Uses React Query for data fetching
- Real-time updates when assignments change
- Optimistic updates for better UX
- Error handling with toast notifications
- Loading states for all async operations

## Permissions

- Only admins can access this page
- RLS policies enforce security at database level
- All mutations require admin role

