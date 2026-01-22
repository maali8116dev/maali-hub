# Maali Opportunity Hub - Feature Testing Checklist

Use this checklist to systematically test all features of the application. Check off items as you test them.

---

## 🔐 Authentication & User Management

### Sign Up
- [ ] Email/password signup form displays correctly
- [ ] Password confirmation field works and validates match
- [ ] Form validation shows errors for invalid inputs
- [ ] Signup creates account successfully
- [ ] Profile setup wizard appears after signup
- [ ] Profile setup wizard can be skipped
- [ ] Welcome email is sent after signup
- [ ] User is redirected to dashboard after signup

### Sign In
- [ ] Email/password signin form displays correctly
- [ ] Signin with valid credentials works
- [ ] Signin with invalid credentials shows error
- [ ] User is redirected to dashboard after signin
- [ ] Session persists on page refresh

### OAuth Authentication
- [ ] Google OAuth button displays
- [ ] Google OAuth redirects to Google login
- [ ] Google OAuth returns to app after authentication
- [ ] Facebook OAuth button displays
- [ ] Facebook OAuth redirects to Facebook login
- [ ] Facebook OAuth returns to app after authentication
- [ ] OAuth users get profile created automatically

### Password Reset
- [ ] "Forgot password" link appears on signin form
- [ ] Password reset form accepts email
- [ ] Password reset email is sent
- [ ] Password reset link in email works
- [ ] New password can be set via reset link

### Email Verification
- [ ] Email verification banner appears for unverified users
- [ ] "Resend verification email" button works
- [ ] Verification email is received
- [ ] Verification link in email works
- [ ] Banner disappears after verification

### Session Management
- [ ] User stays logged in after page refresh
- [ ] Logout button works
- [ ] User is redirected to auth page after logout
- [ ] Protected routes redirect unauthenticated users

---

## 👤 User Profile

### Profile Setup Wizard
- [ ] Wizard appears after signup
- [ ] Step 1 (Basic Info) form works
- [ ] Step 2 (Business Details) form works
- [ ] Progress indicator shows correctly
- [ ] "Skip for now" button works
- [ ] "Back" button navigates correctly
- [ ] "Next" button validates before proceeding
- [ ] Form saves data correctly
- [ ] Wizard closes after completion

### Profile View
- [ ] Profile page loads user data
- [ ] All profile fields display correctly
- [ ] Profile completion percentage shows
- [ ] Profile completion prompt appears if incomplete
- [ ] "Complete profile" button opens wizard

### Profile Edit
- [ ] Profile edit form loads existing data
- [ ] All fields are editable
- [ ] Form validation works
- [ ] Profile updates save successfully
- [ ] Success toast appears after update
- [ ] Changes reflect immediately

### Profile Completion
- [ ] Completion percentage calculates correctly
- [ ] Missing fields are identified
- [ ] Completion prompt appears when incomplete
- [ ] Prompt can be dismissed
- [ ] Prompt doesn't reappear after dismissal

---

## 🏠 Landing Page & Public Pages

### Home Page (/)
- [ ] Page loads without errors
- [ ] Navigation bar displays correctly
- [ ] Hero section displays
- [ ] Trust indicators show
- [ ] "How it Works" section displays
- [ ] Featured projects section shows projects
- [ ] Benefits section displays
- [ ] Feature showcase displays
- [ ] Testimonials section shows
- [ ] Newsletter signup form works
- [ ] Footer displays correctly
- [ ] All links in footer work

### Projects Page (/projects)
- [ ] Projects list loads from database
- [ ] Project cards display correctly
- [ ] Search functionality works
- [ ] Filter by category works (Technology, Agriculture, FinTech)
- [ ] Filter by status works (Open, Closing Soon, Closed, New)
- [ ] Status badges display correctly
- [ ] Pagination works
- [ ] "View Details" button navigates correctly
- [ ] "Apply Now" button navigates correctly
- [ ] Loading skeleton displays while loading
- [ ] Empty state displays when no projects

### Project Details (/projects/:id)
- [ ] Project details page loads
- [ ] All project information displays
- [ ] Project description renders correctly
- [ ] Requirements list displays
- [ ] Deadline shows correctly
- [ ] Funding amount displays
- [ ] "Apply Now" button works
- [ ] "Back to Projects" link works

### About Page (/about)
- [ ] Page loads and displays content
- [ ] All sections render correctly
- [ ] Images display (if any)

### Resources Page (/resources)
- [ ] Resources list loads
- [ ] Resource cards display
- [ ] Filtering works (if implemented)
- [ ] Resource links work

### Contact Page (/contact)
- [ ] Contact form displays
- [ ] Form validation works
- [ ] Form submission works
- [ ] Success message appears

