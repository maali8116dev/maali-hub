import { describe, it, expect, vi, beforeEach } from "vitest";

// We need to mock supabase BEFORE the module loads (it auto-calls initRateLimitConfig)
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
    })),
  },
}));

// Now import the module under test
import { getRateLimit, rateLimitMessage, isRateLimitError } from "../rateLimits";
import type { RateLimitOperationType } from "../rateLimits";

describe("rateLimits", () => {
  // â”€â”€â”€ getRateLimit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  describe("getRateLimit", () => {
    it("returns fallback config for known operation types", () => {
      const config = getRateLimit("sign_in");
      expect(config).toEqual({ max: 5, window: 15 });
    });

    it("returns fallback config for application_submission", () => {
      const config = getRateLimit("application_submission");
      expect(config).toEqual({ max: 3, window: 60 });
    });

    it("returns all known operation types with valid config", () => {
      const operations: RateLimitOperationType[] = [
        "sign_in",
        "sign_up",
        "password_reset",
        "application_submission",
        "draft_save",
        "document_upload",
        "image_upload",
        "admin_project_create",
        "admin_project_update",
        "admin_user_management",
        "email_verification_resend",
      ];

      for (const op of operations) {
        const config = getRateLimit(op);
        expect(config.max).toBeGreaterThan(0);
        expect(config.window).toBeGreaterThan(0);
      }
    });

    it("returns generic fallback for unknown operation types", () => {
      // Cast to bypass TS -” simulates an unexpected value at runtime
      const config = getRateLimit("nonexistent_op" as RateLimitOperationType);
      expect(config.max).toBeDefined();
      expect(config.window).toBeDefined();
    });
  });

  // â”€â”€â”€ rateLimitMessage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  describe("rateLimitMessage", () => {
    it("generates a human-readable message for sign_in (minutes window)", () => {
      const msg = rateLimitMessage("sign_in");
      expect(msg).toContain("Too many requests");
      expect(msg).toContain("5");
      expect(msg).toContain("15 minute");
    });

    it("generates a human-readable message for sign_up (hour window)", () => {
      const msg = rateLimitMessage("sign_up");
      expect(msg).toContain("Too many requests");
      expect(msg).toContain("3");
      expect(msg).toContain("1 hour");
    });

    it("generates correct message for application_submission", () => {
      const msg = rateLimitMessage("application_submission");
      expect(msg).toContain("3");
      expect(msg).toContain("1 hour");
    });

    it("includes 'Please try again later'", () => {
      const msg = rateLimitMessage("sign_in");
      expect(msg).toContain("Please try again later");
    });
  });

  // â”€â”€â”€ isRateLimitError â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  describe("isRateLimitError", () => {
    it('detects "Too many" in error message', () => {
      expect(isRateLimitError("Too many application submissions")).toBe(true);
    });

    it('detects "rate limit" in error message (case insensitive)', () => {
      expect(isRateLimitError("Rate limit exceeded")).toBe(true);
    });

    it('detects "rate_limit" (underscore variant)', () => {
      expect(isRateLimitError("rate_limit_exceeded")).toBe(true);
    });

    it("returns false for unrelated error messages", () => {
      expect(isRateLimitError("Invalid login credentials")).toBe(false);
      expect(isRateLimitError("Network error")).toBe(false);
      expect(isRateLimitError("Permission denied")).toBe(false);
    });

    it("handles empty string", () => {
      expect(isRateLimitError("")).toBe(false);
    });
  });
});









