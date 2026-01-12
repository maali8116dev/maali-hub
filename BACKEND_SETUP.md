# Backend Server Setup

## Quick Start

To use the profile API and other backend features, you need to start the backend server.

### 1. Start the Backend Server

In a separate terminal, run:

```bash
npm run server:dev
```

The server will start on `http://localhost:3000` (or the port specified in your `.env` file).

### 2. Environment Variables

Make sure you have a `.env` file in the root directory with:

```env
# Backend Server
PORT=3000
FRONTEND_URL=http://localhost:5173

# Database (for backend)
# IMPORTANT: Get this from Supabase Dashboard > Settings > Database > Connection string
# Use the "URI" connection string (direct connection, NOT the pooler)
# Format will be: postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
# OR: postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
# Copy the EXACT string from your Supabase dashboard
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres

# Supabase (for backend)
SUPABASE_URL=https://[PROJECT-REF].supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Frontend Environment Variable (Optional)

If your backend runs on a different URL, add to your `.env`:

```env
VITE_API_URL=http://localhost:3000
```

If not set, it defaults to `http://localhost:3000`.

## Fallback Behavior

The `useProfile` hook automatically falls back to direct Supabase queries if the backend server is not available. This means:

- ✅ **With backend running**: Uses your API endpoints (recommended for production)
- ✅ **Without backend**: Falls back to direct Supabase queries (works for development)

## Testing

1. Start the backend: `npm run server:dev`
2. Start the frontend: `npm run dev`
3. Navigate to `/dashboard/profile` to see your real profile data

## Troubleshooting

**Backend won't start?**
- Check that your `.env` file has all required variables
- Make sure port 3000 is not in use by another application
- Check the terminal for error messages

**Profile not loading?**
- Make sure you're logged in
- Check browser console for errors
- Verify your Supabase connection is working
- If backend is down, it will automatically use Supabase fallback

**Database connection error (ENOTFOUND)?**
- The `DATABASE_URL` hostname is incorrect or the format is wrong
- Go to Supabase Dashboard > Settings > Database
- Find "Connection string" section
- Copy the "URI" connection string (the direct connection, not the pooler)
- Make sure you replace `[YOUR-PASSWORD]` with your actual database password
- The connection string should look like one of these formats:
  - `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres`
  - `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`
  - `postgresql://postgres:[PASSWORD]@[HOST].supabase.co:5432/postgres`
- Paste the EXACT string (with your password) into your `.env` file as `DATABASE_URL`

