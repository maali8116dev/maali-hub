import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0?no-dts";
import { authenticateRequest, jsonResponse } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  APPLICATION_TRANSLATABLE_TEXT_FIELDS,
  buildApplicationLocaleTranslations,
} from "../_shared/translate.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

interface TranslateApplicationRequest {
  applicationId: string;
  targetLocale: string;
  token?: string;
}

function parsePrimarySectors(value: unknown): string[] | null {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return [value];
    }
  }
  return null;
}

async function canTranslateApplication(userId: string, applicationId: string): Promise<boolean> {
  const { data: role } = await supabaseAdmin.rpc("get_user_role", { user_uuid: userId });
  if (role === "admin") return true;

  if (role === "reviewer") {
    const { data } = await supabaseAdmin
      .from("application_assignments")
      .select("id")
      .eq("application_id", applicationId)
      .eq("reviewer_id", userId)
      .maybeSingle();
    return Boolean(data);
  }

  return false;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, 405, { error: "Method not allowed" });
  }

  try {
    if (!Deno.env.get("GOOGLE_CLOUD_TRANSLATE_API_KEY")) {
      return jsonResponse(req, 200, { skipped: true, reason: "translation_not_configured" });
    }

    const body = (await req.json()) as TranslateApplicationRequest;
    const auth = await authenticateRequest(req, { bodyToken: body.token ?? null });

    if (!auth.user) {
      return jsonResponse(req, 401, { error: auth.error ?? "Unauthorized" });
    }

    const applicationId = body.applicationId?.trim();
    const targetLocale = body.targetLocale?.trim().toLowerCase();

    if (!applicationId || !targetLocale) {
      return jsonResponse(req, 400, { error: "Invalid request" });
    }

    if (!(await canTranslateApplication(auth.user.id, applicationId))) {
      return jsonResponse(req, 403, { error: "Forbidden" });
    }

    const { data: application, error: fetchError } = await supabaseAdmin
      .from("applications")
      .select(
        `id, updated_at, submitted_locale, translations,
        ${APPLICATION_TRANSLATABLE_TEXT_FIELDS.join(", ")},
        primary_sectors`,
      )
      .eq("id", applicationId)
      .single();

    if (fetchError || !application) {
      return jsonResponse(req, 404, { error: "Application not found" });
    }

    const existing = (application.translations ?? {}) as Record<string, unknown>;
    const sourceLocale =
      (application.submitted_locale as string | null) ||
      (existing.source_locale as string | undefined) ||
      "en";

    if (sourceLocale === targetLocale) {
      return jsonResponse(req, 200, {
        success: true,
        cached: true,
        reason: "same_locale",
        applicationId,
        targetLocale,
      });
    }

    const contentVersion = application.updated_at as string;
    const cachedLocale = existing[targetLocale];
    if (
      existing.content_version === contentVersion &&
      cachedLocale &&
      typeof cachedLocale === "object" &&
      !Array.isArray(cachedLocale)
    ) {
      return jsonResponse(req, 200, {
        success: true,
        cached: true,
        applicationId,
        targetLocale,
        sourceLocale,
      });
    }

    const fields = {
      project_title: application.project_title as string,
      project_summary: application.project_summary as string,
      geographic_focus: application.geographic_focus as string,
      core_mission_purpose: application.core_mission_purpose as string | null,
      primary_sector_other: application.primary_sector_other as string | null,
      key_team_members_roles: application.key_team_members_roles as string | null,
      previous_grants_funding_details: application.previous_grants_funding_details as string | null,
      other_social_links: application.other_social_links as string | null,
      primary_sectors: parsePrimarySectors(application.primary_sectors),
    };

    const localeTranslations = await buildApplicationLocaleTranslations(
      fields,
      targetLocale,
      sourceLocale,
    );

    const translations = {
      ...existing,
      source_locale: sourceLocale,
      content_version: contentVersion,
      [targetLocale]: localeTranslations,
    };

    const { error: updateError } = await supabaseAdmin
      .from("applications")
      .update({ translations })
      .eq("id", applicationId);

    if (updateError) {
      return jsonResponse(req, 500, { error: updateError.message });
    }

    return jsonResponse(req, 200, {
      success: true,
      cached: false,
      applicationId,
      targetLocale,
      sourceLocale,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[translate-application]", message);
    return jsonResponse(req, 500, { error: message });
  }
});
