import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// Use real Supabase client for integration tests
// These tests require actual database access
// Using the same credentials as the main client
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://alpudhhsmgtpmgpjfuqs.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_x9j94wxK7OqIvyNh0eN5hw_uCBviZiZ";

// Create a real Supabase client for integration tests
const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

// Helper function to create notifications (using RPC)
const createNotification = async (
  userId: string,
  title: string,
  message: string,
  type: 'application' | 'system' | 'reminder' | 'new_application' | 'review_assigned' | 'deadline_reminder' | 'status_change',
  link?: string,
  metadata?: Record<string, any>
): Promise<void> => {
  const { error } = await supabase.rpc("create_notification", {
    p_user_id: userId,
    p_title: title,
    p_message: message,
    p_type: type,
    p_link: link || null,
    p_metadata: metadata || null,
  });

  if (error) {
    console.error("Error creating notification:", error);
    throw error; // Throw in tests so we can catch failures
  }
};

/**
 * Integration tests for notifications
 * These tests interact with the real database to verify notification functionality
 * 
 * To run these tests:
 * 1. Make sure you have a Supabase project set up
 * 2. Ensure you have a test user account
 * 3. Run: npm test -- useNotifications.integration.test.ts
 */

describe('Notifications Integration Tests', () => {
  let testUserId: string;
  let createdNotificationIds: string[] = [];

  beforeAll(async () => {
    // Try multiple authentication methods
    let authenticated = false;
    
    // Method 1: Check if there's an existing session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (!authError && user) {
      testUserId = user.id;
      authenticated = true;
      console.log('✅ Using existing authenticated session');
    }
    
    // Method 2: Try to sign in with test credentials
    if (!authenticated) {
      console.log('Attempting to sign in with test credentials...');
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'testpassword123',
      });

      if (!signInError && signInData.user) {
        testUserId = signInData.user.id;
        authenticated = true;
        console.log('✅ Signed in with test credentials');
      } else {
        console.log('Sign in failed:', signInError?.message);
      }
    }
    
    // Method 3: Try to sign up a new test user
    if (!authenticated) {
      console.log('Attempting to create a new test user...');
      const testEmail = `test-notifications-${Date.now()}@example.com`;
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: testEmail,
        password: 'testpassword123',
      });

      if (!signUpError && signUpData.user) {
        testUserId = signUpData.user.id;
        authenticated = true;
        console.log(`✅ Created new test user: ${testEmail}`);
        console.log('Note: If email confirmation is required, you may need to confirm the email first.');
      } else {
        console.error('Sign up failed:', signUpError);
        if (signUpError?.message) {
          console.error('Error details:', signUpError.message);
        }
      }
    }
    
    // Method 4: Use a hardcoded test user ID if available
    // You can set this in your environment or update the test file
    if (!authenticated && import.meta.env.VITE_TEST_USER_ID) {
      testUserId = import.meta.env.VITE_TEST_USER_ID;
      authenticated = true;
      console.log('✅ Using test user ID from environment variable');
    }

    if (!authenticated || !testUserId) {
      throw new Error(
        'Could not authenticate test user.\n' +
        'Please either:\n' +
        '1. Create a test user in Supabase dashboard with email: test@example.com, password: testpassword123\n' +
        '2. Set VITE_TEST_USER_ID environment variable with an existing user ID\n' +
        '3. Sign in to the app first to create a session\n' +
        '4. Disable email confirmation in Supabase Auth settings for testing'
      );
    }

    console.log('Test User ID:', testUserId);
  });

  afterAll(async () => {
    // Clean up: Delete all test notifications
    if (createdNotificationIds.length > 0) {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .in('id', createdNotificationIds);

      if (error) {
        console.error('Error cleaning up test notifications:', error);
      } else {
        console.log(`Cleaned up ${createdNotificationIds.length} test notifications`);
      }
    }
  });

  it('should create multiple notifications and verify they exist in the database', async () => {
    // Create 5 different notifications
    const notificationsToCreate = [
      {
        title: 'Test Notification 1',
        message: 'This is the first test notification',
        type: 'application' as const,
        link: '/dashboard/applications/1',
        metadata: { application_id: '1', project_id: 1 },
      },
      {
        title: 'Test Notification 2',
        message: 'This is the second test notification',
        type: 'new_application' as const,
        link: '/reviewer/applications/2',
        metadata: { application_id: '2', project_id: 2 },
      },
      {
        title: 'Test Notification 3',
        message: 'This is the third test notification',
        type: 'system' as const,
        link: null,
        metadata: { action: 'test' },
      },
      {
        title: 'Test Notification 4',
        message: 'This is the fourth test notification',
        type: 'reminder' as const,
        link: '/dashboard',
        metadata: { reminder_type: 'deadline' },
      },
      {
        title: 'Test Notification 5',
        message: 'This is the fifth test notification',
        type: 'status_change' as const,
        link: '/dashboard/applications/5',
        metadata: { application_id: '5', status: 'approved', previous_status: 'pending' },
      },
    ];

    // Create all notifications
    for (const notification of notificationsToCreate) {
      await createNotification(
        testUserId,
        notification.title,
        notification.message,
        notification.type,
        notification.link || undefined,
        notification.metadata
      );
    }

    // Wait a bit for database to process
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify notifications exist in database
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', testUserId)
      .order('created_at', { ascending: false })
      .limit(10);

    expect(error).toBeNull();
    expect(notifications).toBeDefined();
    expect(notifications!.length).toBeGreaterThanOrEqual(5);

    // Verify we can find our test notifications
    const testNotifications = notifications!.filter(n => 
      n.title.startsWith('Test Notification')
    );

    expect(testNotifications.length).toBeGreaterThanOrEqual(5);

    // Store IDs for cleanup
    createdNotificationIds = testNotifications.map(n => n.id);

    // Verify notification properties
    testNotifications.forEach((notification, index) => {
      expect(notification.user_id).toBe(testUserId);
      expect(notification.title).toContain('Test Notification');
      expect(notification.message).toBeDefined();
      expect(notification.type).toBeDefined();
      expect(notification.read).toBe(false);
      expect(notification.created_at).toBeDefined();
    });

    console.log(`✅ Created and verified ${testNotifications.length} notifications in database`);
    console.log('Notification IDs:', createdNotificationIds);
  }, { timeout: 10000 });

  it('should delete one notification and verify it is removed from the database', async () => {
    // First, ensure we have notifications to delete
    if (createdNotificationIds.length === 0) {
      // Create a notification if we don't have any
      await createNotification(
        testUserId,
        'Notification to Delete',
        'This notification will be deleted',
        'system'
      );

      await new Promise(resolve => setTimeout(resolve, 500));

      const { data: newNotifications } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', testUserId)
        .eq('title', 'Notification to Delete')
        .limit(1);

      if (newNotifications && newNotifications.length > 0) {
        createdNotificationIds.push(newNotifications[0].id);
      }
    }

    expect(createdNotificationIds.length).toBeGreaterThan(0);

    // Get the ID of the notification to delete
    const notificationIdToDelete = createdNotificationIds[0];
    const initialCount = createdNotificationIds.length;

    // Verify the notification exists before deletion
    const { data: beforeDelete } = await supabase
      .from('notifications')
      .select('id')
      .eq('id', notificationIdToDelete)
      .single();

    expect(beforeDelete).toBeDefined();
    expect(beforeDelete!.id).toBe(notificationIdToDelete);

    // Delete the notification
    const { error: deleteError } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationIdToDelete);

    expect(deleteError).toBeNull();

    // Wait a bit for database to process
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify the notification no longer exists
    const { data: afterDelete, error: fetchError } = await supabase
      .from('notifications')
      .select('id')
      .eq('id', notificationIdToDelete)
      .single();

    expect(fetchError).toBeDefined();
    expect(fetchError!.code).toBe('PGRST116'); // No rows returned
    expect(afterDelete).toBeNull();

    // Remove from our cleanup list since we already deleted it
    createdNotificationIds = createdNotificationIds.filter(id => id !== notificationIdToDelete);

    // Verify count decreased
    const { data: remainingNotifications } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', testUserId)
      .in('id', createdNotificationIds);

    expect(remainingNotifications!.length).toBe(initialCount - 1);

    console.log(`✅ Successfully deleted notification ${notificationIdToDelete}`);
    console.log(`Remaining notifications: ${remainingNotifications!.length}`);
  }, { timeout: 10000 });

  it('should verify notification metadata is stored correctly', async () => {
    // Create a notification with complex metadata
    const complexMetadata = {
      application_id: 'test-app-123',
      project_id: 456,
      status: 'approved',
      previous_status: 'pending',
      reviewer_id: 'reviewer-789',
      timestamp: new Date().toISOString(),
    };

    await createNotification(
      testUserId,
      'Notification with Metadata',
      'This notification has complex metadata',
      'status_change',
      '/dashboard/applications/test-app-123',
      complexMetadata
    );

    await new Promise(resolve => setTimeout(resolve, 500));

    // Fetch and verify metadata
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', testUserId)
      .eq('title', 'Notification with Metadata')
      .limit(1)
      .single();

    expect(error).toBeNull();
    expect(notifications).toBeDefined();
    expect(notifications!.metadata).toBeDefined();
    expect(notifications!.metadata).toMatchObject(complexMetadata);
    expect(notifications!.metadata.application_id).toBe('test-app-123');
    expect(notifications!.metadata.project_id).toBe(456);

    // Add to cleanup
    if (notifications) {
      createdNotificationIds.push(notifications.id);
    }

    console.log('✅ Verified notification metadata storage');
  }, { timeout: 10000 });

  it('should verify notifications can be marked as read', async () => {
    // Create a notification
    await createNotification(
      testUserId,
      'Notification to Mark as Read',
      'This notification will be marked as read',
      'application'
    );

    await new Promise(resolve => setTimeout(resolve, 500));

    // Find the notification
    const { data: notifications } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', testUserId)
      .eq('title', 'Notification to Mark as Read')
      .eq('read', false)
      .limit(1)
      .single();

    expect(notifications).toBeDefined();
    const notificationId = notifications!.id;

    // Mark as read
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    expect(updateError).toBeNull();

    // Verify it's marked as read
    const { data: updatedNotification } = await supabase
      .from('notifications')
      .select('read')
      .eq('id', notificationId)
      .single();

    expect(updatedNotification).toBeDefined();
    expect(updatedNotification!.read).toBe(true);

    // Add to cleanup
    createdNotificationIds.push(notificationId);

    console.log('✅ Verified notification can be marked as read');
  }, { timeout: 10000 });
});

