import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { getCorsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2024-11-20.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

interface CreatePaymentIntentRequest {
  amount: number; // Amount in dollars
  currency?: string;
  applicationId?: string;
  projectId?: number;
  description?: string;
  metadata?: Record<string, string>;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    // Validate authorization
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

    // Verify user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const body: CreatePaymentIntentRequest = await req.json();

    if (!body.amount || body.amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid amount" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // C3 FIX: Server-side validation of payment amount against project fee
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

      if (projectError || !project) {
        return new Response(
          JSON.stringify({ error: "Project not found" }),
          { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      const expectedFee = parseFloat(project.application_fee);
      if (!isNaN(expectedFee) && expectedFee > 0 && Math.abs(body.amount - expectedFee) > 0.01) {
        return new Response(
          JSON.stringify({
            error: "Amount does not match project application fee",
            expected: expectedFee,
          }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
    }

    const currency = body.currency || "usd";
    const amountInCents = Math.round(body.amount * 100); // Convert to cents

    // H2 FIX: Create payment intent metadata - spread client metadata first,
    // then set server-controlled fields so they cannot be overridden
    const metadata: Record<string, string> = {
      ...body.metadata,
      userId: user.id, // Server-controlled, cannot be overridden by client
    };

    if (body.applicationId) {
      metadata.applicationId = body.applicationId;
    }

    if (body.projectId) {
      metadata.projectId = body.projectId.toString();
    }

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: currency.toLowerCase(),
      description: body.description || "Application Fee",
      metadata,
      receipt_email: user.email,
    });

    // Create transaction record in database
    const transactionData: any = {
      user_id: user.id,
      type: "application_fee",
      status: "pending",
      amount: body.amount.toString(),
      currency: currency.toUpperCase(),
      provider: "stripe",
      provider_payment_intent_id: paymentIntent.id,
      description: body.description || "Application Fee",
      billing_email: user.email || null,
    };

    if (body.applicationId) {
      transactionData.application_id = body.applicationId;
    }

    if (body.projectId) {
      transactionData.project_id = body.projectId;
    }

    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .insert(transactionData)
      .select()
      .single();

    if (transactionError) {
      console.error("Error creating transaction:", transactionError);
      // Don't fail the request if transaction creation fails, but log it
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
    console.error("Error creating payment intent:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to create payment intent",
      }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});

