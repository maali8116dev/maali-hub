import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { authenticateRequest, jsonResponse } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  buildFaqLocaleTranslations,
  buildMentorLocaleTranslations,
  buildSuccessStoryLocaleTranslations,
  TRANSLATION_TARGET_LOCALES,
} from "../_shared/translate.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

type CmsEntity = "faq" | "mentor" | "success_story";

interface TranslateCmsRequest {
  entity: CmsEntity;
  id: number;
  token?: string;
}

async function isAdmin(userId: string): Promise<boolean> {
  const { data: role } = await supabaseAdmin.rpc("get_user_role", { user_uuid: userId });
  return role === "admin";
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

    const body = (await req.json()) as TranslateCmsRequest;
    const auth = await authenticateRequest(req, { bodyToken: body.token ?? null });

    if (!auth.user) {
      return jsonResponse(req, 401, { error: auth.error ?? "Unauthorized" });
    }

    if (!(await isAdmin(auth.user.id))) {
      return jsonResponse(req, 403, { error: "Forbidden" });
    }

    const id = Number(body.id);
    if (!Number.isFinite(id) || !body.entity) {
      return jsonResponse(req, 400, { error: "Invalid request" });
    }

    const translations: Record<string, unknown> = { source_locale: "en" };

    if (body.entity === "faq") {
      const { data: faq, error } = await supabaseAdmin
        .from("faqs")
        .select("id, question, answer, Sector")
        .eq("id", id)
        .single();

      if (error || !faq) {
        return jsonResponse(req, 404, { error: "FAQ not found" });
      }

      const fields = {
        question: faq.question ?? "",
        answer: faq.answer ?? "",
        sector: (faq.Sector as string) ?? "",
      };

      for (const locale of TRANSLATION_TARGET_LOCALES) {
        translations[locale] = await buildFaqLocaleTranslations(fields, locale);
      }

      const { error: updateError } = await supabaseAdmin
        .from("faqs")
        .update({ translations })
        .eq("id", id);

      if (updateError) {
        return jsonResponse(req, 500, { error: updateError.message });
      }
    } else if (body.entity === "mentor") {
      const { data: mentor, error } = await supabaseAdmin
        .from("mentors")
        .select("id, bio, expertise_areas")
        .eq("id", id)
        .single();

      if (error || !mentor) {
        return jsonResponse(req, 404, { error: "Mentor not found" });
      }

      const fields = {
        bio: mentor.bio,
        expertise_areas: mentor.expertise_areas,
      };

      for (const locale of TRANSLATION_TARGET_LOCALES) {
        translations[locale] = await buildMentorLocaleTranslations(fields, locale);
      }

      const { error: updateError } = await supabaseAdmin
        .from("mentors")
        .update({ translations })
        .eq("id", id);

      if (updateError) {
        return jsonResponse(req, 500, { error: updateError.message });
      }
    } else if (body.entity === "success_story") {
      const { data: story, error } = await supabaseAdmin
        .from("success_stories")
        .select("id, description, impact_metrics, sector, location")
        .eq("id", id)
        .single();

      if (error || !story) {
        return jsonResponse(req, 404, { error: "Success story not found" });
      }

      const fields = {
        description: story.description ?? "",
        impact_metrics: story.impact_metrics,
        sector: story.sector ?? "",
        location: story.location ?? "",
      };

      for (const locale of TRANSLATION_TARGET_LOCALES) {
        translations[locale] = await buildSuccessStoryLocaleTranslations(fields, locale);
      }

      const { error: updateError } = await supabaseAdmin
        .from("success_stories")
        .update({ translations })
        .eq("id", id);

      if (updateError) {
        return jsonResponse(req, 500, { error: updateError.message });
      }
    } else {
      return jsonResponse(req, 400, { error: "Unknown entity" });
    }

    return jsonResponse(req, 200, {
      success: true,
      entity: body.entity,
      id,
      locales: [...TRANSLATION_TARGET_LOCALES],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[translate-cms]", message);
    return jsonResponse(req, 500, { error: message });
  }
});
