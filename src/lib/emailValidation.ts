import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";

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

// Whitelist of legitimate email providers (to prevent false positives and save API calls)
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
 * Check if email domain is an educational institution domain
 * Recognizes .edu, .edu.*, .ac.* patterns (e.g., .edu.gh, .ac.uk, .edu.au)
 */
const isEducationalDomain = (email: string): boolean => {
  const domain = email.toLowerCase().split('@')[1];
  if (!domain) return false;
  
  // Check for .edu, .edu.*, .ac.* patterns
  return /\.edu(\.|$)/.test(domain) || /\.ac\./.test(domain);
};

/**
 * Check if email domain is a government domain
 * Recognizes .gov, .gov.* patterns
 */
const isGovernmentDomain = (email: string): boolean => {
  const domain = email.toLowerCase().split('@')[1];
  if (!domain) return false;
  
  return /\.gov(\.|$)/.test(domain);
};

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
 * Abstract API response interface
 */
interface AbstractEmailValidationResponse {
  email: string;
  autocorrect: string;
  deliverability: string;
  quality_score: string;
  is_valid_format: {
    value: boolean;
    text: string;
  };
  is_free_email: {
    value: boolean;
    text: string;
  };
  is_disposable_email: {
    value: boolean;
    text: string;
  };
  is_role_email: {
    value: boolean;
    text: string;
  };
  is_catchall_email: {
    value: boolean;
    text: string;
  };
  is_mx_found: {
    value: boolean;
    text: string;
  };
  is_smtp_valid: {
    value: boolean;
    text: string;
  };
}

/**
 * Validate email using server-side edge function (Abstract API)
 * Returns validation result with error message if invalid
 */
export const validateEmail = async (
  email: string
): Promise<{ valid: boolean; message?: string }> => {
  // Check blocklist first (fastest check, no API call)
  if (isBlockedDomain(email)) {
    return { 
      valid: false, 
      message: "This email domain is not allowed. Please use a valid email address." 
    };
  }

  // Skip API call for legitimate providers (saves API credits)
  if (isLegitimateProvider(email)) {
    return { valid: true };
  }

  // Skip API call for educational domains (they're always legitimate)
  if (isEducationalDomain(email)) {
    return { valid: true };
  }

  // Skip API call for government domains (they're always legitimate)
  if (isGovernmentDomain(email)) {
    return { valid: true };
  }

  try {
    const { data, error } = await supabase.functions.invoke('validate-email', {
      body: { email },
    });

    if (error) {
      console.error("Email validation edge function error:", error);
      return { valid: false, message: "Email validation failed. Please try again." };
    }

    return { 
      valid: data.valid, 
      message: data.message 
    };
  } catch (error) {
    console.error("Email validation error:", error);
    return { valid: false, message: "Email validation failed. Please try again." };
  }
};

/**
 * Synchronous email validation for basic checks (format and blocklist only)
 * Use this for immediate client-side feedback, then validate with Abstract API on submit
 */
const validateEmailSync = (email: string): { valid: boolean; message?: string } => {
  // Check blocklist first
  if (isBlockedDomain(email)) {
    return { 
      valid: false, 
      message: "This email domain is not allowed. Please use a valid email address." 
    };
  }

  // Basic format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { 
      valid: false, 
      message: "Invalid email address format." 
    };
  }

  return { valid: true };
};

/**
 * Custom Zod email schema with basic validation
 * Note: Full validation with Abstract API should be done separately in form submission handlers
 */
export const emailSchema = z.string()
  .email("Invalid email address")
  .refine((email) => {
    const validation = validateEmailSync(email);
    return validation.valid;
  }, (email) => {
    const validation = validateEmailSync(email);
    return {
      message: validation.message || "Invalid email address",
    };
  });

