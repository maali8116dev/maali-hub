import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
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

    // Get applications with user and project info for emails
    const { data: applications, error: fetchError } = await supabaseAdmin
      .from("applications")
      .select(`
        id,
        user_id,
        status,
        project_id,
        projects!inner(title),
        profiles!applications_user_id_fkey(user_id, first_name, last_name, email)
      `)
      .in("id", applicationIds);

    if (fetchError) {
      console.error("Error fetching applications:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch applications", errorCode: "FETCH_ERROR" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (!applications || applications.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No applications found", errorCode: "NOT_FOUND" }),
        { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const now = new Date().toISOString();
    const defaultReviewNotes = status === "approved" 
      ? "Selected as winner (ranked)" 
      : status === "rejected"
      ? "Not selected (ranked)"
      : null;

    // Update applications
    const { data: updatedApps, error: updateError } = await supabaseAdmin
      .from("applications")
      .update({
        status,
        reviewed_by: user.id,
        reviewed_at: now,
        review_notes: reviewNotes || defaultReviewNotes,
        updated_at: now,
      })
      .in("id", applicationIds)
      .select("id, user_id, project_id, status");

    if (updateError) {
      console.error("Error updating applications:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to update applications", errorCode: "UPDATE_ERROR" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Log activity for each updated application
    await Promise.allSettled(
      updatedApps.map(async (app) => {
        try {
          await supabaseAdmin.from("activity_logs").insert({
            user_id: user.id,
            action_type: status === "approved" ? "approve" : status === "rejected" ? "reject" : "update",
            entity_type: "application",
            entity_id: app.id,
            description: `Application status updated to ${status}`,
            metadata: {
              application_id: app.id,
              project_id: app.project_id,
              status,
              reviewed_by: user.id,
            },
          });
        } catch (logError) {
          console.error(`Error logging activity for application ${app.id}:`, logError);
        }
      })
    );

    // Send emails and queue notifications
    // Database trigger will create notifications, but we'll queue emails here
    const baseUrl = Deno.env.get("SITE_URL") || req.headers.get("Origin") || "http://localhost:5173";
    
    await Promise.allSettled(
      applications.map(async (app: any) => {
        try {
          const projectTitle = app.projects?.title || "the project";
          const userEmail = app.profiles?.email;
          const userName = app.profiles?.first_name 
            ? `${app.profiles.first_name} ${app.profiles.last_name || ""}`.trim()
            : "Applicant";
          const applicationId = app.id;
          const dashboardUrl = `${baseUrl}/dashboard/applications/${applicationId}`;

          if (!userEmail) {
            console.warn(`No email found for application ${applicationId}`);
            return;
          }

          // Queue email based on status
          let emailType: string;
          let emailData: any;

          if (status === "approved") {
            emailType = "application_approved";
            emailData = {
              recipientName: userName,
              projectTitle,
              applicationId,
              statusMessage: reviewNotes || defaultReviewNotes,
              actionUrl: dashboardUrl,
            };
          } else if (status === "rejected") {
            emailType = "application_rejected";
            emailData = {
              recipientName: userName,
              projectTitle,
              statusMessage: reviewNotes || defaultReviewNotes,
              actionUrl: `${baseUrl}/projects`,
            };
          } else {
            // pending - use generic status update
            emailType = "status_update";
            emailData = {
              recipientName: userName,
              projectTitle,
              applicationId,
              statusMessage: `Your application status has been updated to ${status}`,
              actionUrl: dashboardUrl,
            };
          }

          // Queue email in email_queue table
          await supabaseAdmin.from("email_queue").insert({
            type: emailType,
            to_email: userEmail,
            payload: emailData,
            idempotency_key: `status_update:${applicationId}:${status}:${now}`,
          });
        } catch (emailError) {
          console.error(`Error queuing email for application ${app.id}:`, emailError);
          // Don't fail the update if email fails
        }
      })
    );

    return new Response(
      JSON.stringify({
        success: true,
        updatedCount: updatedApps.length,
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

