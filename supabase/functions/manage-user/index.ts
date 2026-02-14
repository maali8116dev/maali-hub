import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { getCorsHeaders } from "../_shared/cors.ts";
serve(async (req)=>{
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: getCorsHeaders(req)
    });
  }
  try {
    // Parse request body early to allow token fallback
    let body: any = null;
    try {
      body = await req.json();
    } catch (parseError) {
      // Ignore parse errors until we validate required fields later
    }

    // Get the authorization header - check multiple possible locations
    const authHeader = 
      req.headers.get("Authorization") || 
      req.headers.get("authorization") ||
      req.headers.get("x-supabase-auth-token") ||
      req.headers.get("x-supabase-authorization") ||
      req.headers.get("X-Supabase-Auth-Token") ||
      req.headers.get("X-Supabase-Authorization");
    
    const tokenFromHeader = authHeader?.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : authHeader;
    const tokenFromBody = body?.token;
    const token = tokenFromHeader || tokenFromBody;

    if (!token) {
      return new Response(JSON.stringify({
        error: "Missing authorization header"
      }), {
        status: 401,
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "application/json"
        }
      });
    }
    
    // Verify environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(JSON.stringify({
        error: "Server configuration error: Missing Supabase credentials"
      }), {
        status: 500,
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "application/json"
        }
      });
    }
    
    // Create Supabase client without auth header (token passed directly)
    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {}
    );
    
    // Verify the user is an admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError) {
      return new Response(JSON.stringify({
        error: "Unauthorized",
        details: userError.message || "Failed to authenticate user",
        code: userError.status || userError.code
      }), {
        status: 401,
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "application/json"
        }
      });
    }
    
    if (!user) {
      return new Response(JSON.stringify({
        error: "Unauthorized",
        details: "User not found in session"
      }), {
        status: 401,
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "application/json"
        }
      });
    }
    
    // Create admin client for role check and user management
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!serviceRoleKey) {
      return new Response(JSON.stringify({
        error: "Server configuration error: Service role key not set"
      }), {
        status: 500,
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "application/json"
        }
      });
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Check if user is admin (prefer app_metadata role, fallback to profiles role)
    const appRole = user.app_metadata?.role || user.user_metadata?.role;
    let profileRole: string | null = null;
    let profileErrorMessage: string | null = null;

    if (!appRole || appRole !== "admin") {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      
      profileRole = profile?.role ?? null;
      profileErrorMessage = profileError ? profileError.message : null;
    }

    const isAdmin = appRole === "admin" || profileRole === "admin";
    if (!isAdmin) {
      return new Response(JSON.stringify({
        error: "Admin access required",
        role: appRole || profileRole || "none"
      }), {
        status: 403,
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "application/json"
        }
      });
    }
    // Use the parsed body or re-parse if needed
    if (!body) {
      body = await req.json();
    }
    const { userId, action, reason } = body;
    if (!userId || !action) {
      return new Response(JSON.stringify({
        error: "Missing userId or action"
      }), {
        status: 400,
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "application/json"
        }
      });
    }
    // Prevent self-suspension
    if (userId === user.id && action === "suspend") {
      return new Response(JSON.stringify({
        error: "Cannot suspend your own account"
      }), {
        status: 400,
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "application/json"
        }
      });
    }
    // supabaseAdmin already created for role check
    // Perform the action
    if (action === "suspend") {
      // Suspend user by setting ban_duration (in hours)
      // Using a very large number to effectively make it permanent
      try {
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: "876000h"
        });
        if (error) {
          return new Response(JSON.stringify({
            error: error.message || "Failed to suspend user",
            details: error,
            code: error.status || error.code
          }), {
            status: 500,
            headers: {
              ...getCorsHeaders(req),
              "Content-Type": "application/json"
            }
          });
        }
        
        return new Response(JSON.stringify({
          success: true,
          message: "User suspended successfully",
          user: data?.user
        }), {
          status: 200,
          headers: {
            ...getCorsHeaders(req),
            "Content-Type": "application/json"
          }
        });
      } catch (err) {
        return new Response(JSON.stringify({
          error: err instanceof Error ? err.message : "Unknown error occurred"
        }), {
          status: 500,
          headers: {
            ...getCorsHeaders(req),
            "Content-Type": "application/json"
          }
        });
      }
    } else if (action === "activate") {
      // Activate user by removing ban (set ban_duration to 0)
      try {
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: "0"
        });
        if (error) {
          return new Response(JSON.stringify({
            error: error.message || "Failed to activate user",
            details: error,
            code: error.status || error.code
          }), {
            status: 500,
            headers: {
              ...getCorsHeaders(req),
              "Content-Type": "application/json"
            }
          });
        }
        
        console.log("User activated successfully");
        return new Response(JSON.stringify({
          success: true,
          message: "User activated successfully",
          user: data?.user
        }), {
          status: 200,
          headers: {
            ...getCorsHeaders(req),
            "Content-Type": "application/json"
          }
        });
      } catch (err) {
        return new Response(JSON.stringify({
          error: err instanceof Error ? err.message : "Unknown error occurred"
        }), {
          status: 500,
          headers: {
            ...getCorsHeaders(req),
            "Content-Type": "application/json"
          }
        });
      }
    } else {
      return new Response(JSON.stringify({
        error: "Invalid action. Use 'suspend' or 'activate'"
      }), {
        status: 400,
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "application/json"
        }
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Internal server error",
      type: error instanceof Error ? error.constructor.name : typeof error
    }), {
      status: 500,
      headers: {
        ...getCorsHeaders(req),
        "Content-Type": "application/json"
      }
    });
  }
});
