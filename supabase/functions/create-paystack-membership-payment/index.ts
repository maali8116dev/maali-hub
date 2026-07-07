import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { authenticateRequest, getCorsHeaders, jsonResponse } from "../_shared/auth.ts";
import {
  getPaystackPlanCode,
  parsePaystackCurrency,
  PAYSTACK_CURRENCIES,
} from "../_shared/paymentProvider.ts";
import { paystackRequest } from "../_shared/paystackApi.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

type PaystackInitResponse = {
  status: boolean;
  message: string;
  data?: {
    access_code: string;
    reference: string;
    authorization_url: string;
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

  const currency = parsePaystackCurrency(body.currency);
  if (!currency) {
    return jsonResponse(req, 400, { error: "currency is required (NGN, GHS, KES, or ZAR)." });
  }

  const planCode = getPaystackPlanCode(currency);
  if (!planCode) {
    return jsonResponse(req, 503, {
      error: `Paystack plan for ${currency} is not configured.`,
    });
  }

  const userId = auth.user.id;
  const userEmail = auth.user.email as string | undefined;
  if (!userEmail) {
    return jsonResponse(req, 400, { error: "Account email is required for Paystack checkout." });
  }

  const pricing = PAYSTACK_CURRENCIES[currency];

  try {
    const { data: existingMembership } = await supabaseAdmin
      .from("memberships")
      .select(
        "id, tier, status, payment_provider, provider_subscription_id, provider_payment_ref",
      )
      .eq("user_id", userId)
      .in("status", ["active", "pending_payment"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingMembership?.tier === "member" && existingMembership?.status === "active") {
      return jsonResponse(req, 409, { error: "You already have an active Full Membership." });
    }

    if (
      existingMembership?.payment_provider &&
      existingMembership.payment_provider !== "paystack"
    ) {
      return jsonResponse(req, 409, {
        error: "Your membership checkout is locked to Stripe. Use card payment to continue.",
      });
    }

    const reference = `mbr_${userId.replace(/-/g, "").slice(0, 12)}_${Date.now()}`;

    const initRes = await paystackRequest<PaystackInitResponse>("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: userEmail,
        amount: pricing.amountSubunits,
        plan: planCode,
        reference,
        callback_url: `${Deno.env.get("SITE_URL") ?? "https://maalihub.com"}/dashboard?upgrade_pending=1`,
        metadata: {
          userId,
          currency,
          tier: "member",
          custom_fields: [
            { display_name: "User ID", variable_name: "user_id", value: userId },
          ],
        },
      }),
    });

    const initData = initRes.data as PaystackInitResponse | null;
    if (!initRes.ok || !initData?.status || !initData.data?.access_code) {
      console.error("[create-paystack-membership-payment] init failed:", initRes.raw);
      return jsonResponse(req, 502, {
        error: initData?.message ?? "Failed to initialize Paystack payment.",
      });
    }

    const accessCode = initData.data.access_code;
    const paymentRef = initData.data.reference ?? reference;
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const patch = {
      tier: "member",
      status: "pending_payment",
      // Provider intentionally NOT set here — locked only on payment success
      // (charge.success → activateMembership). Webhook retry covers ordering.
      provider_payment_ref: paymentRef,
      billing_currency: currency,
      amount_paid: pricing.amountSubunits,
      expires_at: periodEnd,
      updated_at: new Date().toISOString(),
    };

    if (existingMembership?.id) {
      await supabaseAdmin.from("memberships").update(patch).eq("id", existingMembership.id);
    } else {
      await supabaseAdmin.from("memberships").insert({
        user_id: userId,
        starts_at: new Date().toISOString(),
        ...patch,
      });
    }

    return jsonResponse(req, 200, {
      accessCode,
      reference: paymentRef,
      displayAmount: pricing.displayAmount,
      currency,
      publicKey: Deno.env.get("PAYSTACK_PUBLIC_KEY") ?? "",
    });
  } catch (err) {
    console.error("[create-paystack-membership-payment]", err);
    return jsonResponse(req, 500, { error: (err as Error).message });
  }
});
