// ARCHIVED: Payment-intent version moved to
//   supabase/functions/_archived/create-membership-payment-payment-intent/index.ts

import Stripe from "https://esm.sh/stripe@14?target=deno";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { authenticateRequest, getCorsHeaders, jsonResponse } from "../_shared/auth.ts";
import { activateMembership as activateMembershipShared } from "../_shared/activateMembership.ts";

// ── Config ────────────────────────────────────────────────────────────────────
// Set STRIPE_MEMBER_PRICE_ID in Supabase secrets to your recurring $2/month
// Price ID from the Stripe Dashboard (e.g. price_xxx).
// Create it once: Dashboard → Products → Add product → $2 / month → recurring.

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const stripePriceId   = Deno.env.get("STRIPE_MEMBER_PRICE_ID") ?? "";

const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!stripeSecretKey || !stripeSecretKey.startsWith("sk_")) {
    return new Response(
      JSON.stringify({ error: "Payment is not configured. Add STRIPE_SECRET_KEY to supabase/functions/.env." }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!stripePriceId) {
    return new Response(
      JSON.stringify({ error: "STRIPE_MEMBER_PRICE_ID is not set. Create a recurring $2/month price in Stripe and add the ID to secrets." }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const body = await req.json().catch(() => ({}));
  const auth = await authenticateRequest(req, { bodyToken: body.token ?? null });

  if (!auth.user) {
    return jsonResponse(req, 401, { error: auth.error ?? "Unauthorized" });
  }

  if (body.provider && body.provider !== "stripe") {
    return jsonResponse(req, 400, { error: "Use create-paystack-membership-payment for Paystack checkout." });
  }

  const userId    = auth.user.id;
  const userEmail = auth.user.email as string | undefined;

  try {
    // Look up any existing membership row (active community or pending_payment).
    const { data: existingMembership } = await supabaseAdmin
      .from("memberships")
      .select("id, tier, status, stripe_subscription_id, stripe_customer_id, stripe_payment_intent_id, payment_provider")
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
      existingMembership.payment_provider !== "stripe"
    ) {
      return jsonResponse(req, 409, {
        error: "Your membership checkout is locked to Paystack. Use Paystack to continue.",
      });
    }

    // Recover: paid in Stripe but webhook never flipped pending_payment → active
    if (
      existingMembership?.status === "pending_payment" &&
      existingMembership.stripe_subscription_id
    ) {
      const sub = await stripe.subscriptions.retrieve(existingMembership.stripe_subscription_id);
      if (sub.status === "active" || sub.status === "trialing") {
        await activateMembershipShared({
          userId,
          provider: "stripe",
          providerPaymentRef: existingMembership.stripe_payment_intent_id ?? sub.id,
          providerCustomerId: (sub.customer as string) ?? existingMembership.stripe_customer_id ?? "",
          providerSubscriptionId: sub.id,
          billingCurrency: "USD",
          amountMajor: 2,
          amountSubunits: 200,
          existingMembershipId: existingMembership.id,
        });
        const periodEnd = new Date(sub.current_period_end * 1000).toISOString();
        await supabaseAdmin
          .from("memberships")
          .update({ expires_at: periodEnd })
          .eq("id", existingMembership.id);
        return jsonResponse(req, 200, { alreadyActive: true });
      }
    }

    // Find or create Stripe Customer — prefer the ID stored on the membership row.
    let stripeCustomerId: string;
    const storedCustomerId = existingMembership?.stripe_customer_id;
    if (storedCustomerId) {
      stripeCustomerId = storedCustomerId;
    } else if (userEmail) {
      const list = await stripe.customers.list({ email: userEmail, limit: 1 });
      stripeCustomerId = list.data.length > 0
        ? list.data[0].id
        : (await stripe.customers.create({ email: userEmail, metadata: { userId } })).id;
    } else {
      stripeCustomerId = (await stripe.customers.create({ metadata: { userId } })).id;
    }

    // Cancel any existing incomplete subscriptions for this customer + price to avoid orphans.
    const incompleteSubs = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "incomplete",
      limit: 5,
    });
    for (const sub of incompleteSubs.data) {
      const hasPrice = sub.items.data.some((item) => item.price.id === stripePriceId);
      if (hasPrice) {
        await stripe.subscriptions.cancel(sub.id);
      }
    }

    // Create a fresh subscription.
    // payment_behavior: "default_incomplete" — requires first invoice payment before activating.
    const subscription = await stripe.subscriptions.create({
      customer:         stripeCustomerId,
      items:            [{ price: stripePriceId }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand:           ["latest_invoice.payment_intent"],
      metadata:         { userId, tier: "member" },
    });

    const invoice       = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

    // Subscription invoice PIs often lack metadata — tag for payment_intent.succeeded webhook.
    if (paymentIntent?.id) {
      await stripe.paymentIntents.update(paymentIntent.id, {
        metadata: { userId, tier: "member" },
      });
    }

    if (!paymentIntent?.client_secret) {
      // Already active (e.g. $0 coupon) — activate directly.
      await activateMembershipShared({
        userId,
        provider: "stripe",
        providerPaymentRef: paymentIntent?.id ?? subscription.id,
        providerCustomerId: stripeCustomerId,
        providerSubscriptionId: subscription.id,
        billingCurrency: "USD",
        amountMajor: 2,
        amountSubunits: 200,
        existingMembershipId: existingMembership?.id ?? null,
      });
      return jsonResponse(req, 200, { alreadyActive: true });
    }

    const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

    // If a membership row already exists (community or stale pending), update it in place.
    // This avoids creating a second row and keeps the partial unique index happy.
    if (existingMembership) {
      await supabaseAdmin
        .from("memberships")
        .update({
          tier:                     "member",
          status:                   "pending_payment",
          // Provider intentionally NOT set here — locked only on payment success.
          provider_customer_id:     stripeCustomerId,
          provider_subscription_id: subscription.id,
          provider_payment_ref:     paymentIntent.id,
          billing_currency:         "USD",
          stripe_customer_id:       stripeCustomerId,
          stripe_subscription_id:   subscription.id,
          stripe_payment_intent_id: paymentIntent.id,
          amount_paid:              200,
          expires_at:               periodEnd,
          updated_at:               new Date().toISOString(),
        })
        .eq("id", existingMembership.id);
    } else {
      // Brand new user with no membership row at all.
      const { error: insertErr } = await supabaseAdmin.from("memberships").insert({
        user_id:                  userId,
        tier:                     "member",
        status:                   "pending_payment",
        // Provider intentionally NOT set here — locked only on payment success.
        provider_customer_id:     stripeCustomerId,
        provider_subscription_id: subscription.id,
        provider_payment_ref:     paymentIntent.id,
        billing_currency:         "USD",
        stripe_customer_id:       stripeCustomerId,
        stripe_subscription_id:   subscription.id,
        stripe_payment_intent_id: paymentIntent.id,
        amount_paid:              200,
        starts_at:                new Date().toISOString(),
        expires_at:               periodEnd,
      });
      if (insertErr) {
        console.warn("[create-membership-payment] insert failed:", insertErr.message);
      }
    }

    return jsonResponse(req, 200, { clientSecret: paymentIntent.client_secret, provider: "stripe" });
  } catch (err) {
    console.error("[create-membership-payment]", err);
    return jsonResponse(req, 500, { error: (err as Error).message });
  }
});
