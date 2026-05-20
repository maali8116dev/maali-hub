# Database Setup Guide

This guide will help you set up the database tables in your Supabase project.

## Prerequisites

- Supabase project created
- Environment variables configured:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `VITE_SUPABASE_PROJECT_ID`

## Running Migrations

### Option 1: Using Supabase CLI (Recommended)

The Supabase CLI is already installed as a dev dependency. You can use npm scripts or `npx`:

**Using npm scripts (easiest):**

1. Login to Supabase:

   ```bash
   npm run supabase:login
   ```

2. Link your project:

   ```bash
   npm run supabase:link
   ```

   (You'll be prompted for your project reference ID)

3. Run migrations:
   ```bash
   npm run supabase:push
   ```

**Using npx directly:**

1. Login to Supabase:

   ```bash
   npx supabase login
   ```

2. Link your project:

   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```

3. Run migrations:
   ```bash
   npx supabase db push
   ```

**Note:** Alternatively, you can install it globally with `npm install -g supabase` and then use `supabase` directly without `npx`.

### Option 2: Using Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Run each migration file in order:
   - `20250827000000_01_core_schema.sql` (Core Schema Foundation)
   - `20250827000000_02_user_management.sql` (User Management & Roles)
   - `20250827000000_03_payment_system.sql` (Payment System)
   - `20250827000000_04_reviewer_system.sql` (Reviewer Assignment System)
   - `20250827000000_05_storage_documents.sql` (Storage & Documents)
   - `20250827000000_06_notifications.sql` (Notifications)
   - `20250827000000_07_application_enhancements.sql` (Application Enhancements)
   - `20250827000000_08_miscellaneous.sql` (Miscellaneous Features)

### Option 3: Manual SQL Execution

Copy and paste the SQL from each migration file into the Supabase SQL Editor and execute them in order.

## Migration Structure

The database migrations are organized into 8 logical groups:

1. **Core Schema Foundation** (`01_core_schema.sql`)
   - Profiles, applications, application_documents, projects, blog_posts
   - Basic RLS policies and triggers

2. **User Management & Roles** (`02_user_management.sql`)
   - User role enum and role-based access control
   - User management functions
   - User avatars storage bucket

3. **Payment System** (`03_payment_system.sql`)
   - Payment methods, transactions, billing addresses
   - Invoice generation and payment tracking

4. **Reviewer Assignment System** (`04_reviewer_system.sql`)
   - Categories, reviewer categories, application assignments
   - Review scores, rubrics, conflicts
   - Reviewer workload balancing functions

5. **Storage & Documents** (`05_storage_documents.sql`)
   - Project images bucket
   - Application documents storage policies
   - Reviewer document access

6. **Notifications** (`06_notifications.sql`)
   - Notifications table and functions
   - Notification triggers (currently disabled - handled in application code)

7. **Application Enhancements** (`07_application_enhancements.sql`)
   - Comprehensive application fields
   - Draft support
   - Foreign key constraints

8. **Miscellaneous Features** (`08_miscellaneous.sql`)
   - Activity logs for tracking user interactions

## Tables Created

### Core Tables

- ✅ `profiles` - User profiles with role-based access
- ✅ `applications` - Funding applications with comprehensive fields
- ✅ `application_documents` - Application file uploads
- ✅ `projects` - Funding opportunities/projects
- ✅ `blog_posts` - Blog articles

### Payment Tables

- ✅ `payment_methods` - User payment methods
- ✅ `transactions` - Payment history and billing records
- ✅ `billing_addresses` - User billing information

### Reviewer System Tables

- ✅ `categories` - Centralized categories table
- ✅ `reviewer_categories` - Maps reviewers to categories
- ✅ `application_assignments` - Tracks reviewer assignments
- ✅ `reviewer_conflicts` - Conflict of interest declarations
- ✅ `review_scores` - Individual reviewer scores
- ✅ `category_rubrics` - Scoring criteria per category

### Other Tables

- ✅ `notifications` - User notifications
- ✅ `activity_logs` - Activity tracking

## Table Details

### Projects Table

- Stores funding opportunities
- Fields: title, description, category, status, deadline, funding amount, location, etc.
- Status values: 'new', 'open', 'closing-soon', 'closed'
- RLS: Everyone can view, only admins can create/update/delete

### Blog Posts Table

- Stores blog articles
- Fields: title, excerpt, content, author, category, image, featured, status, etc.
- Status values: 'draft', 'published', 'archived'
- RLS: Everyone can view published posts, only admins can create/update/delete
- Auto-sets `published_at` when status changes to 'published'

## Row Level Security (RLS)

All tables have RLS enabled with appropriate policies:

- **Profiles**: Users can view/update their own; admins can view all
- **Applications**: Users can manage their own; reviewers can view/update assigned applications
- **Application Documents**: Users can manage their own; reviewers and admins can view all
- **Projects**: Viewable by everyone, only admins can modify
- **Blog Posts**: Published posts viewable by everyone, only admins can modify
- **Payment Methods**: Users can manage their own
- **Transactions**: Users can view their own; admins can view all
- **Reviewer System**: Reviewers can view their own assignments/scores; admins can manage all
- **Notifications**: Users can view/manage their own

## User Roles

The system uses a role-based access control (RBAC) system with three roles:

- **admin** - Full system access
- **reviewer** - Can review assigned applications
- **applicant** - Default role for regular users

## Admin Access

Admin access is determined by the `role` field in the `profiles` table:

```sql
-- Grant admin access
UPDATE public.profiles
SET role = 'admin'
WHERE user_id = 'USER_UUID_HERE';

-- Grant reviewer access
UPDATE public.profiles
SET role = 'reviewer'
WHERE user_id = 'USER_UUID_HERE';
```

The `get_user_role()` function is used throughout the system to check user roles without RLS recursion issues.

## Verification

After running migrations, verify tables exist:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see all the tables listed above, including:
- Core tables: profiles, applications, application_documents, projects, blog_posts
- Payment tables: payment_methods, transactions, billing_addresses
- Reviewer system tables: categories, reviewer_categories, application_assignments, reviewer_conflicts, review_scores, category_rubrics
- Other tables: notifications, activity_logs

You can also verify functions exist:

```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_type = 'FUNCTION'
ORDER BY routine_name;
```

## Seeding Data

After running migrations, you can seed the database with sample data:

### Option 1: Using Supabase Dashboard (Easiest)

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Open the `supabase/seed.sql` file
4. Copy and paste the contents into the SQL Editor
5. Click **Run** to execute

### Option 2: Using Supabase CLI (Recommended)

**Using npm script (cross-platform):**

```bash
npm run supabase:seed
```

This uses a Node.js script (`scripts/seed.js`) that works on Windows, Mac, and Linux.

**Manual CLI method (alternative):**

```bash
# Linux/Mac
cat supabase/seed.sql | npx supabase db execute

# Windows (PowerShell)
Get-Content supabase/seed.sql | npx supabase db execute

# Windows (CMD)
type supabase/seed.sql | npx supabase db execute
```

**Note:** Make sure you're logged in (`npm run supabase:login`) and linked (`npm run supabase:link`) to your Supabase project before running the seed command.

### What Gets Seeded

The seed file (`supabase/seed.sql`) includes:

- **13 sample projects** across different categories:
  - Technology (6 projects)
  - Agriculture (3 projects)
  - FinTech (3 projects)
  - Various statuses: 'new', 'open', 'closing-soon'
  - Different funding amounts, locations, and deadlines

**Note:** The `created_by` field is set to `NULL` since admin users may not exist yet. You can update these after creating admin users:

```sql
UPDATE public.projects
SET created_by = 'ADMIN_USER_UUID_HERE'
WHERE created_by IS NULL;
```

## Next Steps

1. ✅ Seed initial data (optional) - Use `supabase/seed.sql`
2. Test the API endpoints with the new tables
3. Update frontend to use real data instead of mock data
