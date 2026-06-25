import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { authenticateRequest, jsonResponse } from "../_shared/auth.ts";
import { paystackRequest } from "../_shared/paystackApi.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

type ManageLinkResponse = {
  status: boolean;
  message: string;
  data?: { link: string };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
  }

  if (!Deno.env.get("PAYSTACK_SECRET_KEY")) {
    return jsonResponse(req, 503, { error: "Paystack is not configured." });
  }

  const body = await req.json().catch(() => ({}));
  const auth = await authenticateRequest(req, { bodyToken: body.token ?? null });

  if (!auth.user) {
    return jsonResponse(req, 401, { error: auth.error ?? "Unauthorized" });
  }

  const { data: membership } = await supabaseAdmin
    .from("memberships")
    .select("provider_subscription_id, payment_provider")
    .eq("user_id", auth.user.id)
    .eq("tier", "member")
    .in("status", ["active", "pending_payment"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membership?.payment_provider !== "paystack" || !membership.provider_subscription_id) {
    return jsonResponse(req, 400, { error: "No Paystack subscription found for this account." });
  }

  const subCode = membership.provider_subscription_id;
  const res = await paystackRequest<ManageLinkResponse>(
    `/subscription/${encodeURIComponent(subCode)}/manage/link`,
    { method: "GET" },
  );

  const payload = res.data as ManageLinkResponse | null;
  const link = payload?.data?.link;

  if (!res.ok || !link) {
    console.error("[create-paystack-manage-link] failed:", res.raw);
    return jsonResponse(req, 502, {
      error: payload?.message ?? "Could not generate Paystack manage link.",
    });
  }

  return jsonResponse(req, 200, { url: link });
});
