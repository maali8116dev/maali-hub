import { Context, Next } from "hono";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL environment variable is required. Please set it in your .env file.");
}

if (!supabaseServiceKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is required. Please set it in your .env file.");
}

// Create Supabase admin client for server-side auth verification
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Middleware to verify Supabase JWT token
 * Extracts token from Authorization header and verifies it
 */
export async function authMiddleware(c: Context, next: Next) {
  try {
    const authHeader = c.req.header("Authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized", message: "Missing or invalid authorization header" }, 401);
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Verify the token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return c.json({ error: "Unauthorized", message: "Invalid token" }, 401);
    }

    // Attach user to context for use in route handlers
    c.set("user", user);
    c.set("userId", user.id);

    await next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return c.json({ error: "Unauthorized", message: "Authentication failed" }, 401);
  }
}

/**
 * Optional middleware for routes that can work with or without auth
 */
export async function optionalAuthMiddleware(c: Context, next: Next) {
  try {
    const authHeader = c.req.header("Authorization");
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      
      if (user) {
        c.set("user", user);
        c.set("userId", user.id);
      }
    }
  } catch (error) {
    // Silently fail for optional auth
    console.error("Optional auth error:", error);
  }

  await next();
}

