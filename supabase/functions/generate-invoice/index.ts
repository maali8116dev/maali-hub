import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0?no-dts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { authenticateRequest, jsonResponse } from "../_shared/auth.ts";
import { generateReceiptPdf, storeReceiptPdf, type ReceiptData, type ReceiptKind } from "../_shared/pdf-receipt.ts";
import { resolveInvoiceNumber } from "../_shared/invoice-number.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
});

async function resolveOpportunityTitle(
  opportunityId: number | null,
  applicationId: string | null,
): Promise<string | null> {
  let oppId = opportunityId;
  if (!oppId && applicationId) {
    const { data: app } = await supabaseAdmin
      .from("applications")
      .select("opportunity_id")
      .eq("id", applicationId)
      .maybeSingle();
    oppId = app?.opportunity_id ?? null;
  }
  if (!oppId) return null;
  const { data: opportunity } = await supabaseAdmin
    .from("opportunities")
    .select("title")
    .eq("id", oppId)
    .maybeSingle();
  return opportunity?.title ?? null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const acceptLanguage = req.headers.get("accept-language");
    const locale = acceptLanguage?.toLowerCase().startsWith("fr") ? "fr" : "en";

    let bodyToken: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.clone().json();
        bodyToken = body?.token || null;
      } catch { /* no body */ }
    } else {
      bodyToken = new URL(req.url).searchParams.get("token");
    }

    const auth = await authenticateRequest(req, { bodyToken });
    if (!auth.user) {
      return jsonResponse(req, 401, { error: auth.error || "Unauthorized" });
    }
    const user = auth.user;

    const url = new URL(req.url);
    const transactionId   = url.searchParams.get("transactionId");
    const paymentIntentId = url.searchParams.get("paymentIntentId");
    const stripeInvoiceId = url.searchParams.get("stripeInvoiceId");

    if (!transactionId && !paymentIntentId && !stripeInvoiceId) {
      return jsonResponse(req, 400, { error: "transactionId, paymentIntentId, or stripeInvoiceId required" });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    const isAdmin = profile?.role === "admin";

    // Resolve stripeInvoiceId → paymentIntentId so the existing lookup paths work unchanged.
    let resolvedPaymentIntentId = paymentIntentId;
    if (stripeInvoiceId && !transactionId && !paymentIntentId) {
      // First try: transaction row already has the stripe_invoice_id set (new renewals)
      let invQuery = supabaseAdmin
        .from("transactions")
        .select("*")
        .eq("stripe_invoice_id", stripeInvoiceId);
      if (!isAdmin) invQuery = invQuery.eq("user_id", user.id);
      const { data: txByInvoice } = await invQuery.maybeSingle();
      if (txByInvoice) {
        // Found directly — skip the rest of the lookup below
        const txDirect = txByInvoice;
        // Jump straight to PDF generation by falling into the normal flow with tx set.
        // We do this by setting resolvedPaymentIntentId so the fallback block is skipped.
        resolvedPaymentIntentId = txDirect.provider_payment_intent_id;
      } else {
        // Second try: fetch the Stripe invoice to get its payment_intent
        try {
          const stripeInvoice = await stripe.invoices.retrieve(stripeInvoiceId);
          resolvedPaymentIntentId = typeof stripeInvoice.payment_intent === "string"
            ? stripeInvoice.payment_intent
            : (stripeInvoice.payment_intent as Stripe.PaymentIntent | null)?.id ?? null;
        } catch (invErr) {
          console.warn("[generate-invoice] Could not retrieve Stripe invoice:", invErr);
        }
      }
    }

    let query = supabaseAdmin.from("transactions").select("*");
    if (transactionId) {
      query = query.eq("id", transactionId);
    } else if (stripeInvoiceId && !resolvedPaymentIntentId) {
      // stripeInvoiceId provided but no payment intent resolved — look up by invoice id directly
      query = query.eq("stripe_invoice_id", stripeInvoiceId);
    } else {
      query = query.eq("provider_payment_intent_id", (resolvedPaymentIntentId ?? paymentIntentId)!);
    }
    if (!isAdmin) {
      query = query.eq("user_id", user.id);
    }

    let { data: tx, error: txError } = await query.maybeSingle();

    // Fallback: membership paid before transaction row existed
    if ((txError || !tx) && paymentIntentId) {
      let mbrQuery = supabaseAdmin
        .from("memberships")
        .select("user_id, amount_paid, created_at, status, stripe_payment_intent_id")
        .eq("stripe_payment_intent_id", paymentIntentId);
      if (!isAdmin) {
        mbrQuery = mbrQuery.eq("user_id", user.id);
      }
      const { data: mbr } = await mbrQuery.maybeSingle();
      if (mbr) {
        tx = {
          id: `mbr_${paymentIntentId}`,
          user_id: mbr.user_id,
          type: "subscription",
          status: mbr.status === "active" ? "completed" : "pending",
          amount: (mbr.amount_paid ?? 200) / 100,
          currency: "usd",
          description: "Full Membership — MAALI ($2/month)",
          opportunity_id: null,
          application_id: null,
          provider_payment_intent_id: paymentIntentId,
          provider_transaction_id: paymentIntentId,
          invoice_number: null,
          billing_email: null,
          completed_at: mbr.created_at,
          created_at: mbr.created_at,
          invoice_pdf_url: null,
        } as typeof tx;
        txError = null;
      }
    }

    if (txError || !tx) {
      return jsonResponse(req, 404, { error: "Transaction not found" });
    }

    const { data: userProfile } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name")
      .eq("user_id", tx.user_id)
      .maybeSingle();

    const userName = userProfile
      ? `${userProfile.first_name || ""} ${userProfile.last_name || ""}`.trim() || "N/A"
      : "N/A";

    const isSubscription = tx.type === "subscription";
    const receiptKind: ReceiptKind = isSubscription ? "subscription" : "application_fee";

    let projectTitle: string | null = null;
    if (isSubscription) {
      projectTitle = tx.description || "Full Membership — MAALI";
    } else {
      projectTitle = await resolveOpportunityTitle(tx.opportunity_id, tx.application_id);
    }

    let billingEmail = tx.billing_email;
    if (!billingEmail) {
      const { data: billingAddr } = await supabaseAdmin
        .from("billing_addresses")
        .select("billing_email")
        .eq("user_id", tx.user_id)
        .eq("is_default", true)
        .is("deleted_at", null)
        .maybeSingle();
      billingEmail = billingAddr?.billing_email ?? null;
    }

    let paymentMethodLast4: string | null = null;
    // Only call Stripe for Stripe transactions — Paystack has no server-side card PM lookup.
    const isStripeTx = !tx.provider || tx.provider === "stripe";
    if (isStripeTx && tx.provider_payment_intent_id && Deno.env.get("STRIPE_SECRET_KEY")) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(tx.provider_payment_intent_id);
        if (paymentIntent.payment_method && typeof paymentIntent.payment_method === "string") {
          const paymentMethod = await stripe.paymentMethods.retrieve(paymentIntent.payment_method);
          paymentMethodLast4 = paymentMethod.card?.last4 ?? null;
        }
      } catch (pmError) {
        console.warn("[Invoice] Could not fetch payment method details:", pmError);
      }
    }

    const amount = parseFloat(String(tx.amount)).toFixed(2);
    const currency = (tx.currency || "USD").toUpperCase();

    let invoiceNumber = tx.invoice_number;
    if (!invoiceNumber && !String(tx.id).startsWith("mbr_")) {
      invoiceNumber = await resolveInvoiceNumber(tx.id, null);
    } else if (!invoiceNumber) {
      const { data: generated } = await supabaseAdmin.rpc("generate_invoice_number");
      invoiceNumber = generated ?? `INV-${paymentIntentId?.substring(3, 11).toUpperCase() ?? "LEGACY"}`;
    }
    const paymentDate = new Date(tx.completed_at || tx.created_at).toLocaleDateString(
      locale === "fr" ? "fr-FR" : "en-US",
      { year: "numeric", month: "long", day: "numeric" },
    );
    const statusLabel = tx.status === "completed"
      ? (locale === "fr" ? "Payé" : "Paid")
      : tx.status.charAt(0).toUpperCase() + tx.status.slice(1);

    const receiptData: ReceiptData = {
      userName,
      projectTitle,
      applicationId: tx.application_id || null,
      amount,
      currency,
      paymentDate,
      statusLabel,
      invoiceNumber,
      transactionId: tx.provider_payment_intent_id || tx.provider_transaction_id || null,
      billingEmail,
      paymentMethodLast4,
      locale,
      receiptKind,
    };

    const pdfBytes = await generateReceiptPdf(receiptData);

    if (!tx.invoice_pdf_url && !String(tx.id).startsWith("mbr_")) {
      try {
        const pdfUrl = await storeReceiptPdf(tx.id, tx.user_id, pdfBytes);
        await supabaseAdmin.from("transactions").update({ invoice_pdf_url: pdfUrl }).eq("id", tx.id);
      } catch (storeErr) {
        console.warn("[Invoice] Could not store PDF:", storeErr);
      }
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
    return jsonResponse(req, 500, { error: "Failed to generate invoice" });
  }
});
