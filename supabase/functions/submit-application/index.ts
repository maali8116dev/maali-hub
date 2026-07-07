import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { authenticateRequest, jsonResponse, parseClientIp } from "../_shared/auth.ts";
import { buildNotificationMetadata } from "../_shared/notifications.ts";
import { verifyTurnstile } from "../_shared/turnstile.ts";

/* ------------------------------------------------------------------ */
/*  Shared clients                                                     */
/* ------------------------------------------------------------------ */

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SubmitApplicationRequest {
  token?: string;
  turnstileToken?: string;
  draftId?: string | null;
  opportunityId: number;
  submittedLocale?: string;
  applicationData: {
    applicant_type: string;
    full_legal_name: string;
    organization_name?: string | null;
    registration_id_number?: string | null;
    country_of_residence: string;
    city_region: string;
    contact_email: string;
    contact_phone: string;
    project_title: string;
    project_summary: string;
    geographic_focus: string;
    linkedin_url?: string | null;
    github_url?: string | null;
    twitter_url?: string | null;
    website_url?: string | null;
    other_social_links?: string | null;
    information_accurate_confirmed: boolean;
    conflict_of_interest_declared: boolean;
    reporting_requirements_agreed: boolean;
    data_processing_consented: boolean;
    // Organisational fields
    year_established?: number | null;
    core_mission_purpose?: string | null;
    primary_sectors?: string[] | null;
    primary_sector_other?: string | null;
    team_size?: number | null;
    key_team_members_roles?: string | null;
    previous_grants_funding_received?: boolean;
    previous_grants_funding_details?: string | null;
  };
  libraryDocumentIds?: string[];
}

