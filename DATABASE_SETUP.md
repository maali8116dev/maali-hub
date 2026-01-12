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
   - `20250827101831_8d15b569-7705-4300-b163-093e3b76bbc2.sql` (Profiles)
   - `20250827102215_b0cd49b0-3867-40f7-9208-7d75b2a0ceff.sql`
   - `20250827102240_9de99128-d1a2-483b-84c1-340b380a5627.sql`
   - `20250827104708_6ca4377e-7cd0-417a-a015-3ba4875e7e46.sql` (Applications)
   - `20250829113314_0653d1cb-4f25-45b1-9c8d-d9555d6c70c0.sql`
   - `20260107124324_create_projects_table.sql` (Projects - NEW)
   - `20260107124325_create_blog_posts_table.sql` (Blog Posts - NEW)

### Option 3: Manual SQL Execution

Copy and paste the SQL from each migration file into the Supabase SQL Editor and execute them in order.

## Tables Created

### Existing Tables

- ✅ `profiles` - User profiles
- ✅ `applications` - Funding applications
- ✅ `application_documents` - Application file uploads

### New Tables

- ✅ `projects` - Funding opportunities/projects
- ✅ `blog_posts` - Blog articles

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

- **Profiles**: Viewable by everyone, users can update their own
- **Applications**: Users can only view/update their own
- **Application Documents**: Users can only manage their own
- **Projects**: Viewable by everyone, only admins can modify
- **Blog Posts**: Published posts viewable by everyone, only admins can modify

## Admin Access

Admin access is determined by:

1. User's profile `business_sector` field set to 'admin' or 'Admin'
2. User's email ending with '@admin.maali.africa'

You can update a user's profile to grant admin access:

```sql
UPDATE public.profiles
SET business_sector = 'admin'
WHERE user_id = 'USER_UUID_HERE';
```

## Verification

After running migrations, verify tables exist:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('profiles', 'applications', 'application_documents', 'projects', 'blog_posts');
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
