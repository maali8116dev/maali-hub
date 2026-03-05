import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { authenticateRequest, jsonResponse } from "../_shared/auth.ts";
import { generateReceiptPdf, type ReceiptData } from "../_shared/pdf-receipt.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const acceptLanguage = req.headers.get("accept-language");
    const locale = acceptLanguage?.toLowerCase().startsWith("fr") ? "fr" : "en";

    // Extract body token (POST) or query token (GET) as fallback
    let bodyToken: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.clone().json();
        bodyToken = body?.token || null;
      } catch { /* no body */ }
    } else {
      bodyToken = new URL(req.url).searchParams.get("token");
    }

    // Authenticate
    const auth = await authenticateRequest(req, { bodyToken });
    if (!auth.user) {
      return jsonResponse(req, 401, { error: auth.error || "Unauthorized" });
    }
    const user = auth.user;

    // Get transaction ID
    const url = new URL(req.url);
    const transactionId = url.searchParams.get("transactionId");

    if (!transactionId) {
      return new Response(JSON.stringify({ error: "transactionId required" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Fetch transaction
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    const isAdmin = profile?.role === "admin";

    let query = supabaseAdmin.from("transactions").select("*").eq("id", transactionId);
    if (!isAdmin) {
      query = query.eq("user_id", user.id);
    }

    const { data: tx, error: txError } = await query.maybeSingle();

    if (txError || !tx) {
      return new Response(JSON.stringify({ error: "Transaction not found" }), {
        status: 404,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Get user profile
    const { data: userProfile } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name")
      .eq("user_id", tx.user_id)
      .maybeSingle();

    const userName = userProfile
      ? `${userProfile.first_name || ""} ${userProfile.last_name || ""}`.trim() || "N/A"
      : "N/A";

    // Get project title
    let projectTitle = "N/A";
    if (tx.project_id) {
      const { data: project } = await supabaseAdmin
        .from("projects")
        .select("title")
        .eq("id", tx.project_id)
        .maybeSingle();
      projectTitle = project?.title || "N/A";
    }

    // Fetch payment method details from Stripe if payment intent ID exists
    let paymentMethodLast4: string | null = null;
    if (tx.provider_payment_intent_id) {
      try {
        const stripe = (await import("https://esm.sh/stripe@14.21.0")).default;
        const stripeClient = new stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
          apiVersion: "2023-10-16",
          httpClient: stripe.createFetchHttpClient(),
        });
        
        const paymentIntent = await stripeClient.paymentIntents.retrieve(tx.provider_payment_intent_id);
        if (paymentIntent.payment_method && typeof paymentIntent.payment_method === "string") {
          const paymentMethod = await stripeClient.paymentMethods.retrieve(paymentIntent.payment_method as string);
          if (paymentMethod.card?.last4) {
            paymentMethodLast4 = paymentMethod.card.last4;
          }
        }
      } catch (pmError) {
        console.warn("[Invoice] Could not fetch payment method details:", pmError);
      }
    }

    // Format values
    const amount = parseFloat(tx.amount).toFixed(2);
    const currency = (tx.currency || "USD").toUpperCase();
    const invoiceNumber = tx.invoice_number || `TXN-${tx.id.substring(0, 8).toUpperCase()}`;
    const paymentDate = new Date(tx.completed_at || tx.created_at).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const statusLabel = tx.status === "completed"
      ? (locale === "fr" ? "Paye" : "Paid")
      : tx.status.charAt(0).toUpperCase() + tx.status.slice(1);

    // Build receipt data using shared format
    const receiptData: ReceiptData = {
      userName,
      projectTitle: projectTitle !== "N/A" ? projectTitle : null,
      applicationId: tx.application_id || null,
      amount,
      currency,
      paymentDate,
      statusLabel,
      invoiceNumber,
      transactionId: tx.provider_transaction_id || null,
      billingEmail: tx.billing_email || null,
      paymentMethodLast4,
      locale,
    };

    // Generate PDF using shared function
    console.log("[Invoice] Generating PDF receipt...");
    console.log("[Invoice] Receipt data:", JSON.stringify(receiptData, null, 2));
    
    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await generateReceiptPdf(receiptData);
      console.log("[Invoice] PDF generated successfully, bytes length:", pdfBytes.length);
      
      // Verify PDF header
      const header = new TextDecoder().decode(pdfBytes.slice(0, 8));
      console.log("[Invoice] PDF header:", header);
      
      if (!header.startsWith("%PDF")) {
        throw new Error(`Invalid PDF format. Header: ${header}`);
      }
    } catch (pdfError) {
      console.error("[Invoice] PDF generation failed:", pdfError);
      console.error("[Invoice] PDF error details:", pdfError instanceof Error ? pdfError.stack : String(pdfError));
      throw pdfError;
    }

    return new Response(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        ...getCorsHeaders(req),
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${invoiceNumber}.pdf"`,
      },
    });
  } catch (error: unknown) {
    console.error("Error generating invoice:", error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ error: "Failed to generate invoice" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
