# Modules Still Using Dummy Data

This document lists all modules/components that currently use hardcoded dummy/mock data instead of fetching from the database or API.

## Reviewer Section

### 1. `src/pages/reviewer/Applications.tsx`

- **Status**: Uses hardcoded applications array
- **Data**: Application list with applicant names, project titles, statuses, funding amounts
- **Comment**: `// Mock data - replace with API calls when backend is ready`

### 2. `src/pages/reviewer/Pending.tsx`

- **Status**: Uses hardcoded pending applications array
- **Data**: Pending applications with days pending calculation
- **Comment**: `// Mock data - replace with API calls when backend is ready`

### 3. `src/pages/reviewer/Dashboard.tsx`

- **Status**: Uses hardcoded stats and recent applications
- **Data**: Review statistics (pending, under review, approved, rejected counts) and recent applications list
- **Comment**: `// Mock data - replace with actual API calls`

### 4. `src/pages/reviewer/ReviewApplication.tsx`

- **Status**: Uses hardcoded application details
- **Data**: Full application details including applicant info, project description, documents
- **Comment**: `// Mock data - replace with API call`

### 5. `src/pages/reviewer/Notifications.tsx`

- **Status**: Uses hardcoded notifications array
- **Data**: Reviewer-specific notifications (new applications, deadlines, status changes)
- **Comment**: `// Mock data - replace with API calls when backend is ready`

## Admin Section

### 6. `src/pages/admin/Applications.tsx`

- **Status**: Uses hardcoded applications array
- **Data**: All applications with applicant names, project titles, statuses
- **Comment**: `// Mock data - replace with API calls when backend is ready`

### 7. `src/pages/admin/Users.tsx`

- **Status**: Uses hardcoded users array
- **Data**: User list with names, emails, roles, registration dates, application counts
- **Comment**: `// Mock data - replace with API calls when backend is ready`

### 8. `src/pages/admin/Blog.tsx`

- **Status**: Uses hardcoded blog posts array
- **Data**: Blog posts with titles, excerpts, authors, dates, categories, images, status
- **Comment**: `// Mock data - replace with API calls when backend is ready`

### 9. `src/pages/admin/BlogForm.tsx`

- **Status**: Uses hardcoded initial form data for editing
- **Data**: Blog post form values when editing an existing post
- **Comment**: `// Mock data - replace with API call when backend is ready`

## Dashboard Section

### 10. `src/pages/dashboard/Notifications.tsx`

- **Status**: Uses hardcoded notifications array
- **Data**: User notifications (application updates, reminders, system messages)
- **Comment**: `// Mock data - replace with API calls when backend is ready`

### 11. `src/components/dashboard/DashboardLayout.tsx`

- **Status**: Uses hardcoded notifications in sidebar
- **Data**: Notification dropdown in the dashboard layout header
- **Comment**: `// Mock notifications data - replace with API calls when backend is ready`

## Blog/Content Section

### 12. `src/pages/BlogDetail.tsx`

- **Status**: Uses hardcoded blog post content
- **Data**: Full blog post content, images, metadata
- **Comment**: `// Mock data - replace with API call when backend is ready`

## Landing Page

### 13. `src/components/landing/FeaturedProjects.tsx`

- **Status**: Uses fallback mock data when no featured projects exist
- **Data**: Fallback featured projects array (only used if API returns no results)
- **Comment**: `// Fallback mock data when no featured projects exist`
- **Note**: This component does use `useFeaturedProjects()` hook, but has fallback data

## Summary

**Total Modules Using Dummy Data: 13**

### By Category:

- **Reviewer Section**: 5 modules
- **Admin Section**: 4 modules
- **Dashboard Section**: 2 modules
- **Blog/Content**: 1 module
- **Landing Page**: 1 module (fallback only)

### Priority Recommendations:

1. **High Priority**: Reviewer and Admin sections (core functionality)
2. **Medium Priority**: Dashboard notifications (user-facing)
3. **Low Priority**: Blog content (content management)

### Next Steps:

1. Create database tables for notifications, blog posts, and user management
2. Create hooks similar to `useApplications` and `useProjects` for:
   - `useNotifications()` - for user and reviewer notifications
   - `useBlogPosts()` - for blog management
   - `useUsers()` - for admin user management
   - `useReviewerApplications()` - for reviewer-specific application views
3. Replace hardcoded arrays with API calls using these hooks
4. Update components to handle loading and error states
