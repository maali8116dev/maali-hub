import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { authenticateRequest, jsonResponse } from "../_shared/auth.ts";
import { resolvePaystackSubscription, paystackRequest } from "../_shared/paystackApi.ts";
import { getPaystackPlanCode, parsePaystackCurrency } from "../_shared/paymentProvider.ts";

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
    .select(
      "id, provider_subscription_id, provider_customer_id, provider_payment_ref, billing_currency, payment_provider, paystack_email_token",
    )
    .eq("user_id", auth.user.id)
    .eq("tier", "member")
    .in("status", ["active", "pending_payment"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membership?.payment_provider !== "paystack") {
    return jsonResponse(req, 400, { error: "No Paystack subscription found for this account." });
  }

  const currency = parsePaystackCurrency(membership.billing_currency);
  const planCode = currency ? getPaystackPlanCode(currency) : null;

  let subCode = membership.provider_subscription_id?.startsWith("SUB_")
    ? membership.provider_subscription_id
    : null;

  if (!subCode) {
    const resolved = await resolvePaystackSubscription({
      customerCode: membership.provider_customer_id,
      email: auth.user.email ?? null,
      paymentRef: membership.provider_payment_ref,
      planCode,
    });
    subCode = resolved.subscriptionCode;

    if (membership.id && (subCode || resolved.customerCode || resolved.emailToken)) {
      await supabaseAdmin
        .from("memberships")
        .update({
          ...(subCode ? { provider_subscription_id: subCode } : {}),
          ...(resolved.customerCode && !membership.provider_customer_id
            ? { provider_customer_id: resolved.customerCode }
            : {}),
          ...(resolved.emailToken && !membership.paystack_email_token
            ? { paystack_email_token: resolved.emailToken }
            : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", membership.id);
    }
  }

  if (!subCode) {
    return jsonResponse(req, 400, {
      error: "Could not find your Paystack subscription. Contact support if this persists.",
    });
  }

  const res = await paystackRequest<ManageLinkResponse>(
    `/subscription/${encodeURIComponent(subCode)}/manage/link/`,
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