interface ApplicationDocumentRef {
  id: string;
  application_id: string | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function cleanupOrphanDocumentsForUser(
  userId: string,
  documentIds: string[],
) {
  if (!documentIds.length) return;

  const { data: docs, error: fetchErr } = await supabaseAdmin
    .from("application_documents")
    .select("id, file_path, application_id, is_library_document")
    .in("id", documentIds)
    .eq("user_id", userId)
    .is("application_id", null)
    .eq("is_library_document", false);

  if (fetchErr || !docs?.length) return;

  const orphanIds = docs.map((d) => d.id);
  const orphanPaths = docs
    .map((d) => d.file_path)
    .filter((p): p is string => typeof p === "string" && p.length > 0);

  const { error: delErr } = await supabaseAdmin
    .from("application_documents")
    .delete()
    .in("id", orphanIds)
    .eq("user_id", userId)
    .is("application_id", null);

  if (delErr) {
    console.error("[cleanup] delete rows failed:", delErr);
    return;
  }

  // Remove storage objects that are no longer referenced anywhere
  const uniquePaths = [...new Set(orphanPaths)];
  await Promise.allSettled(
    uniquePaths.map(async (filePath) => {
      try {
        const { count } = await supabaseAdmin
          .from("application_documents")
          .select("id", { count: "exact", head: true })
          .eq("file_path", filePath);

        if (!count || count === 0) {
          await supabaseAdmin.storage
            .from("application-docs")
            .remove([filePath]);
        }
      } catch (e) {
        console.error("[cleanup] storage error:", filePath, e);
      }
    }),
  );
}

async function linkDocumentsToApplication(params: {
  userId: string;
  opportunityId: number;
  applicationId: string;
  documentIds: string[];
}) {
  const { userId, opportunityId, applicationId, documentIds } = params;
  if (!documentIds.length) return { linked: 0, failedIds: [] as string[] };

  const { data: docs, error: fetchErr } = await supabaseAdmin
    .from("application_documents")
    .select("id, application_id, file_name, file_path, file_size, file_type, is_library_document")
    .in("id", documentIds)
    .eq("user_id", userId);

  if (fetchErr) throw fetchErr;

  const docRows = (docs ?? []) as Array<{
    id: string;
    application_id: string | null;
    file_name: string;
    file_path: string;
    file_size: number | null;
    file_type: string | null;
    is_library_document: boolean | null;
  }>;
  const docMap = new Map(docRows.map((d) => [d.id, d]));

  const existingDocs = documentIds
    .map((id) => docMap.get(id))
    .filter((d): d is NonNullable<typeof d> => !!d);
  const failedIds = documentIds.filter((id) => !docMap.has(id));
  const unlinkedDocs = existingDocs.filter((d) => !d.application_id);
  failedIds.push(...existingDocs.filter((d) => !!d.application_id).map((d) => d.id));

  const uploadDocIds = unlinkedDocs
    .filter((d) => !d.is_library_document)
    .map((d) => d.id);
  const libraryDocs = unlinkedDocs.filter((d) => !!d.is_library_document);

  let linkedCount = 0;

  // For freshly uploaded docs, link in-place.
  if (uploadDocIds.length > 0) {
    const { count } = await supabaseAdmin
      .from("application_documents")
      .update({
        application_id: applicationId,
        opportunity_id: opportunityId,
      })
      .in("id", uploadDocIds)
      .eq("user_id", userId)
      .is("application_id", null)
      .eq("is_library_document", false);
    linkedCount += count ?? uploadDocIds.length;
  }

  // For library docs, keep originals and create linked copies.
  if (libraryDocs.length > 0) {
    const inserts = libraryDocs.map((d) => ({
      user_id: userId,
      application_id: applicationId,
      opportunity_id: opportunityId,
      file_name: d.file_name,
      file_path: d.file_path,
      file_size: d.file_size,
      file_type: d.file_type,
      is_library_document: false,
    }));

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("application_documents")
      .insert(inserts)
      .select("id");

    if (insertErr) throw insertErr;
    linkedCount += inserted?.length ?? inserts.length;
  }

  return { linked: linkedCount, failedIds };
}

/** Build application row data from the request payload. */
function buildApplicationRow(
  applicationData: SubmitApplicationRequest["applicationData"],
  initialStatus: string,
  submittedLocale?: string,
) {
  const row: Record<string, unknown> = {
    applicant_type: applicationData.applicant_type,
    full_legal_name: applicationData.full_legal_name,
    organization_name: applicationData.organization_name || null,
    registration_id_number: applicationData.registration_id_number || null,
    country_of_residence: applicationData.country_of_residence,
    city_region: applicationData.city_region,
    contact_email: applicationData.contact_email,
    contact_phone: applicationData.contact_phone,
    project_title: applicationData.project_title,
    project_summary: applicationData.project_summary,
    geographic_focus: applicationData.geographic_focus,
    linkedin_url: applicationData.linkedin_url || null,
    github_url: applicationData.github_url || null,
    twitter_url: applicationData.twitter_url || null,
    website_url: applicationData.website_url || null,
    other_social_links: applicationData.other_social_links || null,
    information_accurate_confirmed: applicationData.information_accurate_confirmed,
    conflict_of_interest_declared: applicationData.conflict_of_interest_declared,
    reporting_requirements_agreed: applicationData.reporting_requirements_agreed,
    data_processing_consented: applicationData.data_processing_consented,
    declaration_date: new Date().toISOString(),
    status: initialStatus,
    is_draft: false,
    application_fee_paid: false,
    stripe_payment_intent_id: null,
    translations: {},
  };

  if (submittedLocale?.trim()) {
    row.submitted_locale = submittedLocale.trim().toLowerCase();
  }

  if (applicationData.applicant_type !== "Individual") {
    row.year_established = applicationData.year_established || null;
    row.core_mission_purpose = applicationData.core_mission_purpose || null;
    row.primary_sectors = applicationData.primary_sectors
      ? JSON.stringify(applicationData.primary_sectors)
      : null;
    row.primary_sector_other = applicationData.primary_sector_other || null;
    row.team_size = applicationData.team_size || null;
    row.key_team_members_roles = applicationData.key_team_members_roles || null;
    row.previous_grants_funding_received =
      applicationData.previous_grants_funding_received || false;
    row.previous_grants_funding_details =
      applicationData.previous_grants_funding_details || null;
  }

  return row;
}

/** Fire-and-forget side-effects (activity log, notification, reviewer assignment). */
async function runSideEffects(params: {
  userId: string;
  applicationId: string;
  opportunityId: number;
  opportunityTitle: string;
  applicantType: string;
  initialStatus: string;
}) {
  const {
    userId,
    applicationId,
    opportunityId,
    opportunityTitle,
    applicantType,
    initialStatus,
  } = params;

  // 1. Activity log
  try {
    await supabaseAdmin.from("activity_logs").insert({
      user_id: userId,
      action_type: "submit",
      entity_type: "application",
      entity_id: applicationId,
      description: `Submitted application for opportunity ID: ${opportunityId}`,
      metadata: { opportunityId, applicantType, opportunityTitle },
    });
  } catch (e) {
    console.error("Activity log error:", e);
  }

  // 2. Notification
  const notificationMessage = `Your application for "${opportunityTitle}" has been successfully submitted and is now under review.`;

  try {
    await supabaseAdmin.rpc("create_notification", {
      p_user_id: userId,
      p_title: "Application Submitted",
      p_message: notificationMessage,
      p_type: "application",
      p_link: `/dashboard/applications/${applicationId}`,
      p_metadata: buildNotificationMetadata("application.submitted", { opportunityTitle }, {
        application_id: applicationId,
        opportunity_id: opportunityId,
        status: initialStatus,
      }),
    });
  } catch (e) {
    console.error("Notification error:", e);
  }

  // Reviewer assignment is handled by the Stripe webhook once payment is
  // confirmed (see stripe-webhook/handlers.ts: assignReviewersToApplication).
  // We do NOT assign reviewers here to avoid duplicate assignments on
  // unpaid/pending_payment applications.
}

/* ------------------------------------------------------------------ */
/*  Main handler                                                       */
/* ------------------------------------------------------------------ */

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  let authedUserId: string | null = null;
  let libraryDocumentIds: string[] = [];

