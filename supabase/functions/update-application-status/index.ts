import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0?no-dts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { authenticateRequest, jsonResponse } from "../_shared/auth.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

interface UpdateStatusRequest {
  applicationIds: string[];
  status: "approved" | "rejected" | "pending";
  reviewNotes?: string;
}

interface UpdateStatusResponse {
  success: boolean;
  updatedCount?: number;
  error?: string;
  errorCode?: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    // Parse body FIRST to get token fallback
    const body: UpdateStatusRequest & { token?: string } = await req.json();
    const { applicationIds, status, reviewNotes } = body;

    // Authenticate user
    const auth = await authenticateRequest(req, { bodyToken: body.token });
    if (!auth.user) {
      return jsonResponse(req, 401, {
        success: false,
        error: auth.error || "Unauthorized",
        errorCode: "UNAUTHORIZED",
      });
    }
    const user = auth.user;

    // Verify admin role
    const { data: roleData, error: roleError } = await supabaseAdmin.rpc("get_user_role", {
      user_uuid: user.id,
    });

    if (roleError || roleData !== "admin") {
      return jsonResponse(req, 403, {
        success: false,
        error: "Forbidden - Admin access required",
        errorCode: "FORBIDDEN",
      });
    }

    if (!applicationIds || applicationIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "At least one application ID is required", errorCode: "MISSING_IDS" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (!["approved", "rejected", "pending"].includes(status)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid status", errorCode: "INVALID_STATUS" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: `Bearer ${auth.token}` } },
      },
    );

    const { data: rpcResult, error: rpcError } = await userClient.rpc(
      "admin_update_application_status",
      {
        p_application_ids: applicationIds,
        p_status: status,
        p_review_notes: reviewNotes ?? null,
      },
    );

    if (rpcError) {
      console.error("admin_update_application_status:", rpcError);
      return new Response(
        JSON.stringify({
          success: false,
          error: rpcError.message || "Failed to update applications",
          errorCode: "RPC_ERROR",
        }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const result = rpcResult as { success?: boolean; error?: string; errorCode?: string; updatedCount?: number };
    if (!result?.success) {
      const statusCode = result?.errorCode === "NOT_FOUND" ? 404 : 400;
      return new Response(
        JSON.stringify({
          success: false,
          error: result?.error || "Update failed",
          errorCode: result?.errorCode || "UPDATE_FAILED",
        }),
        { status: statusCode, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        updatedCount: result.updatedCount ?? applicationIds.length,
      }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in update-application-status:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, errorCode: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});

