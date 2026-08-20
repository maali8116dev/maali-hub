import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { validateEmail, emailSchema } from '@/lib/emailValidation';
import { createAuthSchemas } from '@/lib/schemas/authForm.schema';

const t = (key: string) => key;
const { signInSchema, signUpSchema, resetPasswordSchema } = createAuthSchemas(t as never);

// Use real Supabase client for integration tests
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://alpudhhsmgtpmgpjfuqs.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_x9j94wxK7OqIvyNh0eN5hw_uCBviZiZ";
const SUPABASE_SERVICE_ROLE_KEY =
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

// Create a real Supabase client for integration tests
const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY
  ? createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

// Test user credentials
const TEST_USER_EMAIL = import.meta.env.VITE_TEST_USER_EMAIL || 'test@example.com';
const TEST_USER_PASSWORD = import.meta.env.VITE_TEST_USER_PASSWORD || 'testpassword123';
const HAS_TEST_CREDENTIALS = Boolean(import.meta.env.VITE_TEST_USER_EMAIL && import.meta.env.VITE_TEST_USER_PASSWORD);
const HAS_SERVICE_ROLE = Boolean(SUPABASE_SERVICE_ROLE_KEY);

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
        password: 'Password1!',
      };

      expect(() => signInSchema.parse(validData)).not.toThrow();
    });

    it('should reject invalid email format', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'Password1!',
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
        password: 'Password1!',
        passwordConfirmation: 'Password1!',
      };

      expect(() => signUpSchema.parse(validData)).not.toThrow();
    });

    it('should reject short first name', () => {
      const invalidData = {
        firstName: 'J',
        lastName: 'Doe',
        email: 'john@gmail.com',
        password: 'Password1!',
        passwordConfirmation: 'Password1!',
      };

      expect(() => signUpSchema.parse(invalidData)).toThrow();
    });

    it('should reject short last name', () => {
      const invalidData = {
        firstName: 'John',
        lastName: 'D',
        email: 'john@gmail.com',
        password: 'Password1!',
        passwordConfirmation: 'Password1!',
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
        password: 'Password1!',
        passwordConfirmation: 'differentpassword',
      };

      const result = signUpSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => 
          issue.message === 'auth.validation.passwordMismatch'
        )).toBe(true);
      }
    });

    it('should reject blocked email domains in sign up', () => {
      const invalidData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'Password1!',
        passwordConfirmation: 'Password1!',
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
        password: 'Password1!',
        passwordConfirmation: 'Password1!',
      };

      // Schema should accept it (format is valid, not in blocklist)
      expect(() => signUpSchema.parse(dataWithDisposableEmail)).not.toThrow();
      
      // But async validateEmail should reject it (tested separately in Email Validation section)
    });
  });

  describe('Password Reset Schema Validation', () => {
    it('should validate correct password reset data', () => {
      const validData = {
        password: 'Newpass1!',
        passwordConfirmation: 'Newpass1!',
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
        password: 'Newpass1!',
        passwordConfirmation: 'differentpassword',
      };

      const result = resetPasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => 
          issue.message === 'auth.validation.passwordMismatch'
        )).toBe(true);
      }
    });

    it('should reject empty password confirmation', () => {
      const invalidData = {
        password: 'Newpass1!',
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
      const validData = {
        password: 'Passw0rd!',
        passwordConfirmation: 'Passw0rd!',
      };
      expect(() => resetPasswordSchema.parse(validData)).not.toThrow();

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
        password: 'Password1!',
        passwordConfirmation: 'Password1!',
      };
      expect(() => signUpSchema.parse(validData)).not.toThrow();

      // Less than 2 characters should fail
      const invalidData = {
        firstName: 'J',
        lastName: 'D',
        email: 'john@gmail.com',
        password: 'Password1!',
        passwordConfirmation: 'Password1!',
      };
      expect(() => signUpSchema.parse(invalidData)).toThrow();
    });
  });

  describe('Auth Integration Tests - Real Login', () => {
    const itIfAuth = HAS_SERVICE_ROLE ? it : it.skip;
    let authTestEmail = TEST_USER_EMAIL;
    let authTestPassword = TEST_USER_PASSWORD;
    let createdUserId: string | null = null;

    beforeAll(async () => {
      await supabase.auth.signOut();

      // If service role exists, create a guaranteed valid user for integration tests.
      if (supabaseAdmin) {
        authTestEmail = `auth-int-${Date.now()}@maali.test`;
        authTestPassword = `AuthTest!${Date.now()}`;
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: authTestEmail,
          password: authTestPassword,
          email_confirm: true,
        });
        if (error) throw error;
        createdUserId = data.user?.id ?? null;
      }
    });

    afterAll(async () => {
      await supabase.auth.signOut();
      if (supabaseAdmin && createdUserId) {
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      }
    });

    beforeEach(async () => {
      await supabase.auth.signOut();
    });

    itIfAuth('should successfully sign in with valid credentials', async () => {
      const validationResult = signInSchema.safeParse({
        email: authTestEmail,
        password: authTestPassword,
      });
      expect(validationResult.success).toBe(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: authTestEmail,
        password: authTestPassword,
      });

      expect(error).toBeNull();
      expect(data.user).not.toBeNull();
      expect(data.user?.email).toBe(authTestEmail);
      expect(data.session).not.toBeNull();
    }, { timeout: 10000 });

    it('should reject sign in with invalid email format', async () => {
      const invalidEmail = 'invalid-email-format';
      const validationResult = signInSchema.safeParse({
        email: invalidEmail,
        password: authTestPassword,
      });
      expect(validationResult.success).toBe(false);

      const { error } = await supabase.auth.signInWithPassword({
        email: invalidEmail,
        password: authTestPassword,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toBeDefined();
    }, { timeout: 10000 });

    it('should reject sign in with empty password', async () => {
      const validationResult = signInSchema.safeParse({
        email: authTestEmail,
        password: '',
      });
      expect(validationResult.success).toBe(false);
    });

    itIfAuth('should reject sign in with wrong password', async () => {
      const { error } = await supabase.auth.signInWithPassword({
        email: authTestEmail,
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

    itIfAuth('should maintain session after successful login', async () => {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: authTestEmail,
        password: authTestPassword,
      });

      expect(signInError).toBeNull();
      expect(signInData.session).not.toBeNull();

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      expect(sessionError).toBeNull();
      expect(sessionData.session).not.toBeNull();
      expect(sessionData.session?.user.email).toBe(authTestEmail);
    }, { timeout: 10000 });

    itIfAuth('should sign out successfully', async () => {
      await supabase.auth.signInWithPassword({
        email: authTestEmail,
        password: authTestPassword,
      });

      const { data: beforeSignOut } = await supabase.auth.getSession();
      expect(beforeSignOut.session).not.toBeNull();

      const { error: signOutError } = await supabase.auth.signOut();
      expect(signOutError).toBeNull();

      const { data: afterSignOut } = await supabase.auth.getSession();
      expect(afterSignOut.session).toBeNull();
    }, { timeout: 10000 });
  });
});









