import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { authenticateRequest, jsonResponse } from "../_shared/auth.ts";

/* ------------------------------------------------------------------ */
/*  Shared clients                                                     */
/* ------------------------------------------------------------------ */

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

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
  draftId?: string | null;
  projectId: number;
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

interface CheckoutCreationParams {
  req: Request;
  userId: string;
  userEmail: string | null;
  applicationId: string;
  projectId: number;
  feeValue: number;
  projectTitle: string;
}

interface ApplicationDocumentRef {
  id: string;
  application_id: string | null;
}

interface ReviewerAssignment {
  reviewer_id: string;
  assignment_id: string;
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
    .select("id, file_path, application_id")
    .in("id", documentIds)
    .eq("user_id", userId)
    .is("application_id", null);

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
  projectId: number;
  applicationId: string;
  documentIds: string[];
}) {
  const { userId, projectId, applicationId, documentIds } = params;
  if (!documentIds.length) return { linked: 0, failedIds: [] as string[] };

  const { data: docs, error: fetchErr } = await supabaseAdmin
    .from("application_documents")
    .select("id, application_id")
    .in("id", documentIds)
    .eq("user_id", userId);

  if (fetchErr) throw fetchErr;

  const docRows = (docs ?? []) as ApplicationDocumentRef[];
  const docMap = new Map(docRows.map((d) => [d.id, d]));
  const validUnlinkedIds = documentIds.filter((id) => {
    const d = docMap.get(id) as
      | { id: string; application_id: string | null }
      | undefined;
    return d && !d.application_id;
  });
  const failedIds = documentIds.filter((id) => !validUnlinkedIds.includes(id));

  if (!validUnlinkedIds.length) return { linked: 0, failedIds };

  const { count } = await supabaseAdmin
    .from("application_documents")
    .update({
      application_id: applicationId,
      project_id: projectId,
      is_library_document: false,
    })
    .in("id", validUnlinkedIds)
    .eq("user_id", userId)
    .is("application_id", null);

  return { linked: count ?? validUnlinkedIds.length, failedIds };
}

function getTrustedBaseUrl(req: Request): string {
  const configured = Deno.env.get("SITE_URL");
  if (configured) return configured.replace(/\/+$/, "");
  const origin = req.headers.get("origin");
  if (origin) return origin.replace(/\/+$/, "");
  return "http://localhost:5173";
}