  try {
    // ── 1. Parse body FIRST (need token fallback for auth) ────────
    let body: SubmitApplicationRequest;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(req, 400, {
        success: false,
        error: "Invalid request body",
        errorCode: "INVALID_BODY",
      });
    }

    // ── 2. Authenticate (headers → body.token fallback) ───────────
    const auth = await authenticateRequest(req, { bodyToken: body.token });
    if (!auth.user) {
      return jsonResponse(req, 401, {
        success: false,
        error: `Unauthorized - ${auth.error}`,
        errorCode: "UNAUTHORIZED",
      });
    }
    const user = auth.user;
    authedUserId = user.id;

    const {
      draftId,
      opportunityId,
      applicationData,
      libraryDocumentIds: bodyDocIds = [],
    } = body;
    libraryDocumentIds = bodyDocIds;

    if (!opportunityId) {
      return jsonResponse(req, 400, {
        success: false,
        error: "Opportunity ID is required",
        errorCode: "MISSING_OPPORTUNITY_ID",
      });
    }

    // ── 2b. Captcha check ──────────────────────────────────────────
    const captcha = await verifyTurnstile(body.turnstileToken, parseClientIp(req));
    if (!captcha.success) {
      return jsonResponse(req, 400, {
        success: false,
        error: "Captcha verification failed",
        errorCode: "CAPTCHA_FAILED",
      });
    }

    // ── 3. Validate via RPC ───────────────────────────────────────
    const { data: validation, error: validationError } =
      await supabaseAdmin.rpc("validate_application_submission", {
        p_user_id: user.id,
        p_opportunity_id: opportunityId,
      });

    if (validationError) {
      console.error("Validation RPC error:", validationError);
      return jsonResponse(req, 500, {
        success: false,
        error: `Validation failed: ${validationError.message}`,
        errorCode: "VALIDATION_ERROR",
      });
    }

    // RPC returns TABLE (single row), extract the first result
    const v = Array.isArray(validation) ? validation[0] : validation;
    if (!v || typeof v !== "object") {
      return jsonResponse(req, 500, {
        success: false,
        error: "Invalid validation response from server",
        errorCode: "VALIDATION_ERROR",
      });
    }

    const opportunityTitle =
      v.opportunity_title || applicationData.project_title || "the opportunity";
    const initialStatus = "pending";

    if (!v.can_submit) {
      let errorCode = "OPPORTUNITY_CLOSED";
      if (v.has_existing_application) {
        errorCode = "ALREADY_APPLIED";
      } else if (v.reason === "Full membership required") {
        errorCode = "MEMBERSHIP_REQUIRED";
      }

      console.log("[submit-application] decision=validation_blocked", {
        userId: user.id,
        opportunityId,
        opportunityStatus: v.opportunity_status ?? "(null)",
        opportunityDeadline: v.deadline ?? "(null)",
        hasExistingApplication: !!v.has_existing_application,
        existingApplicationId: v.existing_application_id ?? null,
        errorCode,
      });

      return jsonResponse(req, errorCode === "MEMBERSHIP_REQUIRED" ? 403 : 409, {
        success: false,
        error: v.reason || "Cannot submit application",
        errorCode,
        existingApplicationId: v.existing_application_id ?? null,
        opportunityStatus: v.opportunity_status ?? null,
        opportunityDeadline: v.deadline ?? null,
      });
    }

