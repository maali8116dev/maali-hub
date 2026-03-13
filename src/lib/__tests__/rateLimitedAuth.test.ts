import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the supabase client (used by rateLimitedSignIn/SignUp)
const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: any[]) => mockSignInWithPassword(...args),
      signUp: (...args: any[]) => mockSignUp(...args),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
    })),
  },
}));

import {
  rateLimitedAuth,
  rateLimitedSignIn,
  rateLimitedSignUp,
} from "../rateLimitedAuth";

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const EDGE_FUNCTION_URL = /\/functions\/v1\/rate-limited-auth$/;

function mockFetchResponse(status: number, body: Record<string, unknown>) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

/** Queue a sequence of responses -” each call to fetch pops the next one. */
function mockFetchSequence(
  responses: Array<{ status: number; body: Record<string, unknown> }>
) {
  const impl = vi.fn();
  responses.forEach((r, i) => {
    impl.mockResolvedValueOnce({
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: () => Promise.resolve(r.body),
    });
  });
  global.fetch = impl;
}

function mockFetchNetworkError() {
  global.fetch = vi.fn().mockRejectedValue(new Error("Failed to fetch"));
}

// â”€â”€â”€ Tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
describe("rateLimitedAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // â”€â”€â”€ rateLimitedAuth (raw Edge Function call) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  describe("rateLimitedAuth()", () => {
    it("returns data on successful 200 response", async () => {
      mockFetchResponse(200, { data: { user: { id: "u1" } } });

      const result = await rateLimitedAuth("sign_in", {
        email: "user@gmail.com",
        password: "pass123",
      });

      expect(result.error).toBeNull();
      expect(result.data).toEqual({ user: { id: "u1" } });
      expect(global.fetch).toHaveBeenCalledOnce();
    });

    it("returns rate limit error on 429 response", async () => {
      mockFetchResponse(429, {
        error: "Rate limit exceeded",
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many sign in attempts. Please try again later.",
        reset_at: "2026-02-12T13:00:00.000Z",
      });

      const result = await rateLimitedAuth("sign_in", {
        email: "user@gmail.com",
        password: "pass123",
      });

      expect(result.error).not.toBeNull();
      expect(result.error!.isRateLimited).toBe(true);
      expect(result.error!.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(result.error!.resetAt).toBe("2026-02-12T13:00:00.000Z");
      expect(result.data).toBeNull();
    });

    it("returns auth error on 400 response", async () => {
      mockFetchResponse(400, {
        error: "Invalid login credentials",
        code: "AUTH_ERROR",
      });

      const result = await rateLimitedAuth("sign_in", {
        email: "user@gmail.com",
        password: "wrong",
      });

      expect(result.error).not.toBeNull();
      expect(result.error!.isRateLimited).toBe(false);
      expect(result.error!.message).toContain("Invalid login credentials");
    });

    it("returns network error when fetch fails", async () => {
      mockFetchNetworkError();

      const result = await rateLimitedAuth("sign_in", {
        email: "user@gmail.com",
        password: "pass123",
      });

      expect(result.error).not.toBeNull();
      expect(result.error!.code).toBe("NETWORK_ERROR");
      expect(result.error!.isRateLimited).toBe(false);
      expect(result.error!.message).toContain("Failed to fetch");
    });

    it("sends correct headers including anon key", async () => {
      mockFetchResponse(200, { data: {} });

      await rateLimitedAuth("sign_up", {
        email: "new@gmail.com",
        password: "pass123",
      });

      const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toMatch(EDGE_FUNCTION_URL);
      expect(init.method).toBe("POST");
      expect(init.headers["Content-Type"]).toBe("application/json");
      expect(init.headers["Authorization"]).toMatch(/^Bearer /);
    });

    it("sends operation and payload in the request body", async () => {
      mockFetchResponse(200, { data: {} });

      await rateLimitedAuth("password_reset", {
        email: "user@gmail.com",
        options: { redirectTo: "http://localhost/auth" },
      });

      const body = JSON.parse(
        (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
      );
      expect(body.operation).toBe("password_reset");
      expect(body.email).toBe("user@gmail.com");
      expect(body.options.redirectTo).toBe("http://localhost/auth");
    });
  });

  // â”€â”€â”€ Simulated rate-limit exhaustion (N+1 calls) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  describe("rate limit exhaustion (sequential calls)", () => {
    it("allows the first N calls and denies the N+1th (sign_in, max=3)", async () => {
      // Simulate a server that allows 3 requests then returns 429 on the 4th.
      mockFetchSequence([
        { status: 200, body: { data: { user: { id: "u1" } } } },
        { status: 200, body: { data: { user: { id: "u1" } } } },
        { status: 200, body: { data: { user: { id: "u1" } } } },
        {
          status: 429,
          body: {
            error: "Rate limit exceeded",
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many sign in attempts. Please try again later.",
            remaining: 0,
            reset_at: "2026-02-12T13:00:00.000Z",
          },
        },
      ]);

      // First 3 calls succeed
      for (let i = 0; i < 3; i++) {
        const result = await rateLimitedAuth("sign_in", {
          email: "user@gmail.com",
          password: "pass123",
        });
        expect(result.error).toBeNull();
        expect(result.data).not.toBeNull();
      }

      // 4th call is rate-limited
      const denied = await rateLimitedAuth("sign_in", {
        email: "user@gmail.com",
        password: "pass123",
      });
      expect(denied.error).not.toBeNull();
      expect(denied.error!.isRateLimited).toBe(true);
      expect(denied.error!.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(denied.error!.resetAt).toBe("2026-02-12T13:00:00.000Z");
      expect(denied.data).toBeNull();

      // Confirm fetch was called exactly 4 times
      expect(global.fetch).toHaveBeenCalledTimes(4);
    });

    it("allows the first N sign-up calls and denies the N+1th (sign_up, max=3)", async () => {
      mockFetchSequence([
        { status: 200, body: { data: { user: { id: "new1" } } } },
        { status: 200, body: { data: { user: { id: "new2" } } } },
        { status: 200, body: { data: { user: { id: "new3" } } } },
        {
          status: 429,
          body: {
            error: "Rate limit exceeded",
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many sign up attempts. Please try again later.",
            remaining: 0,
            reset_at: "2026-02-12T14:00:00.000Z",
          },
        },
      ]);

      for (let i = 0; i < 3; i++) {
        const result = await rateLimitedAuth("sign_up", {
          email: `user${i}@gmail.com`,
          password: "pass123",
        });
        expect(result.error).toBeNull();
      }

      const denied = await rateLimitedAuth("sign_up", {
        email: "user4@gmail.com",
        password: "pass123",
      });
      expect(denied.error!.isRateLimited).toBe(true);
      expect(denied.data).toBeNull();
    });

    it("rateLimitedSignIn skips local auth on the denied call", async () => {
      mockFetchSequence([
        { status: 200, body: { data: { user: { id: "u1" } } } },
        {
          status: 429,
          body: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many sign in attempts.",
          },
        },
      ]);

      mockSignInWithPassword.mockResolvedValue({
        data: { session: { access_token: "tok" } },
        error: null,
      });

      // First call succeeds and signs in locally
      const ok = await rateLimitedSignIn("user@gmail.com", "pass123");
      expect(ok.error).toBeNull();
      expect(mockSignInWithPassword).toHaveBeenCalledTimes(1);

      // Second call is denied -” local auth must NOT be called again
      const denied = await rateLimitedSignIn("user@gmail.com", "pass123");
      expect(denied.error!.isRateLimited).toBe(true);
      expect(mockSignInWithPassword).toHaveBeenCalledTimes(1); // still 1, not 2
    });

    it("every denied response after the limit keeps returning rate-limited", async () => {
      // Simulate: 1 success, then 3 consecutive denials
      mockFetchSequence([
        { status: 200, body: { data: {} } },
        { status: 429, body: { code: "RATE_LIMIT_EXCEEDED", message: "Denied" } },
        { status: 429, body: { code: "RATE_LIMIT_EXCEEDED", message: "Denied" } },
        { status: 429, body: { code: "RATE_LIMIT_EXCEEDED", message: "Denied" } },
      ]);

      const ok = await rateLimitedAuth("password_reset", { email: "a@b.com" });
      expect(ok.error).toBeNull();

      for (let i = 0; i < 3; i++) {
        const denied = await rateLimitedAuth("password_reset", { email: "a@b.com" });
        expect(denied.error!.isRateLimited).toBe(true);
      }

      expect(global.fetch).toHaveBeenCalledTimes(4);
    });
  });

  // â”€â”€â”€ rateLimitedSignIn (convenience wrapper) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  describe("rateLimitedSignIn()", () => {
    it("establishes local session after successful rate limit check", async () => {
      mockFetchResponse(200, { data: { user: { id: "u1" } } });
      mockSignInWithPassword.mockResolvedValue({
        data: { session: { access_token: "tok" } },
        error: null,
      });

      const result = await rateLimitedSignIn("user@gmail.com", "pass123");

      expect(result.error).toBeNull();
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "user@gmail.com",
        password: "pass123",
      });
    });

    it("does NOT call supabase.auth if rate limited", async () => {
      mockFetchResponse(429, {
        message: "Rate limited",
        code: "RATE_LIMIT_EXCEEDED",
      });

      const result = await rateLimitedSignIn("user@gmail.com", "pass123");

      expect(result.error).not.toBeNull();
      expect(result.error!.isRateLimited).toBe(true);
      expect(mockSignInWithPassword).not.toHaveBeenCalled();
    });

    it("returns auth error if local signIn fails after rate limit passes", async () => {
      mockFetchResponse(200, { data: {} });
      mockSignInWithPassword.mockResolvedValue({
        data: { session: null },
        error: { message: "Invalid login credentials" },
      });

      const result = await rateLimitedSignIn("user@gmail.com", "wrong");

      expect(result.error).not.toBeNull();
      expect(result.error!.code).toBe("AUTH_ERROR");
      expect(result.error!.isRateLimited).toBe(false);
    });
  });

  // â”€â”€â”€ rateLimitedSignUp (convenience wrapper) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  describe("rateLimitedSignUp()", () => {
    it("establishes local session after successful rate limit check", async () => {
      mockFetchResponse(200, { data: { user: { id: "new-user" } } });
      mockSignUp.mockResolvedValue({
        data: { user: { id: "new-user" }, session: null },
        error: null,
      });

      const result = await rateLimitedSignUp("new@gmail.com", "pass123", {
        data: { first_name: "Test" },
      });

      expect(result.error).toBeNull();
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "new@gmail.com",
        password: "pass123",
        options: { data: { first_name: "Test" } },
      });
    });

    it("does NOT call supabase.auth.signUp if rate limited", async () => {
      mockFetchResponse(429, {
        message: "Rate limited",
        code: "RATE_LIMIT_EXCEEDED",
      });

      const result = await rateLimitedSignUp("new@gmail.com", "pass123");

      expect(result.error!.isRateLimited).toBe(true);
      expect(mockSignUp).not.toHaveBeenCalled();
    });
  });
});









