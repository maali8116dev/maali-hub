/**
 * Database configuration
 * 
 * To connect to Supabase:
 * 1. Go to your Supabase project dashboard: https://supabase.com/dashboard
 * 2. Select your project
 * 3. Navigate to Settings > Database
 * 4. Scroll down to "Connection string" section
 * 5. Select "URI" tab (NOT "Connection pooling")
 * 6. Copy the connection string - it will look like:
 *    postgresql://postgres:[YOUR-PASSWORD]@[HOST]:5432/postgres
 * 7. Replace [YOUR-PASSWORD] with your actual database password
 *    (Find it in Settings > Database > Database password, or reset it if needed)
 * 8. Set the complete string as DATABASE_URL in your .env file
 * 
 * IMPORTANT: Use the EXACT connection string from your dashboard.
 * The hostname format may vary (db.*.supabase.co, aws-0-*.pooler.supabase.com, etc.)
 */

export const dbConfig = {
  // Connection will be read from DATABASE_URL env variable
  // This file is for documentation and future configuration options
};

