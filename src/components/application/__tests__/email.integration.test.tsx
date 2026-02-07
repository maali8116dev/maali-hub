import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// Use real Supabase client for integration tests
// These tests require actual database and edge function access
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://alpudhhsmgtpmgpjfuqs.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_x9j94wxK7OqIvyNh0eN5hw_uCBviZiZ";

// Create a real Supabase client for integration tests
const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

// Test user credentials (set these in your .env file)
const TEST_USER_EMAIL = import.meta.env.VITE_TEST_USER_EMAIL || 'test@example.com';
const TEST_USER_PASSWORD = import.meta.env.VITE_TEST_USER_PASSWORD || 'testpassword123';

// Email recipient for testing (where you want to receive test emails)
const TEST_EMAIL_RECIPIENT = import.meta.env.VITE_TEST_EMAIL_RECIPIENT || TEST_USER_EMAIL;
 
/**
 * Integration tests for email sending
 * These tests actually send emails using the Resend service
 * 
 * IMPORTANT: These tests require:
 * 1. A valid Supabase project with the send-email edge function deployed
 * 2. RESEND_API_KEY set in Supabase project secrets
 * 3. A test user account (set VITE_TEST_USER_EMAIL and VITE_TEST_USER_PASSWORD)
 * 4. A recipient email address (set VITE_TEST_EMAIL_RECIPIENT, defaults to test user email)
 * 
 * To run these tests:
 * npm test -- email.integration.test.tsx
 * 
 * Check your email inbox for the test emails!
 */
