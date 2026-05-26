import Stripe from "https://esm.sh/stripe@14?target=deno";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { authenticateRequest, jsonResponse } from "../_shared/auth.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
});

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
  }

  const body = await req.json().catch(() => ({}));
  const auth = await authenticateRequest(req, { bodyToken: body.token ?? null });

  if (!auth.user) {
    return jsonResponse(req, 401, { error: auth.error ?? "Unauthorized" });
  }

  const userId = auth.user.id;

  const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc("resume_membership", {
    p_user_id: userId,
  });

  if (rpcError) {
    console.error("[resume-membership] RPC error:", rpcError.message);
    return jsonResponse(req, 400, { error: rpcError.message });
  }

  const subscriptionId = (rpcResult as { stripe_subscription_id?: string })?.stripe_subscription_id;

  if (subscriptionId) {
    try {
      await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      });
      console.log(`[resume-membership] Stripe subscription ${subscriptionId} cancellation reversed`);
    } catch (stripeErr) {
      // Log but don't fail — DB is already updated.
      console.error("[resume-membership] Stripe update failed (non-fatal):", (stripeErr as Error).message);
    }
  }

  return jsonResponse(req, 200, { success: true });
});