    // ── 4. Create / update application ────────────────────────────
    const appRow = buildApplicationRow(applicationData, initialStatus, body.submittedLocale);
    let application: { id: string } | null = null;

    if (draftId) {
      const { data, error } = await supabaseAdmin
        .from("applications")
        .update({ ...appRow, opportunity_id: opportunityId })
        .eq("id", draftId)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) {
        console.error("Update error:", error);
        return jsonResponse(req, 500, {
          success: false,
          error: `Failed to update application: ${error.message}`,
          errorCode: "UPDATE_ERROR",
        });
      }
      application = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from("applications")
        .insert({ user_id: user.id, opportunity_id: opportunityId, ...appRow })
        .select()
        .single();

      if (error) {
        console.error("Insert error:", error);
        // Handle race condition: if validation passed but insert fails due to unique constraint,
        // it means another submission happened simultaneously
        if (
          error.code === "23505" ||
          error.message?.includes("idx_applications_unique_user_project")
        ) {
          const { data: existingApplication } = await supabaseAdmin
            .from("applications")
            .select("id")
            .eq("user_id", user.id)
            .eq("opportunity_id", opportunityId)
            .eq("is_draft", false)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          return jsonResponse(req, 409, {
            success: false,
            error: "You already submitted an application for this opportunity",
            errorCode: "ALREADY_APPLIED",
            existingApplicationId: existingApplication?.id ?? null,
          });
        }
        return jsonResponse(req, 500, {
          success: false,
          error: `Failed to create application: ${error.message}`,
          errorCode: "CREATE_ERROR",
        });
      }
      application = data;
      console.log("[submit-application] decision=new_application_created", {
        userId: user.id,
        opportunityId,
        applicationId: application?.id ?? null,
      });
    }

    if (!application?.id) {
      return jsonResponse(req, 500, {
        success: false,
        error: "Application was created but has no ID",
        errorCode: "CREATE_ERROR",
      });
    }

    const applicationId: string = application.id;

    // ── 5. Link documents ─────────────────────────────────────────
    let docResult = { linked: 0, failedIds: [] as string[] };

    if (libraryDocumentIds.length > 0) {
      try {
        docResult = await linkDocumentsToApplication({
          userId: user.id,
          opportunityId,
          applicationId,
          documentIds: libraryDocumentIds,
        });
        if (docResult.failedIds.length) {
          console.warn("[docs] Some IDs could not be linked:", docResult.failedIds);
        }
      } catch (linkErr) {
        console.error("[docs] Link error:", linkErr);
        await cleanupOrphanDocumentsForUser(user.id, libraryDocumentIds);
      }
    }

    // ── 6. Side-effects (fire-and-forget) ─────────────────────────
    // We don't await this — failures must not block the response
    runSideEffects({
      userId: user.id,
      applicationId,
      opportunityId,
      opportunityTitle,
      applicantType: applicationData.applicant_type,
      initialStatus,
    }).catch((e) => console.error("Side-effects error:", e));

    const userEmail = user.email || applicationData.contact_email;
    await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: user.id,
        type: "application_fee",
        status: "completed",
        amount: 0,
        currency: "USD",
        provider: null,
        provider_payment_intent_id: null,
        provider_transaction_id: null,
        description: `Application for ${opportunityTitle} (membership)`,
        billing_email: userEmail,
        application_id: applicationId,
        opportunity_id: opportunityId,
        completed_at: new Date().toISOString(),
        metadata: { membership_gated: true },
      })
      .then(({ error }) => {
        if (error) console.error("Error creating audit transaction record:", error);
      });

    // ── 7. Success ────────────────────────────────────────────────
    return jsonResponse(req, 200, {
      success: true,
      applicationId,
      requiresPayment: false,
      linkedDocumentCount: docResult.linked,
      ...(docResult.failedIds.length && {
        documentLinkWarnings: docResult.failedIds,
      }),
    });
  } catch (error: unknown) {
    console.error("Error in submit-application:", error);

    if (authedUserId && libraryDocumentIds.length > 0) {
      await cleanupOrphanDocumentsForUser(authedUserId, libraryDocumentIds);
    }

    return jsonResponse(req, 500, {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      errorCode: "INTERNAL_ERROR",
    });
  }
});
