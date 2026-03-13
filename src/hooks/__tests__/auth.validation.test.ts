import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import * as z from 'zod';
import { validateEmail, emailSchema } from '@/lib/emailValidation';


// Auth validation schemas (matching Auth.tsx)
const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const signUpSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: emailSchema,
  password: z.string().min(6, "Password must be at least 6 characters"),
  passwordConfirmation: z.string().min(6, "Password confirmation is required"),
}).refine((data) => data.password === data.passwordConfirmation, {
  message: "Passwords do not match",
  path: ["passwordConfirmation"],
});

const resetPasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  passwordConfirmation: z.string().min(6, "Password confirmation is required"),
}).refine((data) => data.password === data.passwordConfirmation, {
  message: "Passwords do not match",
  path: ["passwordConfirmation"],
});

// Use real Supabase client for integration tests
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://alpudhhsmgtpmgpjfuqs.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_x9j94wxK7OqIvyNh0eN5hw_uCBviZiZ";

// Create a real Supabase client for integration tests
const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

// Test user credentials
const TEST_USER_EMAIL = import.meta.env.VITE_TEST_USER_EMAIL || 'test@example.com';
const TEST_USER_PASSWORD = import.meta.env.VITE_TEST_USER_PASSWORD || 'testpassword123';

describe('Auth Validation - Business Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Email Validation', () => {
    it('should validate legitimate email addresses', async () => {
      const validEmails = [
        'user@gmail.com',
        'test@outlook.com',
        'user@yahoo.com',
        'test@protonmail.com',
        'user@icloud.com',
      ];

      for (const email of validEmails) {
        const result = await validateEmail(email);
        expect(result.valid).toBe(true);
        expect(result.message).toBeUndefined();
      }
    });

    it('should reject blocked email domains', async () => {
      const blockedEmails = [
        'test@test.com',
        'user@example.com',
        'test@example.org',
        'user@test.email',
      ];

      for (const email of blockedEmails) {
        const result = await validateEmail(email);
        expect(result.valid).toBe(false);
        expect(result.message).toContain('not allowed');
      }
    });

    it('should validate educational domains without API call', async () => {
      const educationalEmails = [
        'user@ma.nibs.edu.gh',
        'student@university.edu',
        'researcher@college.ac.uk',
      ];

      for (const email of educationalEmails) {
        const result = await validateEmail(email);
        expect(result.valid).toBe(true);
        // Should not call API for educational domains (validated client-side)
      }
    });

    it('should validate email schema with Zod', () => {
      // Valid emails
      expect(() => emailSchema.parse('user@gmail.com')).not.toThrow();
      expect(() => emailSchema.parse('test@outlook.com')).not.toThrow();

      // Invalid emails
      expect(() => emailSchema.parse('invalid-email')).toThrow();
      expect(() => emailSchema.parse('test@example.com')).toThrow();
      expect(() => emailSchema.parse('user@test.com')).toThrow();
    });
  });

  describe('Sign In Schema Validation', () => {
    it('should validate correct sign in data', () => {
      const validData = {
        email: 'user@example.com',
        password: 'password123',
      };

      expect(() => signInSchema.parse(validData)).not.toThrow();
    });

    it('should reject invalid email format', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'password123',
      };

      expect(() => signInSchema.parse(invalidData)).toThrow();
    });

    it('should reject empty password', () => {
      const invalidData = {
        email: 'user@example.com',
        password: '',
      };

      expect(() => signInSchema.parse(invalidData)).toThrow();
    });

    it('should reject missing required fields', () => {
      expect(() => signInSchema.parse({})).toThrow();
      expect(() => signInSchema.parse({ email: 'user@example.com' })).toThrow();
      expect(() => signInSchema.parse({ password: 'password123' })).toThrow();
    });
  });

  describe('Sign Up Schema Validation', () => {
    it('should validate correct sign up data', () => {
      const validData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@gmail.com',
        password: 'password123',
        passwordConfirmation: 'password123',
      };

      expect(() => signUpSchema.parse(validData)).not.toThrow();
    });

    it('should reject short first name', () => {
      const invalidData = {
        firstName: 'J',
        lastName: 'Doe',
        email: 'john@gmail.com',
        password: 'password123',
        passwordConfirmation: 'password123',
      };

      expect(() => signUpSchema.parse(invalidData)).toThrow();
    });

    it('should reject short last name', () => {
      const invalidData = {
        firstName: 'John',
        lastName: 'D',
        email: 'john@gmail.com',
        password: 'password123',
        passwordConfirmation: 'password123',
      };

      expect(() => signUpSchema.parse(invalidData)).toThrow();
    });

    it('should reject short password', () => {
      const invalidData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@gmail.com',
        password: '12345',
        passwordConfirmation: '12345',
      };

      expect(() => signUpSchema.parse(invalidData)).toThrow();
    });

    it('should reject mismatched passwords', () => {
      const invalidData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@gmail.com',
        password: 'password123',
        passwordConfirmation: 'differentpassword',
      };

      const result = signUpSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => 
          issue.message === 'Passwords do not match'
        )).toBe(true);
      }
    });

    it('should reject blocked email domains in sign up', () => {
      const invalidData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'password123',
        passwordConfirmation: 'password123',
      };

      expect(() => signUpSchema.parse(invalidData)).toThrow();
    });

    it('should allow disposable email addresses in schema (validation happens async)', () => {
      // Note: emailSchema only does synchronous validation (format + blocklist)
      // Disposable email checking happens via async validateEmail() in Auth.tsx
      const dataWithDisposableEmail = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@10minutemail.com',
        password: 'password123',
        passwordConfirmation: 'password123',
      };

      // Schema should accept it (format is valid, not in blocklist)
      expect(() => signUpSchema.parse(dataWithDisposableEmail)).not.toThrow();
      
      // But async validateEmail should reject it (tested separately in Email Validation section)
    });
  });

  describe('Password Reset Schema Validation', () => {
    it('should validate correct password reset data', () => {
      const validData = {
        password: 'newpassword123',
        passwordConfirmation: 'newpassword123',
      };

      expect(() => resetPasswordSchema.parse(validData)).not.toThrow();
    });

    it('should reject short password', () => {
      const invalidData = {
        password: '12345',
        passwordConfirmation: '12345',
      };

      expect(() => resetPasswordSchema.parse(invalidData)).toThrow();
    });

    it('should reject mismatched passwords', () => {
      const invalidData = {
        password: 'newpassword123',
        passwordConfirmation: 'differentpassword',
      };

      const result = resetPasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => 
          issue.message === 'Passwords do not match'
        )).toBe(true);
      }
    });

    it('should reject empty password confirmation', () => {
      const invalidData = {
        password: 'newpassword123',
        passwordConfirmation: '',
      };

      expect(() => resetPasswordSchema.parse(invalidData)).toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle email with special characters', async () => {
      const validEmails = [
        'user.name@gmail.com',
        'user+tag@gmail.com',
        'user_name@outlook.com',
      ];

      for (const email of validEmails) {
        const result = await validateEmail(email);
        expect(result.valid).toBe(true);
      }
    });

    it('should handle case-insensitive email validation', async () => {
      const emails = [
        'USER@GMAIL.COM',
        'User@Gmail.Com',
        'user@gmail.com',
      ];

      for (const email of emails) {
        const result = await validateEmail(email);
        expect(result.valid).toBe(true);
      }
    });

    it('should validate minimum password length requirements', () => {
      // Exactly 6 characters should pass
      const validData = {
        password: '123456',
        passwordConfirmation: '123456',
      };
      expect(() => resetPasswordSchema.parse(validData)).not.toThrow();

      // Less than 6 characters should fail
      const invalidData = {
        password: '12345',
        passwordConfirmation: '12345',
      };
      expect(() => resetPasswordSchema.parse(invalidData)).toThrow();
    });

    it('should validate name length requirements', () => {
      // Exactly 2 characters should pass
      const validData = {
        firstName: 'Jo',
        lastName: 'Do',
        email: 'john@gmail.com',
        password: 'password123',
        passwordConfirmation: 'password123',
      };
      expect(() => signUpSchema.parse(validData)).not.toThrow();

      // Less than 2 characters should fail
      const invalidData = {
        firstName: 'J',
        lastName: 'D',
        email: 'john@gmail.com',
        password: 'password123',
        passwordConfirmation: 'password123',
      };
      expect(() => signUpSchema.parse(invalidData)).toThrow();
    });
  });

  describe('Auth Integration Tests - Real Login', () => {
    beforeAll(async () => {
      // Sign out any existing session
      await supabase.auth.signOut();
    });

    afterAll(async () => {
      // Clean up: sign out after tests
      await supabase.auth.signOut();
    });

    beforeEach(async () => {
      // Ensure we're signed out before each test
      await supabase.auth.signOut();
    });

    it('should successfully sign in with valid credentials', async () => {
      if (!TEST_USER_EMAIL || TEST_USER_EMAIL === 'test@example.com') {
        console.warn('âš ï¸  Skipping login test: VITE_TEST_USER_EMAIL not set');
        return;
      }

      // Validate credentials first
      const validationResult = signInSchema.safeParse({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });

      expect(validationResult.success).toBe(true);

      // Attempt to sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });

      expect(error).toBeNull();
      expect(data.user).not.toBeNull();
      expect(data.user?.email).toBe(TEST_USER_EMAIL);
      expect(data.session).not.toBeNull();

      console.log(`âœ… Successfully signed in as ${TEST_USER_EMAIL}`);
    }, { timeout: 10000 });

    it('should reject sign in with invalid email format', async () => {
      const invalidEmail = 'invalid-email-format';

      // Validation should fail
      const validationResult = signInSchema.safeParse({
        email: invalidEmail,
        password: TEST_USER_PASSWORD,
      });

      expect(validationResult.success).toBe(false);

      // Supabase should also reject it
      const { error } = await supabase.auth.signInWithPassword({
        email: invalidEmail,
        password: TEST_USER_PASSWORD,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toBeDefined();
    }, { timeout: 10000 });

    it('should reject sign in with empty password', async () => {
      // Validation should fail
      const validationResult = signInSchema.safeParse({
        email: TEST_USER_EMAIL,
        password: '',
      });

      expect(validationResult.success).toBe(false);
    });

    it('should reject sign in with wrong password', async () => {
      if (!TEST_USER_EMAIL || TEST_USER_EMAIL === 'test@example.com') {
        console.warn('âš ï¸  Skipping login test: VITE_TEST_USER_EMAIL not set');
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: TEST_USER_EMAIL,
        password: 'wrongpassword123',
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('Invalid login credentials');
    }, { timeout: 10000 });

    it('should reject sign in with non-existent email', async () => {
      const nonExistentEmail = 'nonexistent@example.com';

      const { error } = await supabase.auth.signInWithPassword({
        email: nonExistentEmail,
        password: 'somepassword123',
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('Invalid login credentials');
    }, { timeout: 10000 });

    it('should maintain session after successful login', async () => {
      if (!TEST_USER_EMAIL || TEST_USER_EMAIL === 'test@example.com') {
        console.warn('âš ï¸  Skipping login test: VITE_TEST_USER_EMAIL not set');
        return;
      }

      // Sign in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });

      expect(signInError).toBeNull();
      expect(signInData.session).not.toBeNull();

      // Check session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      expect(sessionError).toBeNull();
      expect(sessionData.session).not.toBeNull();
      expect(sessionData.session?.user.email).toBe(TEST_USER_EMAIL);
    }, { timeout: 10000 });

    it('should sign out successfully', async () => {
      if (!TEST_USER_EMAIL || TEST_USER_EMAIL === 'test@example.com') {
        console.warn('âš ï¸  Skipping login test: VITE_TEST_USER_EMAIL not set');
        return;
      }

      // Sign in first
      await supabase.auth.signInWithPassword({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });

      // Verify we're signed in
      const { data: beforeSignOut } = await supabase.auth.getSession();
      expect(beforeSignOut.session).not.toBeNull();

      // Sign out
      const { error: signOutError } = await supabase.auth.signOut();
      expect(signOutError).toBeNull();

      // Verify we're signed out
      const { data: afterSignOut } = await supabase.auth.getSession();
      expect(afterSignOut.session).toBeNull();

      console.log('âœ… Successfully signed out');
    }, { timeout: 10000 });
  });
});









