import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { authenticateRequest, jsonResponse } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  buildLocaleTranslations,
  TRANSLATION_TARGET_LOCALES,
} from "../_shared/translate.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

interface TranslateOpportunityRequest {
  opportunityId: number;
  token?: string;
}

async function canTranslateOpportunity(userId: string, opportunityId: number): Promise<boolean> {
  const { data: role } = await supabaseAdmin.rpc("get_user_role", { user_uuid: userId });
  if (role === "admin") return true;

  const { data: opportunity } = await supabaseAdmin
    .from("opportunities")
    .select("partner_id, created_by")
    .eq("id", opportunityId)
    .maybeSingle();

  if (!opportunity) return false;
  if (opportunity.created_by === userId) return true;

  const { data: partner } = await supabaseAdmin
    .from("partners")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  return Boolean(partner?.id && opportunity.partner_id === partner.id);
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

    const body = (await req.json()) as TranslateOpportunityRequest;
    const auth = await authenticateRequest(req, { bodyToken: body.token ?? null });

    if (!auth.user) {
      return jsonResponse(req, 401, { error: auth.error ?? "Unauthorized" });
    }

    const opportunityId = Number(body.opportunityId);
    if (!Number.isFinite(opportunityId)) {
      return jsonResponse(req, 400, { error: "Invalid opportunityId" });
    }

    const allowed = await canTranslateOpportunity(auth.user.id, opportunityId);
    if (!allowed) {
      return jsonResponse(req, 403, { error: "Forbidden" });
    }

    const { data: opportunity, error: fetchError } = await supabaseAdmin
      .from("opportunities")
      .select("id, title, description, requirements, eligibility_criteria")
      .eq("id", opportunityId)
      .single();

    if (fetchError || !opportunity) {
      return jsonResponse(req, 404, { error: "Opportunity not found" });
    }

    const fields = {
      title: opportunity.title ?? "",
      description: opportunity.description ?? "",
      requirements: opportunity.requirements,
      eligibility_criteria: opportunity.eligibility_criteria,
    };

    const translations: Record<string, unknown> = {
      source_locale: "en",
    };

    for (const locale of TRANSLATION_TARGET_LOCALES) {
      translations[locale] = await buildLocaleTranslations(fields, locale);
    }

    const { error: updateError } = await supabaseAdmin
      .from("opportunities")
      .update({ translations })
      .eq("id", opportunityId);

    if (updateError) {
      return jsonResponse(req, 500, { error: updateError.message });
    }

    return jsonResponse(req, 200, {
      success: true,
      opportunityId,
      locales: [...TRANSLATION_TARGET_LOCALES],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[translate-opportunity]", message);
    return jsonResponse(req, 500, { error: message });
  }
});
