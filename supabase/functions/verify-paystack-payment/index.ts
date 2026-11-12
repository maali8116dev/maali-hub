import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, getCorsHeaders, jsonResponse } from "../_shared/auth.ts";
import { resolvePaystackSubscription, paystackRequest } from "../_shared/paystackApi.ts";
import { getPaystackPlanCode, isPaystackMembershipCharge } from "../_shared/paymentProvider.ts";
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
    metadata?: {
      userId?: string;
      billingMode?: string;
      renewal_type?: string;
    };
    plan_object?: { plan_code?: string };
    plan?: string | null;
    subscription_code?: string;
    subscription?: { subscription_code?: string };
  };
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
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

    const txPlanCode = tx.plan_object?.plan_code ?? (typeof tx.plan === "string" ? tx.plan : null);
    if (!isPaystackMembershipCharge(Number(tx.amount ?? 0), tx.currency ?? "", txPlanCode)) {
      console.error(
        `[verify-paystack-payment] ${tx.reference}: ${tx.amount} ${tx.currency} is not a Full Membership charge`,
      );
      return jsonResponse(req, 400, { error: "Payment does not match the Full Membership price." });
    }

    let ownerId = tx.metadata?.userId ?? null;
    const { data: membershipRow } = await supabaseAdmin
      .from("memberships")
      .select("user_id, renewal_type")
      .eq("provider_payment_ref", tx.reference)
      .maybeSingle();

    if (!ownerId) {
      ownerId = membershipRow?.user_id ?? null;
    }
    if (ownerId !== auth.user.id) {
      return jsonResponse(req, 403, { error: "Reference does not belong to this account." });
    }

    const metaMode = tx.metadata?.billingMode ?? tx.metadata?.renewal_type;
    const isPrepaid =
      metaMode === "prepaid" || membershipRow?.renewal_type === "prepaid";

    const customerCode = tx.customer?.customer_code ?? null;
    const currency = (tx.currency ?? "NGN").toUpperCase();
    let subscriptionCode: string | null = null;
    let emailToken: string | null = null;

    if (!isPrepaid) {
      const planCode = getPaystackPlanCode(currency as "NGN" | "GHS" | "KES" | "ZAR");
      subscriptionCode =
        tx.subscription_code ?? tx.subscription?.subscription_code ?? null;
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
    }

    const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS).toISOString();

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
      expiresAt,
      renewalType: isPrepaid ? "prepaid" : "subscription",
    });

    return jsonResponse(req, 200, {
      activated,
      status: tx.status,
      billingMode: isPrepaid ? "prepaid" : "subscription",
    });
  } catch (err) {
    console.error("[verify-paystack-payment]", err);
    return jsonResponse(req, 500, { error: (err as Error).message });
  }
});
