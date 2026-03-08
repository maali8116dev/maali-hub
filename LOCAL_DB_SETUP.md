# Local Database Setup Guide

## Current Status

✅ **Local Supabase is running** at:

- API URL: http://127.0.0.1:54321
- Studio: http://127.0.0.1:54323
- Database: postgresql://postgres:postgres@127.0.0.1:54322/postgres

⚠️ **Migration Issue**: The consolidated schema migration file has dependency ordering issues that need to be fixed before migrations can be applied.

## Quick Start

### 1. Start Local Supabase (if not already running)

```bash
npm run supabase:start
```

### 2. Fix Migration Dependencies

The migration file `20250827000000_consolidated_schema.sql` has the following issues:

- References `projects` table that doesn't exist (should be `opportunities`)
- View `activity_logs_safe` created before `profiles` table exists (already fixed)

**To fix:**

1. Search for all references to `projects` table in the migration
2. Either remove them or replace with `opportunities` if appropriate
3. Ensure all table creations happen before constraints/views that reference them

### 3. Apply Migrations

Once dependencies are fixed:

```bash
npm run supabase:migration:up
```

Or reset and apply all migrations:

```bash
npm run supabase:reset
```

### 4. Generate TypeScript Types

```bash
npm run supabase:types
```

### 5. Seed Data (Optional)

```bash
npm run seed:users:local
```

## Access Points

- **Supabase Studio**: http://127.0.0.1:54323
- **API**: http://127.0.0.1:54321
- **Database**: postgresql://postgres:postgres@127.0.0.1:54322/postgres

## Environment Variables for Local Development

Update your `.env` file to use local Supabase:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<get from supabase:status output>
```

## Troubleshooting

### Migration Errors

If you see dependency errors:

1. Check the migration file for table creation order
2. Ensure all referenced tables exist before constraints/views are created
3. Use `npm run supabase:reset` to start fresh

### Container Issues

If containers fail to start:

```bash
npm run supabase:stop
npm run supabase:start
```

## Next Steps

1. Fix the `projects` table references in the migration file
2. Apply migrations successfully
3. Generate types
4. Start developing!
