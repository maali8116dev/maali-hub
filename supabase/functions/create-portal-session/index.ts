import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { authenticateRequest, getCorsHeaders, jsonResponse } from "../_shared/auth.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
});

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

  const body = await req.json().catch(() => ({}));
  const auth = await authenticateRequest(req, { bodyToken: body.token ?? null });

  if (!auth.user) {
    return jsonResponse(req, 401, { error: auth.error ?? "Unauthorized" });
  }

  const userId = auth.user.id;

  // Look up the Stripe customer ID from the membership row.
  const { data: membership } = await supabaseAdmin
    .from("memberships")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  let stripeCustomerId = membership?.stripe_customer_id ?? null;

  // Fallback: look up by email in Stripe if the DB row doesn't have it yet.
  if (!stripeCustomerId && auth.user.email) {
    const list = await stripe.customers.list({ email: auth.user.email, limit: 1 });
    if (list.data.length > 0) {
      stripeCustomerId = list.data[0].id;
      // Backfill the DB row so future calls don't need this fallback.
      await supabaseAdmin
        .from("memberships")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("user_id", userId)
        .eq("status", "active");
    }
  }

  if (!stripeCustomerId) {
    return jsonResponse(req, 404, { error: "No billing account found." });
  }

  const returnUrl = `${body.returnUrl ?? Deno.env.get("SITE_URL") ?? "https://app.maali.com"}/dashboard/profile`;

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });

  return jsonResponse(req, 200, { url: session.url });
});
