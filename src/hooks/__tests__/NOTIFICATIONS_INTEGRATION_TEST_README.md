# Notifications Integration Tests

This file contains integration tests for the notifications system that interact with the **real database**.

## Prerequisites

1. **Supabase Project**: You need a running Supabase project (local or remote)
2. **Environment Variables**: Set up your Supabase credentials:
   ```bash
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
   Or modify the test file directly with your credentials.

3. **Test User**: The tests will attempt to:
   - Use an existing authenticated session
   - Sign in with seeded test user `applicant1@maali.test` / `TestPassword123!` (from seed script)
   - Fall back to `applicant2@maali.test` if first fails
   - Use `VITE_TEST_USER_ID` environment variable if set
   - **Last resort**: Create a new test user (will be cleaned up automatically)
   
   **Recommended**: Run the seed script first:
   ```bash
   npm run seed:users:local  # For local Supabase
   npm run seed:users        # For remote Supabase
   ```

## Running the Tests

```bash
# Run only the integration tests
npm test -- useNotifications.integration.test.ts

# Run with UI
npm run test:ui -- useNotifications.integration.test.ts

# Run in watch mode
npm run test:watch -- useNotifications.integration.test.ts
```

## What the Tests Do

### 1. Create Multiple Notifications
- Creates 5 different notifications with various types
- Verifies they are stored in the database
- Checks all notification properties (title, message, type, metadata, etc.)

### 2. Delete One Notification
- Deletes a notification from the database
- Verifies it no longer exists
- Confirms the count decreased

### 3. Verify Metadata Storage
- Creates a notification with complex metadata
- Verifies the metadata is stored correctly in JSONB format

### 4. Mark as Read
- Creates a notification
- Marks it as read
- Verifies the `read` status is updated

## Test Results in Database

After running the tests, you can verify the results in your Supabase dashboard:

1. Go to **Table Editor** → `notifications` table
2. Filter by your test user's `user_id`
3. You should see:
   - Multiple test notifications created
   - One notification deleted (if the delete test ran)
   - Notifications with various types and metadata

## Cleanup

The tests automatically clean up:
- ✅ **Created notifications** in the `afterAll` hook
- ✅ **Test users** created during tests (if SERVICE_ROLE_KEY is available)

However, if tests fail or are interrupted, you may need to manually clean up:

```sql
-- Delete test notifications (adjust user_id as needed)
DELETE FROM notifications 
WHERE title LIKE 'Test Notification%' 
   OR title LIKE 'Notification to%'
   OR title LIKE 'Notification with Metadata%';

-- Delete test users created by tests (if any)
-- Note: Seeded users (applicant1@maali.test, etc.) are NOT deleted
DELETE FROM auth.users 
WHERE email LIKE 'test-notifications-%@example.com';
```

**Note**: Seeded users from `scripts/seed-users-and-reviewers.js` are **NOT** deleted by tests. They are managed by the seed script's cleanup function.

## Important Notes

- ⚠️ These tests use the **real database** - they will create and delete actual data
- ⚠️ Make sure you're using a test/development database, not production
- ✅ Tests clean up after themselves automatically
- ✅ All test notifications are prefixed with "Test Notification" or "Notification to" for easy identification

## Troubleshooting

### "Could not authenticate test user"
- **Recommended**: Run the seed script first: `npm run seed:users:local` (or `npm run seed:users`)
- Or set `VITE_TEST_USER_ID` environment variable with an existing user ID
- Or create a test user manually in Supabase dashboard
- Or sign in to the app first to create a session

### "Error creating notification"
- Verify the `create_notification` RPC function exists in your database
- Check that RLS policies allow the function to create notifications
- Ensure the test user has proper permissions

### Tests timing out
- Increase timeout in test file: `{ timeout: 20000 }`
- Check your database connection
- Verify Supabase URL and keys are correct

