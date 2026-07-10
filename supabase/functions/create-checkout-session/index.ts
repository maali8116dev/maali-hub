import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0?no-dts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { authenticateRequest, jsonResponse } from "../_shared/auth.ts";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

interface CreateCheckoutRequest {
  applicationId: string;
  opportunityId?: number;
  projectId?: number;
  successUrl?: string;
  cancelUrl?: string;
}

const getTrustedBaseUrl = (req: Request): string => {
  const configured = Deno.env.get("SITE_URL");
  if (configured) return configured.replace(/\/+$/, "");

  const origin = req.headers.get("origin");
  if (origin) return origin.replace(/\/+$/, "");

  // Local development fallback
  return "http://localhost:5173";
};

const hasTrustedOrigin = (candidateUrl: string, trustedBaseUrl: string): boolean => {
  try {
    const candidate = new URL(candidateUrl);
    const trusted = new URL(trustedBaseUrl);
    return candidate.origin === trusted.origin;
  } catch {
    return false;
  }
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    if (!stripeSecretKey || !stripeSecretKey.startsWith("sk_")) {
      return new Response(
        JSON.stringify({ error: "Payment is not configured. Set STRIPE_SECRET_KEY for this environment." }),
        { status: 503, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Parse body FIRST to get token fallback
    const body: CreateCheckoutRequest & { token?: string } = await req.json();
    const { applicationId, opportunityId, projectId, successUrl, cancelUrl } = body;
    const resolvedOpportunityId = opportunityId ?? projectId;

    const auth = await authenticateRequest(req, { bodyToken: body.token });
    if (!auth.user) {
      return jsonResponse(req, 401, { error: auth.error || "Unauthorized" });
    }
    const user = auth.user;

    if (!applicationId || !resolvedOpportunityId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Get platform fee using service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify application ownership and project match
    const { data: application, error: applicationError } = await supabaseAdmin
      .from("applications")
      .select("id, user_id, opportunity_id, status, application_fee_paid")
      .eq("id", applicationId)
      .maybeSingle();

    if (applicationError || !application) {
      return new Response(
        JSON.stringify({ error: "Application not found" }),
        { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (application.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (application.opportunity_id !== resolvedOpportunityId) {
      return new Response(
        JSON.stringify({ error: "Application/opportunity mismatch" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (application.application_fee_paid) {
      return new Response(
        JSON.stringify({ error: "Application fee already paid" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const { data: opportunity, error: opportunityError } = await supabaseAdmin
      .from("opportunities")
      .select("title")
      .eq("id", resolvedOpportunityId)
      .maybeSingle();

    if (opportunityError || !opportunity) {
      return new Response(
        JSON.stringify({ error: "Opportunity not found" }),
        { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("platform_settings")
      .select("application_fee")
      .eq("id", 1)
      .maybeSingle();

    if (settingsError) {
      return new Response(
        JSON.stringify({ error: "Failed to load application fee settings" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const fee = Number(settings?.application_fee ?? 0);
    if (!fee || fee <= 0) {
      return new Response(
        JSON.stringify({ error: "No application fee configured" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const amountInCents = Math.round(fee * 100);

    const baseUrl = getTrustedBaseUrl(req);
    if (successUrl && !hasTrustedOrigin(successUrl, baseUrl)) {
      return new Response(
        JSON.stringify({ error: "Invalid success URL origin" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }
    if (cancelUrl && !hasTrustedOrigin(cancelUrl, baseUrl)) {
      return new Response(
        JSON.stringify({ error: "Invalid cancel URL origin" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const checkoutSuccessUrl = `${baseUrl}/payment/success?application_id=${encodeURIComponent(applicationId)}`;
    const checkoutCancelUrl = `${baseUrl}/payment/cancel?application_id=${encodeURIComponent(applicationId)}`;

    // Find or create a Stripe Customer so payment methods and history are saved
    let stripeCustomerId: string | undefined;
    if (user.email) {
      const existingCustomers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (existingCustomers.data.length > 0) {
        stripeCustomerId = existingCustomers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { userId: user.id },
        });
        stripeCustomerId = customer.id;
      }
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      ...(stripeCustomerId ? { customer: stripeCustomerId } : { customer_email: user.email }),
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amountInCents,
            product_data: {
              name: `Application Fee - ${opportunity.title || "Opportunity"}`,
              description: `Application fee for ${opportunity.title}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: user.id,
        applicationId,
        opportunityId: resolvedOpportunityId.toString(),
      },
      success_url: checkoutSuccessUrl,
      cancel_url: checkoutCancelUrl,
    });

    // Resolve payment_intent id (Stripe can return string or object)
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent && typeof session.payment_intent === "object" && "id" in session.payment_intent)
          ? (session.payment_intent as { id: string }).id
          : null;

    const { error: insertError } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: user.id,
        type: "application_fee",
        status: "pending",
        amount: fee,
        currency: "USD",
        provider: "stripe",
        provider_payment_intent_id: paymentIntentId,
        provider_transaction_id: session.id,
        description: `Application fee for ${opportunity.title}`,
        billing_email: user.email || null,
        application_id: applicationId,
        opportunity_id: resolvedOpportunityId,
        metadata: {
          checkout_session_id: session.id,
        },
      });

    if (insertError) {
      console.error("Transaction insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to record transaction", detail: insertError.message }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    console.log("Checkout session created:", session.id, "for application:", applicationId);

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error creating checkout session:", message);
    const isStripeAuth = typeof message === "string" && (message.includes("API") || message.includes("key") || message.includes("Unauthorized"));
    const clientMessage = isStripeAuth
      ? "Payment is not configured. Set STRIPE_SECRET_KEY for this environment."
      : "Failed to create checkout session";
    return new Response(
      JSON.stringify({ error: clientMessage, detail: message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
