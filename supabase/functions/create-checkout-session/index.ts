import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { getCorsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

interface CreateCheckoutRequest {
  applicationId: string;
  projectId: number;
  successUrl: string;
  cancelUrl: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const body: CreateCheckoutRequest = await req.json();
    const { applicationId, projectId, successUrl, cancelUrl } = body;

    if (!applicationId || !projectId || !successUrl || !cancelUrl) {
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
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    // Create transaction record
    await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        type: "application_fee",
        status: "pending",
        amount: fee,
        currency: "USD",
        provider: "stripe",
        provider_payment_intent_id: session.payment_intent as string || session.id,
        description: `Application fee for ${project.title}`,
        billing_email: user.email || null,
        application_id: applicationId,
        project_id: projectId,
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