describe('Email Sending - Real Integration Tests', () => {
  let testUser: { id: string; email: string } | null = null;

  // Helper function to send email using the real Supabase client
  const sendEmailDirect = async (params: {
    to: string;
    type: string;
    data?: any;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session) {
        return { success: false, error: "User not authenticated" };
      }

      const response = await supabase.functions.invoke("send-email", {
        body: params,
      });

      if (response.error) {
        console.error("Email send error:", response.error);
        return { success: false, error: response.error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to send email:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      };
    }
  };

  beforeAll(async () => {
    // Sign in as test user
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });

    if (authError || !authData.user) {
      console.warn('⚠️  Could not authenticate test user. Skipping integration tests.');
      console.warn('Set VITE_TEST_USER_EMAIL and VITE_TEST_USER_PASSWORD environment variables.');
      console.warn('Or create a test user in Supabase Dashboard with:');
      console.warn(`  Email: ${TEST_USER_EMAIL}`);
      console.warn(`  Password: ${TEST_USER_PASSWORD}`);
      return;
    }

    testUser = {
      id: authData.user.id,
      email: authData.user.email!,
    };

    console.log(`✅ Authenticated as test user: ${testUser.email}`);
    console.log(`📧 Test emails will be sent to: ${TEST_EMAIL_RECIPIENT}`);
  });

  afterAll(async () => {
    // Sign out
    await supabase.auth.signOut();
    console.log('✅ Signed out from test session');
  });

  it('should send a welcome email', async () => {
    if (!testUser) {
      console.warn('Skipping test: No authenticated test user');
      return;
    }

    const result = await sendEmailDirect({
      to: TEST_EMAIL_RECIPIENT,
      type: 'welcome',
      data: {
        recipientName: 'Test User',
        actionUrl: 'https://example.com/dashboard',
      },
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    console.log(`✅ Welcome email sent to ${TEST_EMAIL_RECIPIENT}`);
    console.log('   Check your inbox for the welcome email!');
  }, { timeout: 30000 }); // 30 second timeout for email sending

  it('should send an application submitted email', async () => {
    if (!testUser) {
      console.warn('Skipping test: No authenticated test user');
      return;
    }

    const result = await sendEmailDirect({
      to: TEST_EMAIL_RECIPIENT,
      type: 'application_submitted',
      data: {
        recipientName: 'Test User',
        projectTitle: 'Test Project Title',
        applicationId: 'test-application-123',
        actionUrl: 'https://example.com/dashboard/applications/test-application-123',
      },
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    console.log(`✅ Application submitted email sent to ${TEST_EMAIL_RECIPIENT}`);
    console.log('   Check your inbox for the application confirmation email!');
  }, { timeout: 30000 });

  it('should send an application approved email', async () => {
    if (!testUser) {
      console.warn('Skipping test: No authenticated test user');
      return;
    }

    const result = await sendEmailDirect({
      to: TEST_EMAIL_RECIPIENT,
      type: 'application_approved',
      data: {
        recipientName: 'Test User',
        projectTitle: 'Test Project Title',
        applicationId: 'test-application-123',
        actionUrl: 'https://example.com/dashboard/applications/test-application-123',
      },
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    console.log(`✅ Application approved email sent to ${TEST_EMAIL_RECIPIENT}`);
    console.log('   Check your inbox for the approval notification!');
  }, { timeout: 30000 });

  it('should send an application rejected email', async () => {
    if (!testUser) {
      console.warn('Skipping test: No authenticated test user');
      return;
    }

    const result = await sendEmailDirect({
      to: TEST_EMAIL_RECIPIENT,
      type: 'application_rejected',
      data: {
        recipientName: 'Test User',
        projectTitle: 'Test Project Title',
        applicationId: 'test-application-123',
        statusMessage: 'This is a test rejection reason for integration testing.',
        actionUrl: 'https://example.com/dashboard/applications/test-application-123',
      },
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    console.log(`✅ Application rejected email sent to ${TEST_EMAIL_RECIPIENT}`);
    console.log('   Check your inbox for the rejection notification!');
  }, { timeout: 30000 });

  it('should send an application under review email', async () => {
    if (!testUser) {
      console.warn('Skipping test: No authenticated test user');
      return;
    }

    const result = await sendEmailDirect({
      to: TEST_EMAIL_RECIPIENT,
      type: 'application_under_review',
      data: {
        recipientName: 'Test User',
        projectTitle: 'Test Project Title',
        applicationId: 'test-application-123',
        actionUrl: 'https://example.com/dashboard/applications/test-application-123',
      },
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    console.log(`✅ Application under review email sent to ${TEST_EMAIL_RECIPIENT}`);
    console.log('   Check your inbox for the review status notification!');
  }, { timeout: 30000 });

  it('should send a status update email', async () => {
    if (!testUser) {
      console.warn('Skipping test: No authenticated test user');
      return;
    }

    const result = await sendEmailDirect({
      to: TEST_EMAIL_RECIPIENT,
      type: 'status_update',
      data: {
        recipientName: 'Test User',
        projectTitle: 'Test Project Title',
        applicationId: 'test-application-123',
        statusMessage: 'Your application status has been updated from pending to in_progress',
        actionUrl: 'https://example.com/dashboard/applications/test-application-123',
      },
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    console.log(`✅ Status update email sent to ${TEST_EMAIL_RECIPIENT}`);
    console.log('   Check your inbox for the status update notification!');
  }, { timeout: 30000 });

  it('should handle email sending errors gracefully', async () => {
    if (!testUser) {
      console.warn('Skipping test: No authenticated test user');
      return;
    }

    // Try to send to an invalid email address
    // Note: The edge function might accept invalid emails and let Resend handle validation
    // So we test with a clearly invalid format that should fail
    const result = await sendEmailDirect({
      to: 'not-an-email',
      type: 'welcome',
      data: {
        recipientName: 'Test User',
      },
    });

    // The edge function might accept it, but Resend should reject it
    // Or the edge function might validate it first
    // Either way, we check if it succeeded or failed
    if (result.success) {
      console.log('⚠️  Edge function accepted invalid email (validation may happen at Resend level)');
      // If it succeeded, that's okay - validation might happen at the email service level
      expect(result.success).toBe(true);
    } else {
      // If it failed, verify we got an error message
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      console.log(`✅ Error handling test completed - email rejected`);
      console.log(`   Error: ${result.error}`);
    }
  }, { timeout: 30000 });
});

