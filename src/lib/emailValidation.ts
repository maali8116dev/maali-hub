import * as z from "zod";
import isDisposable from "disposable-email-detector";

// List of blocked domains (test emails, common typos, etc.)
const BLOCKED_DOMAINS = [
  'test.com',
  'test.email',
  'email.com',
  'example.com',
  'example.org',
  'example.net',
  'test.test',
];

// Whitelist of legitimate email providers (to prevent false positives)
const LEGITIMATE_EMAIL_PROVIDERS = [
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.fr',
  'ymail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'protonmail.com',
  'proton.me',
  'aol.com',
  'mail.com',
  'zoho.com',
  'yandex.com',
  'gmx.com',
  'fastmail.com',
  'hey.com',
];

/**
 * Check if email domain is a legitimate provider
 */
const isLegitimateProvider = (email: string): boolean => {
  const domain = email.toLowerCase().split('@')[1];
  if (!domain) return false;
  
  return LEGITIMATE_EMAIL_PROVIDERS.includes(domain);
};

/**
 * Check if email domain is in the blocklist
 */
const isBlockedDomain = (email: string): boolean => {
  const domain = email.toLowerCase().split('@')[1];
  if (!domain) return true;
  
  return BLOCKED_DOMAINS.includes(domain);
};

/**
 * Validate email against blocklist and disposable email check
 * Returns validation result with error message if invalid
 */
export const validateEmail = (email: string): { valid: boolean; message?: string } => {
  // Check blocklist first (fastest check)
  if (isBlockedDomain(email)) {
    return { 
      valid: false, 
      message: "This email domain is not allowed. Please use a valid email address." 
    };
  }
  
  // Skip disposable check for legitimate providers (prevents false positives)
  if (isLegitimateProvider(email)) {
    return { valid: true };
  }
  
  // Check if disposable email
  if (isDisposable(email)) {
    return { 
      valid: false, 
      message: "Temporary email addresses are not allowed. Please use a valid email address." 
    };
  }
  
  return { valid: true };
};

/**
 * Custom Zod email schema with blocklist and disposable email validation
 */
export const emailSchema = z.string()
  .email("Invalid email address")
  .refine((email) => {
    const validation = validateEmail(email);
    return validation.valid;
  }, (email) => {
    const validation = validateEmail(email);
    return {
      message: validation.message || "Invalid email address",
    };
  });

