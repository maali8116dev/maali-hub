import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, getCorsHeaders, jsonResponse } from "../_shared/auth.ts";
import { resolvePaystackSubscription, paystackRequest } from "../_shared/paystackApi.ts";
import { getPaystackPlanCode } from "../_shared/paymentProvider.ts";
import { activateMembership, supabaseAdmin } from "../_shared/activateMembership.ts";

type PaystackVerifyResponse = {
  status: boolean;
  message: string;
  data?: {
    status: string;
    reference: string;
    amount: number;
    currency: string;
    customer?: { customer_code?: string };
    metadata?: { userId?: string };
    plan_object?: { plan_code?: string };
    subscription_code?: string;
    subscription?: { subscription_code?: string };
  };
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!Deno.env.get("PAYSTACK_SECRET_KEY")) {
    return jsonResponse(req, 503, { error: "Paystack is not configured." });
  }

  const body = await req.json().catch(() => ({}));
  const auth = await authenticateRequest(req, { bodyToken: body.token ?? null });

  if (!auth.user) {
    return jsonResponse(req, 401, { error: auth.error ?? "Unauthorized" });
  }

  const reference = typeof body.reference === "string" ? body.reference : null;
  if (!reference) {
    return jsonResponse(req, 400, { error: "reference is required." });
  }

  try {
    const res = await paystackRequest<PaystackVerifyResponse>(
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );

    const verify = res.data;
    if (!res.ok || !verify?.status || !verify.data) {
      return jsonResponse(req, 502, { error: verify?.message ?? "Verification failed." });
    }

    const tx = verify.data;
    if (tx.status !== "success") {
      return jsonResponse(req, 200, { activated: false, status: tx.status });
    }

    // Security: the reference must belong to the calling user. Fail closed if
    // metadata is missing — fall back to our own membership row for ownership.
    let ownerId = tx.metadata?.userId ?? null;
    if (!ownerId) {
      const { data: row } = await supabaseAdmin
        .from("memberships")
        .select("user_id")
        .eq("provider_payment_ref", tx.reference)
        .maybeSingle();
      ownerId = row?.user_id ?? null;
    }
    if (ownerId !== auth.user.id) {
      return jsonResponse(req, 403, { error: "Reference does not belong to this account." });
    }

    const customerCode = tx.customer?.customer_code ?? null;
    const currency = (tx.currency ?? "NGN").toUpperCase();
    const planCode = getPaystackPlanCode(currency as "NGN" | "GHS" | "KES" | "ZAR");
    let subscriptionCode =
      tx.subscription_code ?? tx.subscription?.subscription_code ?? null;
    let emailToken: string | null = null;
    if (!subscriptionCode) {
      const resolved = await resolvePaystackSubscription({
        customerCode,
        email: auth.user.email ?? null,
        paymentRef: tx.reference,
        planCode,
      });
      subscriptionCode = resolved.subscriptionCode;
      emailToken = resolved.emailToken;
    }

    const activated = await activateMembership({
      userId: auth.user.id,
      provider: "paystack",
      providerPaymentRef: tx.reference,
      providerCustomerId: customerCode,
      providerSubscriptionId: subscriptionCode,
      paystackEmailToken: emailToken,
      billingCurrency: currency,
      amountMajor: Number(tx.amount ?? 0) / 100,
      amountSubunits: Number(tx.amount ?? 0),
    });

    return jsonResponse(req, 200, { activated, status: tx.status });
  } catch (err) {
    console.error("[verify-paystack-payment]", err);
    return jsonResponse(req, 500, { error: (err as Error).message });
  }
});
