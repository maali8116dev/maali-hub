import Stripe from "https://esm.sh/stripe@14?target=deno";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { authenticateRequest, jsonResponse } from "../_shared/auth.ts";
import { paystackRequest } from "../_shared/paystackApi.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

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
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  const body = await req.json().catch(() => ({}));
  const auth = await authenticateRequest(req, { bodyToken: body.token ?? null });

  if (!auth.user) {
    return jsonResponse(req, 401, { error: auth.error ?? "Unauthorized" });
  }

  const userId = auth.user.id;

  const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc("cancel_membership", {
    p_user_id: userId,
  });

  if (rpcError) {
    console.error("[cancel-membership] RPC error:", rpcError.message);
    return jsonResponse(req, 400, { error: rpcError.message });
  }

  const mode = (rpcResult as { mode: string })?.mode;
  const provider = (rpcResult as { payment_provider?: string })?.payment_provider ?? "stripe";
  const subscriptionId =
    (rpcResult as { provider_subscription_id?: string })?.provider_subscription_id ??
    (rpcResult as { stripe_subscription_id?: string })?.stripe_subscription_id;

  if (mode === "scheduled" && subscriptionId) {
    if (provider === "paystack") {
      const { data: membership } = await supabaseAdmin
        .from("memberships")
        .select("paystack_email_token")
        .eq("user_id", userId)
        .eq("provider_subscription_id", subscriptionId)
        .maybeSingle();

      const token = membership?.paystack_email_token;
      if (token) {
        try {
          const res = await paystackRequest("/subscription/disable", {
            method: "POST",
            body: JSON.stringify({ code: subscriptionId, token }),
          });
          if (!res.ok) {
            console.error("[cancel-membership] Paystack disable failed:", res.raw);
          } else {
            console.log(`[cancel-membership] Paystack subscription ${subscriptionId} disabled`);
          }
        } catch (stripeErr) {
          console.error("[cancel-membership] Paystack update failed (non-fatal):", (stripeErr as Error).message);
        }
      } else {
        console.warn("[cancel-membership] missing paystack_email_token — DB cancel_at_period_end only");
      }
    } else {
      try {
        await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });
        console.log(`[cancel-membership] Stripe subscription ${subscriptionId} set to cancel at period end`);
      } catch (stripeErr) {
        console.error("[cancel-membership] Stripe update failed (non-fatal):", (stripeErr as Error).message);
      }
    }
  }

  return jsonResponse(req, 200, { success: true, mode, payment_provider: provider });
});
