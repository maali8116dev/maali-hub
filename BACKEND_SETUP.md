# Backend Setup

## Note

The Hono backend server has been removed. The application now uses:
- **Direct Supabase queries** (default) - Frontend queries Supabase directly
- **Supabase Edge Functions** (when implemented) - Serverless functions for API endpoints

No backend server needs to be started.

## Environment Variables

For direct Supabase queries (current setup), ensure your frontend has:

```env
# Supabase (already configured in src/integrations/supabase/client.ts)
# These are automatically set from your Supabase project
```

**Note:** Database migrations are handled by Supabase SQL migrations in `supabase/migrations/`. No additional database connection is needed for the frontend.

## Current Setup

The application uses **direct Supabase queries** by default. This means:
- ✅ Frontend queries Supabase directly (no backend server needed)
- ✅ Uses Row Level Security (RLS) policies for data access
- ✅ Simpler architecture, faster development

## Testing

1. Start the frontend: `npm run dev`
2. Navigate to `/dashboard/profile` to see your profile data
3. All data comes directly from Supabase

## Troubleshooting

**Profile not loading?**
- Make sure you're logged in
- Check browser console for errors
- Verify your Supabase connection is working
- Check that RLS policies are properly configured in Supabase


