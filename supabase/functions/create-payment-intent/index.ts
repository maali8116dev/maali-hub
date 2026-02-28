import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { getCorsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
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

    if (!body.projectId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: projectId" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify application ownership if applicationId provided
    if (body.applicationId) {
      const { data: application, error: appError } = await supabaseAdmin
        .from("applications")
        .select("id, user_id, project_id, application_fee_paid")
        .eq("id", body.applicationId)
        .maybeSingle();

      if (appError || !application) {
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

      if (application.project_id !== body.projectId) {
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
    }

    // Server-side validation of payment amount against project fee
    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("title, application_fee")
      .eq("id", body.projectId)
      .single();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const expectedFee = parseFloat(project.application_fee);
    if (!expectedFee || expectedFee <= 0) {
      return new Response(
        JSON.stringify({ error: "No application fee for this project" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (Math.abs(body.amount - expectedFee) > 0.01) {
      return new Response(
        JSON.stringify({ error: "Amount does not match project application fee" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const currency = body.currency || "usd";
    const amountInCents = Math.round(body.amount * 100);

    const metadata: Record<string, string> = {
      ...body.metadata,
      userId: user.id,
    };

    if (body.applicationId) metadata.applicationId = body.applicationId;
    metadata.projectId = body.projectId.toString();

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: currency.toLowerCase(),
      description: body.description || `Application fee for ${project.title || "project"}`,
      metadata,
      receipt_email: user.email,
    });

    console.log("Payment intent created:", paymentIntent.id, "for application:", body.applicationId);

    // Create transaction record
    const transactionData: Record<string, unknown> = {
      user_id: user.id,
      type: "application_fee",
      status: "pending",
      amount: body.amount,
      currency: currency.toUpperCase(),
      provider: "stripe",
      provider_payment_intent_id: paymentIntent.id,
      description: body.description || `Application fee for ${project.title || "project"}`,
      billing_email: user.email || null,
      project_id: body.projectId,
    };

    if (body.applicationId) transactionData.application_id = body.applicationId;

    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .insert(transactionData)
      .select()
      .single();

    if (transactionError) {
      console.error("Transaction insert error:", transactionError.message);
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
    console.error("Error creating payment intent:", error instanceof Error ? error.message : String(error));
    return new Response(
      JSON.stringify({ error: "Failed to create payment intent" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