### Footer Pages
- [ ] Apply page (/apply) loads
- [ ] Partners page (/partners) loads
- [ ] Success Stories page (/success-stories) loads
- [ ] Blog listing page (/blog) loads
- [ ] Blog detail page (/blog/:id) loads
- [ ] Help page (/help) loads
- [ ] FAQ page (/faq) loads
- [ ] Mentors page (/mentors) loads
- [ ] Guide page (/guide) loads
- [ ] Privacy page (/privacy) loads
- [ ] Terms page (/terms) loads
- [ ] Cookies page (/cookies) loads
- [ ] Data Protection page (/data-protection) loads

---

## 📝 Applications

### Application Form (/projects/:id/apply)
- [ ] Form loads for selected project
- [ ] Step 1 (Company Information) works
- [ ] Step 2 (Project Details) works
- [ ] Step 3 (Documents) works
- [ ] Form validation works on each step
- [ ] Progress indicator shows correctly
- [ ] "Back" and "Next" buttons work
- [ ] Form data persists between steps
- [ ] Document upload works (if implemented)
- [ ] Form submission works
- [ ] Success message appears after submission
- [ ] User redirected after submission

### Applications Dashboard (/dashboard/applications)
- [ ] Applications list loads
- [ ] User's applications display correctly
- [ ] Application status badges show correctly
- [ ] Application details link works
- [ ] Filtering works (if implemented)
- [ ] Empty state shows when no applications

### Application Details
- [ ] Application detail page loads
- [ ] All application data displays
- [ ] Project information shows
- [ ] Status displays correctly
- [ ] Submitted date shows

---

## 📊 User Dashboard

### Dashboard Home (/dashboard)
- [ ] Dashboard loads user data
- [ ] Stats cards display correctly (Total, Pending, Approved, Rejected)
- [ ] Recent applications section shows
- [ ] Quick actions work
- [ ] Profile completion card shows
- [ ] Profile completion prompt appears if incomplete
- [ ] Loading states display correctly

### Documents (/dashboard/documents)
- [ ] Documents page loads
- [ ] User's documents list displays
- [ ] Upload functionality works (if implemented)
- [ ] Document preview works (if implemented)
- [ ] Document download works (if implemented)

### Notifications (/dashboard/notifications)
- [ ] Notifications page loads
- [ ] Notifications list displays
- [ ] Notification dropdown works
- [ ] Mark as read works (if implemented)
- [ ] Empty state shows when no notifications

### Settings (/dashboard/settings)
- [ ] Settings page loads
- [ ] All settings options display
- [ ] Settings can be updated
- [ ] Changes save successfully

---

## 👨‍💼 Admin Features

### Admin Dashboard (/admin)
- [ ] Admin dashboard loads
- [ ] Admin layout displays correctly
- [ ] Stats display correctly
- [ ] Navigation works

### Projects Management (/admin/projects)
- [ ] Projects list loads
- [ ] All projects display
- [ ] "Create New Project" button works
- [ ] Project form loads for new project
- [ ] Project form saves successfully
- [ ] Edit project form loads existing data
- [ ] Project updates save successfully
- [ ] Delete project works
- [ ] Project details page loads

### Applications Management (/admin/applications)
- [ ] Applications list loads
- [ ] All applications display
- [ ] Filtering works
- [ ] Application details page loads
- [ ] Status can be updated
- [ ] Update saves successfully

### Users Management (/admin/users)
- [ ] Users list loads
- [ ] All users display
- [ ] User roles display correctly
- [ ] Role can be updated (if implemented)
- [ ] User details display

### Blog Management (/admin/blog)
- [ ] Blog posts list loads
- [ ] "Create New Post" button works
- [ ] Blog form loads for new post
- [ ] Blog form saves successfully
- [ ] Edit blog form loads existing data
- [ ] Blog updates save successfully
- [ ] Delete blog post works
- [ ] Publish/unpublish works

### FAQ Management (/admin/faq)
- [ ] FAQ list loads
- [ ] "Create New FAQ" button works
- [ ] FAQ form saves successfully
- [ ] Edit FAQ form works
- [ ] Delete FAQ works

### Mentors Management (/admin/mentors)
- [ ] Mentors list loads
- [ ] "Create New Mentor" button works
- [ ] Mentor form saves successfully
- [ ] Edit mentor form works
- [ ] Delete mentor works
- [ ] Publish/unpublish works

### Resources Management (/admin/resources)
- [ ] Resources list loads
- [ ] "Create New Resource" button works
- [ ] Resource form saves successfully
- [ ] Edit resource form works
- [ ] Delete resource works

### Activity Logs (/admin/activity-logs)
- [ ] Activity logs page loads
- [ ] Logs table displays
- [ ] Filter by action type works
- [ ] Filter by entity type works
- [ ] Date range filter works
- [ ] Search functionality works
- [ ] Pagination works
- [ ] Export to CSV works
- [ ] Print/PDF export works

### Admin Settings (/admin/settings)
- [ ] Settings page loads
- [ ] All settings options display
- [ ] Settings can be updated
- [ ] Changes save successfully

---

## 👨‍⚖️ Reviewer Features

