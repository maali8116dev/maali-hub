import Stripe from "https://esm.sh/stripe@14?target=deno";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { authenticateRequest, getCorsHeaders } from "../_shared/auth.ts";

const MEMBER_PRICE_CENTS = 200; // $2.00/month — single source of truth

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
});

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Verify the caller is a logged-in Supabase user
  const body = await req.json().catch(() => ({}));
  const auth = await authenticateRequest(req, { bodyToken: body.token ?? null });

  if (!auth.user) {
    return new Response(JSON.stringify({ error: auth.error ?? "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = auth.user.id;
  const userEmail = auth.user.email;

  try {
    // Guard: only one active membership allowed
    const { data: existing } = await supabaseAdmin
      .from("memberships")
      .select("id, tier, status")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (existing?.tier === "member") {
      return new Response(
        JSON.stringify({ error: "You already have an active Full Membership." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find or create a Stripe Customer so payment methods and history are saved
    let stripeCustomerId: string | undefined;
    if (userEmail) {
      const existing = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (existing.data.length > 0) {
        stripeCustomerId = existing.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: userEmail,
          metadata: { userId },
        });
        stripeCustomerId = customer.id;
      }
    }

    // Create the Stripe PaymentIntent — price is authoritative here, not from the client
    const paymentIntent = await stripe.paymentIntents.create({
      amount: MEMBER_PRICE_CENTS,
      currency: "usd",
      metadata: { userId, tier: "member" },
      automatic_payment_methods: { enabled: true },
      ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
      receipt_email: userEmail ?? undefined,
      setup_future_usage: "off_session",
    });

    // Insert a pending membership row — the webhook will flip it to active on success.
    // Delete any stale pending_payment rows first so we don't accumulate them,
    // then insert fresh. Errors here are non-fatal: the PaymentIntent already exists
    // and the webhook will create/update the membership row on success.
    await supabaseAdmin
      .from("memberships")
      .delete()
      .eq("user_id", userId)
      .eq("status", "pending_payment");

    const { error: insertErr } = await supabaseAdmin.from("memberships").insert({
      user_id: userId,
      tier: "member",
      status: "pending_payment",
      stripe_payment_intent_id: paymentIntent.id,
      amount_paid: MEMBER_PRICE_CENTS,
      starts_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (insertErr) {
      console.warn("[create-membership-payment] pending row insert failed (non-fatal):", insertErr.message);
    }

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[create-membership-payment]", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
