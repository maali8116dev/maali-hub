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
   - Sign in with `test@example.com` / `testpassword123`
   - Create a new test user if authentication fails

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

The tests automatically clean up created notifications in the `afterAll` hook. However, if tests fail or are interrupted, you may need to manually delete test notifications:

```sql
-- Delete test notifications (adjust user_id as needed)
DELETE FROM notifications 
WHERE title LIKE 'Test Notification%' 
   OR title LIKE 'Notification to%'
   OR title LIKE 'Notification with Metadata%';
```

## Important Notes

- ⚠️ These tests use the **real database** - they will create and delete actual data
- ⚠️ Make sure you're using a test/development database, not production
- ✅ Tests clean up after themselves automatically
- ✅ All test notifications are prefixed with "Test Notification" or "Notification to" for easy identification

## Troubleshooting

### "Could not authenticate test user"
- Create a test user in your Supabase dashboard
- Or update the test credentials in the `beforeAll` hook

### "Error creating notification"
- Verify the `create_notification` RPC function exists in your database
- Check that RLS policies allow the function to create notifications
- Ensure the test user has proper permissions

### Tests timing out
- Increase timeout in test file: `{ timeout: 20000 }`
- Check your database connection
- Verify Supabase URL and keys are correct