### Reviewer Dashboard (/reviewer)
- [ ] Reviewer dashboard loads
- [ ] Reviewer layout displays correctly
- [ ] Stats display correctly
- [ ] Navigation works

### Applications Review (/reviewer/applications)
- [ ] Applications list loads
- [ ] Applications assigned to reviewer display
- [ ] Application details page loads
- [ ] Review form works
- [ ] Status can be updated
- [ ] Comments can be added
- [ ] Review saves successfully

### Pending Applications (/reviewer/pending)
- [ ] Pending applications list loads
- [ ] Only pending applications display
- [ ] Applications can be selected for review

### Reviewer Settings (/reviewer/settings)
- [ ] Settings page loads
- [ ] Settings can be updated

---

## 🎨 UI/UX Features

### Navigation
- [ ] Navigation bar displays on all pages
- [ ] Logo links to home
- [ ] All navigation links work
- [ ] User menu displays when logged in
- [ ] Logout button works
- [ ] Mobile menu works (if implemented)

### Theme
- [ ] Theme toggle button displays
- [ ] Light mode works
- [ ] Dark mode works
- [ ] System theme detection works
- [ ] Theme persists across page refreshes

### Cookie Consent
- [ ] Cookie consent banner appears
- [ ] "Accept All" button works
- [ ] "Reject All" button works
- [ ] "Customize" button works
- [ ] Preferences can be saved
- [ ] Banner doesn't reappear after acceptance

### Loading States
- [ ] Skeleton loaders display while loading
- [ ] Loading spinners show appropriately
- [ ] Empty states display when no data

### Error Handling
- [ ] Error messages display correctly
- [ ] 404 page displays for invalid routes
- [ ] Error boundary catches errors
- [ ] Error toast notifications appear

### Responsive Design
- [ ] Mobile view works (< 768px)
- [ ] Tablet view works (768px - 1024px)
- [ ] Desktop view works (> 1024px)
- [ ] All forms are usable on mobile
- [ ] Navigation works on mobile

### Internationalization
- [ ] Language detection works
- [ ] Language can be changed
- [ ] All text translates correctly
- [ ] Language preference persists

---

## 🔧 Technical Features

### Data Loading
- [ ] All API calls work
- [ ] Supabase queries execute correctly
- [ ] Data caching works
- [ ] Data refetching works

### Form Validation
- [ ] All forms validate inputs
- [ ] Error messages display correctly
- [ ] Required fields are enforced
- [ ] Email validation works
- [ ] Password validation works

### File Uploads
- [ ] Document upload works (if implemented)
- [ ] Image upload works (if implemented)
- [ ] File size validation works
- [ ] File type validation works
- [ ] Upload progress shows

### Search & Filtering
- [ ] Search functionality works
- [ ] Filters apply correctly
- [ ] Multiple filters work together
- [ ] Clear filters button works

### Pagination
- [ ] Pagination controls display
- [ ] Next page button works
- [ ] Previous page button works
- [ ] Page numbers work
- [ ] Items per page selector works

---

## 📧 Email Features

### Email Templates
- [ ] Welcome email sends correctly
- [ ] Email verification email sends
- [ ] Password reset email sends
- [ ] Application submitted email sends
- [ ] Application approved email sends
- [ ] Application rejected email sends
- [ ] Status update email sends

### Email Content
- [ ] All email templates render correctly
- [ ] Links in emails work
- [ ] Email styling is correct

---

## 🔒 Security & Permissions

### Row Level Security (RLS)
- [ ] Users can only see their own data
- [ ] Admins can see all data
- [ ] Reviewers can see assigned applications
- [ ] Public data is accessible to all
- [ ] Protected data requires authentication

### Role-Based Access
- [ ] Admin routes require admin role
- [ ] Reviewer routes require reviewer role
- [ ] User routes require authentication
- [ ] Unauthorized access is blocked

---

## 📱 Browser Compatibility

### Desktop Browsers
- [ ] Chrome works correctly
- [ ] Firefox works correctly
- [ ] Safari works correctly
- [ ] Edge works correctly

### Mobile Browsers
- [ ] Chrome Mobile works
- [ ] Safari Mobile works
- [ ] Firefox Mobile works

---

## 🐛 Bug Testing

### Edge Cases
- [ ] Empty states handle correctly
- [ ] Long text displays correctly
- [ ] Special characters work in forms
- [ ] Very large numbers handle correctly
- [ ] Network errors handle gracefully
- [ ] Timeout errors handle gracefully

### Data Integrity
- [ ] Data saves correctly
- [ ] Data updates correctly
- [ ] Data deletes correctly
- [ ] No data loss on errors
- [ ] Foreign key constraints work

---

## 📝 Notes Section

Use this space to document any issues found:

### Critical Issues
- 

### Medium Priority Issues
- 

### Low Priority Issues
- 

### Suggestions for Improvement
- 

---

**Last Updated:** [Date]
**Tester:** [Your Name]
**Test Environment:** [Development/Staging/Production]

