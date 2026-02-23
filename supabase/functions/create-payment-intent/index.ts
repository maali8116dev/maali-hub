import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { getCorsHeaders } from "../_shared/cors.ts";

const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
console.log("STRIPE_SECRET_KEY configured:", !!stripeKey);

const stripe = new Stripe(stripeKey || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

interface CreatePaymentIntentRequest {
  amount: number;
  currency?: string;
  applicationId?: string;
  projectId?: number;
  description?: string;
  metadata?: Record<string, string>;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    console.log("Auth header present:", !!authHeader);

    if (!authHeader?.startsWith("Bearer ")) {
      console.error("No valid Bearer token found");
      return new Response(
        JSON.stringify({ error: "Unauthorized - no token" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    console.log("User auth result:", user ? "authenticated" : "not authenticated", userError?.message || "");

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - invalid token" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const body: CreatePaymentIntentRequest = await req.json();
    console.log("Request body:", JSON.stringify({ amount: body.amount, currency: body.currency, projectId: body.projectId }));

    if (!body.amount || body.amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid amount" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Server-side validation of payment amount against project fee
    if (body.projectId) {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const { data: project, error: projectError } = await supabaseAdmin
        .from("projects")
        .select("application_fee")
        .eq("id", body.projectId)
        .single();

      console.log("Project fee lookup:", project?.application_fee, projectError?.message || "");

      if (projectError || !project) {
        return new Response(
          JSON.stringify({ error: "Project not found" }),
          { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      const expectedFee = parseFloat(project.application_fee);
      if (!isNaN(expectedFee) && expectedFee > 0 && Math.abs(body.amount - expectedFee) > 0.01) {
        console.error(`Amount mismatch: sent ${body.amount}, expected ${expectedFee}`);
        return new Response(
          JSON.stringify({ error: "Amount does not match project application fee", expected: expectedFee, received: body.amount }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
    }

    const currency = body.currency || "usd";
    const amountInCents = Math.round(body.amount * 100);
    console.log("Creating Stripe payment intent:", amountInCents, "cents");

    const metadata: Record<string, string> = {
      ...body.metadata,
      userId: user.id,
    };

    if (body.applicationId) metadata.applicationId = body.applicationId;
    if (body.projectId) metadata.projectId = body.projectId.toString();

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: currency.toLowerCase(),
      description: body.description || "Application Fee",
      metadata,
      receipt_email: user.email,
    });

    console.log("Payment intent created:", paymentIntent.id);

    // Create transaction record - amount as number, not string
    const transactionData: Record<string, unknown> = {
      user_id: user.id,
      type: "application_fee",
      status: "pending",
      amount: body.amount,
      currency: currency.toUpperCase(),
      provider: "stripe",
      provider_payment_intent_id: paymentIntent.id,
      description: body.description || "Application Fee",
      billing_email: user.email || null,
    };

    if (body.applicationId) transactionData.application_id = body.applicationId;
    if (body.projectId) transactionData.project_id = body.projectId;

    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .insert(transactionData)
      .select()
      .single();

    if (transactionError) {
      console.error("Transaction insert error:", JSON.stringify(transactionError));
    }

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        transactionId: transaction?.id,
      }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Unhandled error:", error instanceof Error ? error.message : String(error));
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to create payment intent",
      }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
