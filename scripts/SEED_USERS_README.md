# Seed Users and Reviewers Script

This script creates comprehensive seed data to demonstrate the reviewer assignment system in the dashboard.

## What It Creates

- **1 Admin User** - Full system access
- **5 Reviewer Users** - Assigned to different categories:
  - `reviewer.tech@maali.test` - Technology category
  - `reviewer.agriculture@maali.test` - Agriculture category
  - `reviewer.fintech@maali.test` - FinTech category
  - `reviewer.multi@maali.test` - Technology + Agriculture (multi-category)
  - `reviewer.tech2@maali.test` - Technology category (for workload balancing)
- **10 Applicant Users** - Regular users who submit applications
- **20 Applications** - Submitted by applicants to various projects (distributed across categories)
- **Reviewer Assignments** - Automatically assigned using the actual RPC function (`assign_reviewers_to_application`)

## Prerequisites

1. **Projects must be seeded first** - Run `npm run supabase:seed` to seed projects
2. **Environment variables** - Add to your `.env` file:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```
   
   **Getting your Service Role Key:**
   - Go to your Supabase Dashboard
   - Navigate to **Settings** → **API**
   - Copy the **`service_role`** key (⚠️ Keep this secret! Never commit it to git)
   - Add it to your `.env` file as `VITE_SUPABASE_SERVICE_ROLE_KEY`
   
   **Note**: The script will also check for `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (without VITE_ prefix) as fallbacks.

## Usage

```bash
npm run seed:users
```

Or directly:
```bash
node scripts/seed-users-and-reviewers.js
```

## Login Credentials

All users have the password: `TestPassword123!`

### Admin
- Email: `admin@maali.test`
- Role: Admin
- Can view all applications, manage reviewers, and see the full dashboard

### Reviewers
- `reviewer.tech@maali.test` - Technology reviews
- `reviewer.agriculture@maali.test` - Agriculture reviews
- `reviewer.fintech@maali.test` - FinTech reviews
- `reviewer.multi@maali.test` - Technology + Agriculture reviews
- `reviewer.tech2@maali.test` - Technology reviews (for workload balancing)

### Applicants
- `applicant1@maali.test` through `applicant10@maali.test`
- All have role: Applicant
- Can submit applications and view their own applications

## What You'll See in the Dashboard

After running the script:

1. **Admin Dashboard** (`/admin/applications`):
   - 20 applications with various statuses
   - Each application shows assigned reviewers
   - Reviewer workload distribution (you'll see workload balancing in action)
   - Applications distributed across Technology (40%), Agriculture (30%), FinTech (30%)

2. **Reviewer Dashboard** (`/reviewer`):
   - Each reviewer sees only their assigned applications
   - Applications are filtered by category
   - Workload balancing is visible (Technology reviewers will have more assignments)
   - Multi-category reviewer (`reviewer.multi@maali.test`) will see both Technology and Agriculture applications

3. **Application Details**:
   - Shows which reviewers are assigned
   - Assignment status (pending, in_progress, completed)
   - Reviewer names and categories

## How Reviewer Assignment Works

The script demonstrates the assignment system by calling the actual RPC function:

1. **Category-Based Assignment**: Reviewers are assigned to applications based on the project's category
2. **Workload Balancing**: The system assigns 2 reviewers per application (when available), balancing workload across reviewers
3. **Multi-Category Support**: `reviewer.multi@maali.test` can review both Technology and Agriculture applications
4. **Automatic Assignment**: Uses the `assign_reviewers_to_application` RPC function (same as production)
5. **Real Testing**: This tests the actual assignment logic your application uses when submissions happen

**What You'll See:**
- Technology reviewers will get more assignments (since 40% of applications are Technology)
- Agriculture reviewer will get moderate assignments (30% of applications)
- FinTech reviewer will get moderate assignments (30% of applications)
- Multi-category reviewer will see both Technology and Agriculture applications
- Workload balancing ensures reviewers with fewer assignments get prioritized

## Troubleshooting

### "Category not found" error
- Make sure you've run `npm run supabase:seed` first to create projects and categories

### "User already exists" warning
- The script will skip creating users that already exist
- It will update their profiles if needed

### "No reviewers found for category"
- Some categories might not have reviewers assigned
- Check the `reviewer_categories` table to see assignments

## Cleanup

To remove all seed data:

```sql
-- Delete applications
DELETE FROM public.applications WHERE contact_email LIKE '%@maali.test';

-- Delete reviewer assignments
DELETE FROM public.application_assignments 
WHERE reviewer_id IN (
  SELECT user_id FROM public.profiles 
  WHERE role = 'reviewer' AND last_name IN ('Tech', 'Agri', 'Finance', 'Multi', 'Innovation')
);

-- Delete reviewer categories
DELETE FROM public.reviewer_categories 
WHERE reviewer_id IN (
  SELECT user_id FROM public.profiles 
  WHERE role = 'reviewer' AND last_name IN ('Tech', 'Agri', 'Finance', 'Multi', 'Innovation')
);

-- Delete profiles (this will cascade delete auth users)
DELETE FROM public.profiles 
WHERE email LIKE '%@maali.test' OR 
      (role = 'reviewer' AND last_name IN ('Tech', 'Agri', 'Finance', 'Multi', 'Innovation')) OR
      (role = 'applicant' AND email LIKE 'applicant%@maali.test');
```

**Note**: Deleting profiles will cascade delete auth users due to the foreign key constraint.

