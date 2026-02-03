import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2024-11-20.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: CreatePaymentIntentRequest = await req.json();

    if (!body.amount || body.amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const currency = body.currency || "usd";
    const amountInCents = Math.round(body.amount * 100); // Convert to cents

    // Create payment intent metadata
    const metadata: Record<string, string> = {
      userId: user.id,
      ...body.metadata,
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
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error creating payment intent:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to create payment intent",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