async function createCheckoutSessionForApplication(
  params: CheckoutCreationParams,
) {
  const {
    req,
    userId,
    userEmail,
    applicationId,
    projectId,
    feeValue,
    projectTitle,
  } = params;

  const baseUrl = getTrustedBaseUrl(req);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: userEmail ?? undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: Math.round(feeValue * 100),
          product_data: {
            name: `Application Fee - ${projectTitle}`,
            description: `Application fee for ${projectTitle}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId,
      applicationId,
      projectId: projectId.toString(),
    },
    success_url: `${baseUrl}/payment/success?application_id=${encodeURIComponent(applicationId)}`,
    cancel_url: `${baseUrl}/payment/cancel?application_id=${encodeURIComponent(applicationId)}`,
  });

  await supabaseAdmin
    .from("transactions")
    .insert({
      user_id: userId,
      type: "application_fee",
      status: "pending",
      amount: feeValue,
      currency: "USD",
      provider: "stripe",
      provider_payment_intent_id: (session.payment_intent as string) || null,
      provider_transaction_id: session.id,
      description: `Application fee for ${projectTitle}`,
      billing_email: userEmail,
      application_id: applicationId,
      project_id: projectId,
      metadata: { checkout_session_id: session.id },
    })
    .then(({ error }) => {
      if (error) console.error("Transaction insert error:", error);
    });

  return session;
}

/** Build application row data from the request payload. */
function buildApplicationRow(
  applicationData: SubmitApplicationRequest["applicationData"],
  initialStatus: string,
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
  };

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
  projectId: number;
  projectTitle: string;
  applicantType: string;
  hasFee: boolean;
  initialStatus: string;
}) {
  const {
    userId,
    applicationId,
    projectId,
    projectTitle,
    applicantType,
    hasFee,
    initialStatus,
  } = params;

  // 1. Activity log
  try {
    await supabaseAdmin.from("activity_logs").insert({
      user_id: userId,
      action_type: "submit",
      entity_type: "application",
      entity_id: applicationId,
      description: `Submitted application for project ID: ${projectId}`,
      metadata: { projectId, applicantType, projectTitle },
    });
  } catch (e) {
    console.error("Activity log error:", e);
  }

  // 2. Notification
  const notificationMessage = hasFee
    ? `Your application for "${projectTitle}" has been successfully submitted. Please complete payment to proceed with review.`
    : `Your application for "${projectTitle}" has been successfully submitted and is now under review.`;

  try {
    await supabaseAdmin.rpc("create_notification", {
      p_user_id: userId,
      p_title: "Application Submitted",
      p_message: notificationMessage,
      p_type: "application",
      p_link: `/dashboard/applications/${applicationId}`,
      p_metadata: {
        application_id: applicationId,
        project_id: projectId,
        status: initialStatus,
      },
    });
  } catch (e) {
    console.error("Notification error:", e);
  }

  // 3. Reviewer assignment (only for free applications)
  if (!hasFee) {
    try {
      const notifyAdminsMissingReviewer = async (availableCount: number) => {
        try {
          const { data: admins, error: adminsError } = await supabaseAdmin
            .from("profiles")
            .select("user_id")
            .eq("role", "admin");

          if (adminsError) {
            console.error("Failed to fetch admins for missing reviewer notification:", adminsError);
            return;
          }

          const adminIds = (admins || []).map((a: any) => a.user_id).filter(Boolean);
          if (adminIds.length === 0) return;

          await Promise.allSettled(
            adminIds.map((adminId: string) =>
              supabaseAdmin.rpc("create_notification", {
                p_user_id: adminId,
                p_title: "Reviewer capacity needed",
                p_message: `Only ${availableCount} reviewer is available for "${projectTitle}". This application needs 2 reviewers. Please assign an additional reviewer.`,
                p_type: "review_assignment",
                p_link: `/admin/applications/${applicationId}`,
                p_metadata: {
                  application_id: applicationId,
                  project_id: projectId,
                  project_title: projectTitle,
                  required_reviewers: 2,
                  assigned_reviewers: availableCount,
                },
              })
            )
          );
        } catch (e) {
          console.error("Failed to notify admins about missing reviewer:", e);
        }
      };

      const PREFERRED_REVIEWERS = 2;
      let { data: assignments, error: assignError } = await supabaseAdmin.rpc(
        "assign_reviewers_to_application",
        { p_application_id: applicationId, p_num_reviewers: PREFERRED_REVIEWERS },
      );

      if (assignError) {
        const msg = assignError.message || "";
        const notEnough = msg.toLowerCase().includes("not enough available reviewers");

        if (notEnough) {
          const retry = await supabaseAdmin.rpc("assign_reviewers_to_application", {
            p_application_id: applicationId,
            p_num_reviewers: 1,
          });
          assignments = retry.data;
          assignError = retry.error;

          if (!assignError && assignments?.length === 1) {
            console.warn(
              `Only 1 reviewer assigned to application ${applicationId} due to limited capacity. Admin action required.`,
            );
            await notifyAdminsMissingReviewer(1);
          }
        }

        console.warn("Reviewer assignment failed:", assignError);
        await supabaseAdmin.from("activity_logs").insert({
          user_id: userId,
          action_type: "error",
          entity_type: "application",
          entity_id: applicationId,
          description: `Failed to assign reviewers: ${assignError.message}`,
          metadata: { application_id: applicationId, project_id: projectId },
        }).catch(() => {});
      } else if (assignments?.length) {
        await supabaseAdmin.from("activity_logs").insert({
          user_id: userId,
          action_type: "assign_reviewers",
          entity_type: "application",
          entity_id: applicationId,
          description: `Assigned ${assignments.length} reviewer(s)`,
          metadata: {
            application_id: applicationId,
            project_id: projectId,
            reviewer_count: assignments.length,
            reviewer_ids: (assignments as ReviewerAssignment[]).map((a) => a.reviewer_id),
          },
        }).catch(() => {});

        // Notify each reviewer
        await Promise.allSettled(
          (assignments as ReviewerAssignment[]).map((a) =>
            supabaseAdmin
              .rpc("create_notification", {
                p_user_id: a.reviewer_id,
                p_title: "New Application Assigned",
                p_message: `A new application for "${projectTitle}" has been assigned to you for review.`,
                p_type: "review_assigned",
                p_link: `/reviewer/applications/${applicationId}`,
                p_metadata: {
                  application_id: applicationId,
                  project_id: projectId,
                  assignment_id: a.assignment_id,
                },
              })
              .catch((err: unknown) =>
                console.error(`Notify reviewer ${a.reviewer_id} failed:`, err),
              ),
          ),
        );
      }
    } catch (e) {
      console.error("Reviewer assignment error:", e);
    }
  }
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
      projectId,
      applicationData,
      libraryDocumentIds: bodyDocIds = [],
    } = body;
    libraryDocumentIds = bodyDocIds;

    if (!projectId) {
      return jsonResponse(req, 400, {
        success: false,
        error: "Project ID is required",
        errorCode: "MISSING_PROJECT_ID",
      });
    }

    // ── 3. Validate via RPC ───────────────────────────────────────
    const { data: validation, error: validationError } =
      await supabaseAdmin.rpc("validate_application_submission", {
        p_user_id: user.id,
        p_project_id: projectId,
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

    const feeValue = v.project_fee != null ? Number(v.project_fee) : 0;
    const hasFee = feeValue > 0;
    const projectTitle =
      v.project_title || applicationData.project_title || "the project";
    const initialStatus = hasFee ? "pending_payment" : "pending";

    if (!v.can_submit) {
      console.log("[submit-application] decision=validation_blocked", {
        userId: user.id,
        projectId,
        hasExistingApplication: !!v.has_existing_application,
        existingApplicationId: v.existing_application_id ?? null,
        errorCode: v.has_existing_application ? "ALREADY_APPLIED" : "PROJECT_CLOSED",
      });

      if (v.has_existing_application) {
        const { data: existingApp, error: existingAppError } = await supabaseAdmin
          .from("applications")
          .select("id, user_id, project_id, status, application_fee_paid, contact_email")
          .eq("id", v.existing_application_id)
          .eq("user_id", user.id)
          .eq("project_id", projectId)
          .maybeSingle();

        if (existingAppError) {
          console.error("Existing application lookup error:", existingAppError);
          return jsonResponse(req, 500, {
            success: false,
            error: "Failed to inspect existing application",
            errorCode: "VALIDATION_ERROR",
            existingApplicationId: v.existing_application_id ?? null,
          });
        }

        const canResumeCheckout =
          !!existingApp &&
          !existingApp.application_fee_paid &&
          (existingApp.status === "pending_payment" || hasFee);

        if (canResumeCheckout && hasFee) {
          if (!Deno.env.get("STRIPE_SECRET_KEY")) {
            return jsonResponse(req, 500, {
              success: false,
              error: "Payment processing is not configured",
              errorCode: "CHECKOUT_ERROR",
              applicationId: existingApp.id,
            });
          }

          try {
            const checkoutUserEmail = user.email || existingApp.contact_email || applicationData.contact_email;
            const session = await createCheckoutSessionForApplication({
              req,
              userId: user.id,
              userEmail: checkoutUserEmail,
              applicationId: existingApp.id,
              projectId,
              feeValue,
              projectTitle,
            });

            console.log("[submit-application] decision=resume_checkout", {
              userId: user.id,
              projectId,
              applicationId: existingApp.id,
              checkoutSessionId: session.id,
            });

            return jsonResponse(req, 200, {
              success: true,
              applicationId: existingApp.id,
              requiresPayment: true,
              checkoutUrl: session.url,
              resumedExistingApplication: true,
            });
          } catch (checkoutError) {
            console.error("[submit-application] decision=checkout_failed", checkoutError);
            return jsonResponse(req, 500, {
              success: false,
              error: `Failed to create checkout session: ${
                checkoutError instanceof Error
                  ? checkoutError.message
                  : String(checkoutError)
              }`,
              errorCode: "CHECKOUT_ERROR",
              applicationId: existingApp.id,
            });
          }
        }
      }

      return jsonResponse(req, 409, {
        success: false,
        error: v.error_message || "Cannot submit application",
        errorCode: v.has_existing_application
          ? "ALREADY_APPLIED"
          : "PROJECT_CLOSED",
        existingApplicationId: v.existing_application_id ?? null,
      });
    }

    // ── 4. Create / update application ────────────────────────────
    const appRow = buildApplicationRow(applicationData, initialStatus);
    let application: { id: string } | null = null;

    if (draftId) {
      const { data, error } = await supabaseAdmin
        .from("applications")
        .update({ ...appRow, project_id: projectId })
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
        .insert({ user_id: user.id, project_id: projectId, ...appRow })
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
            .eq("project_id", projectId)
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
        projectId,
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
          projectId,
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
      projectId,
      projectTitle,
      applicantType: applicationData.applicant_type,
      hasFee,
      initialStatus,
    }).catch((e) => console.error("Side-effects error:", e));

    // ── 7. Create checkout session if fee required ─────────────────
    if (hasFee) {
      if (!Deno.env.get("STRIPE_SECRET_KEY")) {
        return jsonResponse(req, 500, {
          success: false,
          error: "Payment processing is not configured",
          errorCode: "CHECKOUT_ERROR",
          applicationId,
        });
      }

      try {
        const userEmail = user.email || applicationData.contact_email;
        const session = await createCheckoutSessionForApplication({
          req,
          userId: user.id,
          userEmail,
          applicationId,
          projectId,
          feeValue,
          projectTitle,
        });

        return jsonResponse(req, 200, {
          success: true,
          applicationId,
          checkoutUrl: session.url,
          requiresPayment: true,
          linkedDocumentCount: docResult.linked,
          ...(docResult.failedIds.length && {
            documentLinkWarnings: docResult.failedIds,
          }),
        });
      } catch (checkoutError) {
        console.error("[submit-application] decision=checkout_failed", checkoutError);
        await cleanupOrphanDocumentsForUser(user.id, libraryDocumentIds);
        return jsonResponse(req, 500, {
          success: false,
          error: `Failed to create checkout session: ${
            checkoutError instanceof Error
              ? checkoutError.message
              : String(checkoutError)
          }`,
          errorCode: "CHECKOUT_ERROR",
          applicationId,
        });
      }
    }

    // ── 8. Create $0 transaction record for free applications (audit trail) ──
    if (!hasFee) {
      const userEmail = user.email || applicationData.contact_email;
      await supabaseAdmin
        .from("transactions")
        .insert({
          user_id: user.id,
          type: "application_fee",
          status: "completed", // Auto-complete since no payment needed
          amount: 0,
          currency: "USD",
          provider: null, // No payment provider for free applications
          provider_payment_intent_id: null,
          provider_transaction_id: null,
          description: `Application fee for ${projectTitle} (Free)`,
          billing_email: userEmail,
          application_id: applicationId,
          project_id: projectId,
          completed_at: new Date().toISOString(),
          metadata: { is_free_application: true },
        })
        .then(({ error }) => {
          if (error) {
            console.error("Error creating $0 transaction record:", error);
            // Don't fail the submission if transaction record fails
          } else {
            console.log(`Created $0 transaction record for free application ${applicationId}`);
          }
        });
    }

    // ── 9. Success (no fee) ───────────────────────────────────────
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
