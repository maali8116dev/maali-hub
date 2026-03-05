import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { authenticateRequest, jsonResponse } from "../_shared/auth.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

interface CreateCheckoutRequest {
  applicationId: string;
  projectId: number;
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
    // Parse body FIRST to get token fallback
    const body: CreateCheckoutRequest & { token?: string } = await req.json();
    const { applicationId, projectId, successUrl, cancelUrl } = body;

    const auth = await authenticateRequest(req, { bodyToken: body.token });
    if (!auth.user) {
      return jsonResponse(req, 401, { error: auth.error || "Unauthorized" });
    }
    const user = auth.user;

    if (!applicationId || !projectId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Get project fee using service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify application ownership and project match
    const { data: application, error: applicationError } = await supabaseAdmin
      .from("applications")
      .select("id, user_id, project_id, status, application_fee_paid")
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

    if (application.project_id !== projectId) {
      return new Response(
        JSON.stringify({ error: "Application/project mismatch" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (application.application_fee_paid) {
      return new Response(
        JSON.stringify({ error: "Application fee already paid" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("title, application_fee")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const fee = parseFloat(project.application_fee);
    if (!fee || fee <= 0) {
      return new Response(
        JSON.stringify({ error: "No application fee for this project" }),
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

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amountInCents,
            product_data: {
              name: `Application Fee - ${project.title || "Project"}`,
              description: `Application fee for ${project.title}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: user.id,
        applicationId,
        projectId: projectId.toString(),
      },
      success_url: checkoutSuccessUrl,
      cancel_url: checkoutCancelUrl,
    });

    // Create transaction record
    await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: user.id,
        type: "application_fee",
        status: "pending",
        amount: fee,
        currency: "USD",
        provider: "stripe",
        provider_payment_intent_id: (session.payment_intent as string) || null,
        provider_transaction_id: session.id,
        description: `Application fee for ${project.title}`,
        billing_email: user.email || null,
        application_id: applicationId,
        project_id: projectId,
        metadata: {
          checkout_session_id: session.id,
        },
      });

    console.log("Checkout session created:", session.id, "for application:", applicationId);

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error creating checkout session:", error instanceof Error ? error.message : String(error));
    return new Response(
      JSON.stringify({ error: "Failed to create checkout session" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
