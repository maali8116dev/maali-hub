import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { generateReceiptPdf, storeReceiptPdf, type ReceiptData } from "../_shared/pdf-receipt.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

serve(async (req: Request) => {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response(
      JSON.stringify({ error: "No signature" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let event: Stripe.Event;

  try {
    const body = await req.text();
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response(
      JSON.stringify({ error: "Invalid signature" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSuccess(paymentIntent);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailure(paymentIntent);
        break;
      }

      case "payment_intent.canceled": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentCanceled(paymentIntent);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(
      JSON.stringify({ error: "Webhook processing failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

async function reconcilePendingCheckoutTransaction(
  applicationId: string,
  checkoutSessionId: string,
  paymentIntentId: string,
) {
  const { data: existingTx } = await supabaseAdmin
    .from("transactions")
    .select("id, status")
    .eq("provider_transaction_id", checkoutSessionId)
    .eq("application_id", applicationId)
    .maybeSingle();

  if (existingTx && existingTx.status !== "completed") {
    const { error: txError } = await supabaseAdmin
      .from("transactions")
      .update({
        status: "completed",
        provider_payment_intent_id: paymentIntentId,
        completed_at: new Date().toISOString(),
      })
      .eq("id", existingTx.id);

    if (txError) {
      console.error("Error reconciling pending checkout transaction:", txError);
    } else {
      console.log(`Reconciled transaction ${existingTx.id} to completed`);
    }
  } else if (existingTx) {
    console.log(`Transaction ${existingTx.id} already completed, skipping reconciliation`);
  } else {
    console.warn(`No transaction found for reconciliation: session=${checkoutSessionId}, app=${applicationId}`);
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const applicationId = session.metadata?.applicationId;
  const userId = session.metadata?.userId;
  const paymentIntentId = (session.payment_intent as string) || session.id;
  const checkoutSessionId = session.id;

  console.log(`Checkout completed: session=${session.id}, application=${applicationId}, user=${userId}`);

  if (!applicationId) {
    console.error("No applicationId in checkout session metadata");
    return;
  }

  // Idempotency: skip if already paid
  const { data: app } = await supabaseAdmin
    .from("applications")
    .select("application_fee_paid")
    .eq("id", applicationId)
    .maybeSingle();

  if (app?.application_fee_paid) {
    console.log(`Application ${applicationId} already marked as paid, reconciling checkout transaction`);
    await reconcilePendingCheckoutTransaction(applicationId, checkoutSessionId, paymentIntentId);
    return;
  }

  let invoicePdfUrl: string | null = null;

  // Update application: mark fee paid and change status from pending_payment to pending
  const { error: appError } = await supabaseAdmin
    .from("applications")
    .update({
      application_fee_paid: true,
      stripe_payment_intent_id: paymentIntentId,
      status: "pending",
    })
    .eq("id", applicationId);

  if (appError) {
    console.error("Error updating application after checkout:", appError);
  } else {
    console.log(`Application ${applicationId} marked as paid and status set to pending`);
  }

  // Fetch Stripe receipt URL from the charge
  let receiptUrl: string | null = null;
  try {
    const charges = await stripe.charges.list({ payment_intent: paymentIntentId, limit: 1 });
    if (charges.data.length > 0) {
      receiptUrl = charges.data[0].receipt_url || null;
    }
  } catch (chargeErr) {
    console.error("Error fetching Stripe charge for receipt URL:", chargeErr);
  }

  // Get transaction to generate PDF receipt
  const { data: transaction } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .eq("provider_transaction_id", checkoutSessionId)
    .eq("application_id", applicationId)
    .eq("status", "pending")
    .maybeSingle();

  if (transaction && userId) {
    try {
      invoicePdfUrl = await generateAndStoreReceiptPdf(transaction.id, userId, transaction, applicationId);
    } catch (pdfErr) {
      console.error("Error generating PDF receipt:", pdfErr);
      // Continue without PDF - don't fail the whole webhook
    }
  }

  // Update transaction status — try multiple lookup strategies for robustness
  let existingTx: { id: string; status: string } | null = null;

  // Strategy 1: Lookup by checkout session ID + application ID (most specific)
  const { data: txBySessionAndApp } = await supabaseAdmin
    .from("transactions")
    .select("id, status")
    .eq("provider_transaction_id", checkoutSessionId)
    .eq("application_id", applicationId)
    .maybeSingle();

  if (txBySessionAndApp) {
    existingTx = txBySessionAndApp;
    console.log(`Found transaction by session+app: ${existingTx.id}`);
  } else {
    // Strategy 2: Lookup by checkout session ID only (in case application_id wasn't set)
    const { data: txBySession } = await supabaseAdmin
      .from("transactions")
      .select("id, status")
      .eq("provider_transaction_id", checkoutSessionId)
      .maybeSingle();

    if (txBySession) {
      existingTx = txBySession;
      console.log(`Found transaction by session only: ${existingTx.id}`);
    } else {
      // Strategy 3: Lookup by payment intent ID (fallback)
      const { data: txByPaymentIntent } = await supabaseAdmin
        .from("transactions")
        .select("id, status")
        .eq("provider_payment_intent_id", paymentIntentId)
        .maybeSingle();

      if (txByPaymentIntent) {
        existingTx = txByPaymentIntent;
        console.log(`Found transaction by payment intent: ${existingTx.id}`);
      }
    }
  }

  if (existingTx) {
    // Only update if not already completed (idempotency)
    if (existingTx.status !== "completed") {
      const { error: txError } = await supabaseAdmin
        .from("transactions")
        .update({
          status: "completed",
          provider_payment_intent_id: paymentIntentId,
          provider_transaction_id: checkoutSessionId, // Ensure both IDs are set
          completed_at: new Date().toISOString(),
          receipt_url: receiptUrl,
          invoice_pdf_url: invoicePdfUrl,
          ...(applicationId && !txBySessionAndApp ? { application_id: applicationId } : {}), // Set app_id if missing
        })
        .eq("id", existingTx.id);

      if (txError) {
        console.error("Error updating transaction after checkout:", txError);
      } else {
        console.log(`Transaction ${existingTx.id} updated to completed`);
      }
    } else {
      console.log(`Transaction ${existingTx.id} already completed, skipping update`);
    }
  } else {
    console.error(`No transaction found for checkout session ${checkoutSessionId}, payment intent ${paymentIntentId}, application ${applicationId}`);
    console.error("This may indicate the transaction was never created or the webhook is being called incorrectly.");
  }

  if (!appError) {
    // Save payment method to database
    if (userId) {
      await savePaymentMethod(userId, paymentIntentId, session.customer_email || null);
    }

    // Queue payment receipt email after PDF generation/transaction update.
    await enqueuePaymentReceiptEmail(applicationId, userId, session.amount_total, "usd", paymentIntentId, invoicePdfUrl);
    
    // Assign reviewers now that payment is confirmed
    await assignReviewersToApplication(applicationId);
  }

  // Create notification for user
  if (userId) {
    try {
      await supabaseAdmin.rpc("create_notification", {
        p_user_id: userId,
        p_title: "Payment Confirmed",
        p_message: "Your application fee has been confirmed and your application is now under review.",
        p_type: "payment",
        p_link: `/dashboard/applications/${applicationId}`,
        p_metadata: { application_id: applicationId },
      });
    } catch (notifErr) {
      console.error("Error creating payment notification:", notifErr);
    }
  }
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const paymentIntentId = paymentIntent.id;
  let userId = paymentIntent.metadata?.userId;
  let applicationId = paymentIntent.metadata?.applicationId;

  // If metadata is missing (e.g. payment created via Checkout Session),
  // look up the transaction to find the application
  if (!applicationId) {
    const { data: tx } = await supabaseAdmin
      .from("transactions")
      .select("application_id, user_id")
      .eq("provider_payment_intent_id", paymentIntentId)
      .maybeSingle();

    if (tx) {
      applicationId = tx.application_id;
      userId = userId || tx.user_id;
    }
  }

  // Idempotency: skip if already paid (checkout.session.completed may have handled it)
  if (applicationId) {
    const { data: app } = await supabaseAdmin
      .from("applications")
      .select("application_fee_paid")
      .eq("id", applicationId)
      .maybeSingle();

    if (app?.application_fee_paid) {
      console.log(`Application ${applicationId} already marked as paid, skipping payment_intent handler`);
      return;
    }
  }

  // Fetch Stripe receipt URL from the charge
  let receiptUrl: string | null = null;
  try {
    const charges = await stripe.charges.list({ payment_intent: paymentIntent.id, limit: 1 });
    if (charges.data.length > 0) {
      receiptUrl = charges.data[0].receipt_url || null;
    }
  } catch (chargeErr) {
    console.error("Error fetching Stripe charge for receipt URL:", chargeErr);
  }

  // Get transaction to generate PDF receipt
  const { data: transaction } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .eq("provider_payment_intent_id", paymentIntentId)
    .maybeSingle();

  let invoicePdfUrl: string | null = null;
  if (transaction && userId) {
    try {
      invoicePdfUrl = await generateAndStoreReceiptPdf(transaction.id, userId, transaction, applicationId);
    } catch (pdfErr) {
      console.error("Error generating PDF receipt:", pdfErr);
      // Continue without PDF - don't fail the whole webhook
    }
  }

  // Update transaction status — try multiple lookup strategies for robustness
  let existingTx: { id: string; status: string; provider_transaction_id: string | null } | null = null;

  // Strategy 1: Lookup by payment intent ID (most common for this handler)
  const { data: txByPaymentIntent } = await supabaseAdmin
    .from("transactions")
    .select("id, status, provider_transaction_id")
    .eq("provider_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (txByPaymentIntent) {
    existingTx = txByPaymentIntent;
    console.log(`Found transaction by payment intent: ${existingTx.id}`);
  } else if (applicationId) {
    // Strategy 2: Lookup by application ID + payment intent metadata
    // This handles cases where payment_intent_id wasn't set initially
    const { data: txByApp } = await supabaseAdmin
      .from("transactions")
      .select("id, status, provider_transaction_id")
      .eq("application_id", applicationId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (txByApp) {
      existingTx = txByApp;
      console.log(`Found transaction by application: ${existingTx.id}`);
    }
  }

  if (existingTx) {
    // Only update if not already completed (idempotency)
    if (existingTx.status !== "completed") {
      const { error: transactionError } = await supabaseAdmin
        .from("transactions")
        .update({
          status: "completed",
          provider_payment_intent_id: paymentIntentId,
          provider_transaction_id: existingTx.provider_transaction_id || paymentIntent.id,
          completed_at: new Date().toISOString(),
          receipt_url: receiptUrl,
          invoice_pdf_url: invoicePdfUrl,
        })
        .eq("id", existingTx.id);

      if (transactionError) {
        console.error("Error updating transaction:", transactionError);
      } else {
        console.log(`Transaction ${existingTx.id} updated to completed via payment_intent`);
      }
    } else {
      console.log(`Transaction ${existingTx.id} already completed, skipping update`);
    }
  } else {
    console.error(`No transaction found for payment intent ${paymentIntentId}, application ${applicationId || "unknown"}`);
    console.error("This may indicate the transaction was never created or the webhook is being called incorrectly.");
  }

  // Update application if applicationId exists
  if (applicationId) {
    const { error: applicationError } = await supabaseAdmin
      .from("applications")
      .update({
        application_fee_paid: true,
        stripe_payment_intent_id: paymentIntentId,
        status: "pending",
      })
      .eq("id", applicationId);

    if (applicationError) {
      console.error("Error updating application:", applicationError);
    } else {
      console.log(`Application ${applicationId} marked as paid and status set to pending`);

      // Save payment method to database
      if (userId) {
        await savePaymentMethod(userId, paymentIntentId, paymentIntent.receipt_email || null);
      }

      // Queue payment receipt email (with PDF URL if available)
      await enqueuePaymentReceiptEmail(applicationId, userId, paymentIntent.amount, paymentIntent.currency, paymentIntentId, invoicePdfUrl);
      
      // Assign reviewers now that payment is confirmed
      await assignReviewersToApplication(applicationId);
    }

    // Create notification for user
    if (userId) {
      try {
        await supabaseAdmin.rpc("create_notification", {
          p_user_id: userId,
          p_title: "Payment Confirmed",
          p_message: "Your application fee has been confirmed and your application is now under review.",
          p_type: "payment",
          p_link: `/dashboard/applications/${applicationId}`,
          p_metadata: { application_id: applicationId },
        });
      } catch (notifErr) {
        console.error("Error creating payment notification:", notifErr);
      }
    }
  }

  console.log(`Payment succeeded: ${paymentIntentId} for user ${userId}, application ${applicationId}`);
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  const paymentIntentId = paymentIntent.id;
  const failureReason =
    paymentIntent.last_payment_error?.message || "Payment failed";

  const { error: transactionError } = await supabaseAdmin
    .from("transactions")
    .update({
      status: "failed",
      failure_reason: failureReason,
    })
    .eq("provider_payment_intent_id", paymentIntentId);

  if (transactionError) {
    console.error("Error updating transaction:", transactionError);
  }

  console.log(`Payment failed: ${paymentIntentId} - ${failureReason}`);
}

async function handlePaymentCanceled(paymentIntent: Stripe.PaymentIntent) {
  const paymentIntentId = paymentIntent.id;

  const { error: transactionError } = await supabaseAdmin
    .from("transactions")
    .update({
      status: "cancelled",
    })
    .eq("provider_payment_intent_id", paymentIntentId);

  if (transactionError) {
    console.error("Error updating transaction:", transactionError);
  }

  console.log(`Payment canceled: ${paymentIntentId}`);
}

/**
 * Save or update payment method in database after successful payment
 */
async function savePaymentMethod(
  userId: string,
  paymentIntentId: string,
  billingEmail?: string | null
): Promise<void> {
  try {
    // Fetch payment method details from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (!paymentIntent.payment_method || typeof paymentIntent.payment_method !== "string") {
      console.log(`No payment method found for payment intent ${paymentIntentId}`);
      return;
    }

    const paymentMethod = await stripe.paymentMethods.retrieve(paymentIntent.payment_method as string);
    
    if (!paymentMethod.card) {
      console.log(`Payment method ${paymentMethod.id} is not a card`);
      return;
    }

    const card = paymentMethod.card;
    const providerId = paymentMethod.id;
    const last4 = card.last4 || "";
    const brand = card.brand || "unknown";
    const expiryMonth = card.exp_month || null;
    const expiryYear = card.exp_year || null;

    // Check if payment method already exists for this user
    const { data: existingMethod } = await supabaseAdmin
      .from("payment_methods")
      .select("id, is_default")
      .eq("user_id", userId)
      .eq("provider_id", providerId)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingMethod) {
      // Update existing payment method (reactivate if deleted, update expiry if changed)
      // If it was default, ensure it's primary; otherwise keep as secondary
      const shouldBePrimary = existingMethod.is_default;
      const { error: updateError } = await supabaseAdmin
        .from("payment_methods")
        .update({
          is_active: true,
          expiry_month: expiryMonth,
          expiry_year: expiryYear,
          method_type: shouldBePrimary ? "primary" : "secondary",
          updated_at: new Date().toISOString(),
          deleted_at: null, // Reactivate if previously deleted
        })
        .eq("id", existingMethod.id);

      if (updateError) {
        console.error("Error updating payment method:", updateError);
      } else {
        console.log(`Updated payment method ${existingMethod.id} for user ${userId}`);
      }
    } else {
      // Check if user has any default payment method
      const { data: existingDefaults } = await supabaseAdmin
        .from("payment_methods")
        .select("id")
        .eq("user_id", userId)
        .eq("is_default", true)
        .is("deleted_at", null)
        .maybeSingle();

      const isDefault = !existingDefaults; // Set as default if user has no other default
      const methodType = isDefault ? "primary" : "secondary";

      // Insert new payment method
      const { error: insertError } = await supabaseAdmin
        .from("payment_methods")
        .insert({
          user_id: userId,
          provider: "stripe",
          provider_id: providerId,
          type: "card",
          brand: brand,
          last4: last4,
          expiry_month: expiryMonth,
          expiry_year: expiryYear,
          billing_email: billingEmail,
          is_active: true,
          is_default: isDefault,
          method_type: methodType,
          metadata: {
            payment_intent_id: paymentIntentId,
            fingerprint: card.fingerprint || null,
          },
        });

      if (insertError) {
        console.error("Error inserting payment method:", insertError);
      } else {
        console.log(`Saved payment method ${providerId} for user ${userId} (default: ${isDefault})`);
      }
    }
  } catch (error) {
    console.error("Error saving payment method:", error);
    // Don't throw - payment method saving shouldn't fail the webhook
  }
}

/**
 * Generate and store PDF receipt for a transaction
 */
async function generateAndStoreReceiptPdf(
  transactionId: string,
  userId: string,
  transaction: any,
  applicationId: string | null
): Promise<string | null> {
  try {
    // Get user profile
    const { data: userProfile } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name")
      .eq("user_id", userId)
      .maybeSingle();

    const userName = userProfile
      ? `${userProfile.first_name || ""} ${userProfile.last_name || ""}`.trim() || "N/A"
      : "N/A";

    // Get opportunity title
    let opportunityTitle: string | null = "N/A";
    if (transaction.opportunity_id) {
      const { data: opportunity } = await supabaseAdmin
        .from("opportunities")
        .select("title")
        .eq("id", transaction.opportunity_id)
        .maybeSingle();
      opportunityTitle = opportunity?.title || "N/A";
    }

    // Fetch payment method details from Stripe if payment intent ID exists
    let paymentMethodLast4: string | null = null;
    if (transaction.provider_payment_intent_id) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(transaction.provider_payment_intent_id);
        if (paymentIntent.payment_method && typeof paymentIntent.payment_method === "string") {
          const paymentMethod = await stripe.paymentMethods.retrieve(paymentIntent.payment_method as string);
          if (paymentMethod.card?.last4) {
            paymentMethodLast4 = paymentMethod.card.last4;
          }
        }
      } catch (pmError) {
        console.warn("Could not fetch payment method details:", pmError);
      }
    }

    // Format values
    const amount = parseFloat(transaction.amount).toFixed(2);
    const currency = (transaction.currency || "USD").toUpperCase();
    const invoiceNumber = transaction.invoice_number || `TXN-${transaction.id.substring(0, 8).toUpperCase()}`;
    const paymentDate = new Date(transaction.completed_at || transaction.created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const statusLabel = transaction.status === "completed" ? "Paid" : transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1);

    // Generate PDF
    const receiptData: ReceiptData = {
      userName,
      projectTitle: opportunityTitle, // Keep field name for PDF template compatibility
      applicationId: transaction.application_id || null,
      amount,
      currency,
      paymentDate,
      statusLabel,
      invoiceNumber,
      transactionId: transaction.provider_transaction_id || null,
      billingEmail: transaction.billing_email || null,
      paymentMethodLast4,
    };

    console.log("[Webhook] Generating PDF receipt...");
    const pdfBytes = await generateReceiptPdf(receiptData);
    console.log("[Webhook] PDF generated, bytes length:", pdfBytes.length);

    // Store PDF in storage
    console.log("[Webhook] Storing PDF in storage...");
    const pdfUrl = await storeReceiptPdf(transactionId, userId, pdfBytes);
    console.log("[Webhook] PDF stored at URL:", pdfUrl);

    console.log(`PDF receipt generated and stored: ${pdfUrl}`);
    return pdfUrl;
  } catch (error) {
    console.error("Error generating and storing PDF receipt:", error);
    return null;
  }
}

/**
 * Assign reviewers to an application after payment is confirmed.
 * This ensures reviewers are only assigned to paid applications.
 */
async function assignReviewersToApplication(applicationId: string) {
  try {
    // Check if reviewers are already assigned (idempotency)
    const { data: existingAssignments } = await supabaseAdmin
      .from("application_assignments")
      .select("id")
      .eq("application_id", applicationId)
      .limit(1);

    if (existingAssignments && existingAssignments.length > 0) {
      console.log(`Reviewers already assigned to application ${applicationId}`);
      return;
    }

    // Get project title for notifications
    const { data: appData } = await supabaseAdmin
      .from("applications")
      .select("opportunity_id")
      .eq("id", applicationId)
      .maybeSingle();

    let opportunityTitle = "the opportunity";
    if (appData?.opportunity_id) {
      const { data: opportunity } = await supabaseAdmin
        .from("opportunities")
        .select("title")
        .eq("id", appData.opportunity_id)
        .maybeSingle();
      if (opportunity?.title) opportunityTitle = opportunity.title;
    }

    const notifyAdminsMissingReviewer = async (availableCount: number) => {
      try {
        const { data: admins, error: adminsError } = await supabaseAdmin
          .from("profiles")
          .select("user_id")
          .eq("role", "admin");

        if (adminsError) {
          console.error("Failed to fetch admins for missing reviewer notification:", adminsError);
          return;
        }

        const adminIds = (admins || []).map((a: any) => a.user_id).filter(Boolean);
        if (adminIds.length === 0) return;

        await Promise.allSettled(
          adminIds.map((adminId: string) =>
            supabaseAdmin.rpc("create_notification", {
              p_user_id: adminId,
              p_title: "Reviewer capacity needed",
              p_message: `Only ${availableCount} reviewer is available for "${opportunityTitle}". This application needs 2 reviewers. Please assign an additional reviewer.`,
              p_type: "review_assignment",
              p_link: `/admin/applications/${applicationId}`,
              p_metadata: {
                application_id: applicationId,
                opportunity_id: appData?.opportunity_id,
                opportunity_title: opportunityTitle,
                required_reviewers: 2,
                assigned_reviewers: availableCount,
              },
            })
          )
        );
      } catch (e) {
        console.error("Failed to notify admins about missing reviewer:", e);
      }
    };

    // Assign reviewers using workload-balanced assignment system.
    // Prefer 2 reviewers, but if only 1 is available, assign 1 and alert admins.
    const PREFERRED_REVIEWERS = 2;
    let { data: assignments, error: assignError } = await supabaseAdmin.rpc(
      "assign_reviewers_to_application",
      {
        p_application_id: applicationId,
        p_num_reviewers: PREFERRED_REVIEWERS,
      }
    );

    if (assignError) {
      // Check if error is because reviewers are already assigned (idempotency)
      if (assignError.message?.includes("already assigned")) {
        console.log(`Reviewers already assigned to application ${applicationId}`);
        return;
      }

      const msg = assignError.message || "";
      const notEnough = msg.toLowerCase().includes("not enough available reviewers");

      if (notEnough) {
        // Retry with a single reviewer for now.
        const retry = await supabaseAdmin.rpc("assign_reviewers_to_application", {
          p_application_id: applicationId,
          p_num_reviewers: 1,
        });
        assignments = retry.data;
        assignError = retry.error;

        if (!assignError && assignments?.length === 1) {
          console.warn(
            `Only 1 reviewer assigned to application ${applicationId} due to limited capacity. Admin action required.`
          );
          await notifyAdminsMissingReviewer(1);
        }
      }

      if (assignError) {
        console.error(`Failed to assign reviewers to application ${applicationId}:`, assignError);
        return;
      }
    }

    if (assignments && assignments.length > 0) {
      console.log(`Assigned ${assignments.length} reviewer(s) to application ${applicationId}`);

      // Notify each assigned reviewer
      await Promise.allSettled(
        assignments.map(async (assignment: any) => {
          try {
            await supabaseAdmin.rpc("create_notification", {
              p_user_id: assignment.reviewer_id,
              p_title: "New Application Assigned",
              p_message: `A new application for "${opportunityTitle}" has been assigned to you for review.`,
              p_type: "review_assigned",
              p_link: `/reviewer/applications/${applicationId}`,
              p_metadata: {
                application_id: applicationId,
                opportunity_id: appData?.opportunity_id,
                assignment_id: assignment.assignment_id,
              },
            });
          } catch (notifError) {
            console.error(`Failed to notify reviewer ${assignment.reviewer_id}:`, notifError);
          }
        })
      );
    } else {
      console.warn(`No reviewers assigned to application ${applicationId} - manual assignment may be required`);
    }
  } catch (err) {
    console.error(`Unexpected error assigning reviewers to application ${applicationId}:`, err);
    // Don't throw - we don't want to fail the payment webhook if reviewer assignment fails
  }
}

/**
 * Send payment receipt email directly via send-email function.
 * Falls back to queueing if direct send fails.
 */
async function enqueuePaymentReceiptEmail(
  applicationId: string,
  userId: string | undefined,
  amountInCents: number | null,
  currency: string,
  transactionId: string,
  invoicePdfUrl?: string | null
) {
  try {
    // Look up recipient email and name
    const { data: appData } = await supabaseAdmin
      .from("applications")
      .select("contact_email, user_id, opportunity_id, full_legal_name")
      .eq("id", applicationId)
      .maybeSingle();

    if (!appData) {
      console.error("Cannot enqueue receipt: application not found");
      return;
    }

    let recipientEmail = appData.contact_email;
    let recipientName = appData.full_legal_name || "Applicant";
    const targetUserId = userId || appData.user_id;

    if (targetUserId) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (profile?.first_name) {
        recipientName = `${profile.first_name} ${profile.last_name || ""}`.trim();
      }

      if (!recipientEmail) {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
        recipientEmail = authUser?.user?.email || null;
      }
    }

    if (!recipientEmail) {
      console.error("Cannot enqueue receipt: no email found for applicant");
      return;
    }

    // Look up opportunity title
    let opportunityTitle = "Opportunity";
    if (appData.opportunity_id) {
      const { data: opportunity } = await supabaseAdmin
        .from("opportunities")
        .select("title")
        .eq("id", appData.opportunity_id)
        .maybeSingle();
      if (opportunity?.title) opportunityTitle = opportunity.title;
    }

    const amount = amountInCents ? (amountInCents / 100).toFixed(2) : "0.00";
    const siteUrl = Deno.env.get("SITE_URL") || "https://maali-opportunity-hub.lovable.app";
    const paymentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const payload = {
      recipientName,
      projectTitle: opportunityTitle, // Keep field name for email template compatibility
      applicationId,
      amount,
      currency: currency.toUpperCase(),
      paymentDate,
      transactionId,
      actionUrl: `${siteUrl}/dashboard/applications/${applicationId}`,
      invoicePdfUrl: invoicePdfUrl || null,
    };

    // 1) Try direct send first (simpler and immediate)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const internalSecret = Deno.env.get("INTERNAL_EMAIL_SECRET");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl) {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (internalSecret) {
          headers["X-Internal-Secret"] = internalSecret;
        }
        if (serviceRoleKey) {
          headers["Authorization"] = `Bearer ${serviceRoleKey}`;
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            to: recipientEmail,
            type: "payment_receipt",
            data: payload,
            allowPublic: true,
          }),
        });

        if (response.ok) {
          console.log(`Payment receipt email sent directly to ${recipientEmail} (application ${applicationId})`);
          return;
        }

        const errBody = await response.text();
        console.error(`Direct send-email failed (${response.status}): ${errBody}`);
      } catch (sendErr) {
        console.error("Direct send-email call failed:", sendErr);
      }
    }

    // 2) Fallback: enqueue for worker retries/backoff
    const { error: queueError } = await supabaseAdmin.from("email_queue").insert({
      type: "payment_receipt",
      to_email: recipientEmail,
      payload,
      idempotency_key: `payment_receipt:${applicationId}:${transactionId}`,
    });

    if (queueError) {
      if (queueError.code === "23505") {
        console.log(`Payment receipt email already queued for application ${applicationId}`);
      } else {
        console.error("Error enqueuing payment receipt email:", queueError);
      }
    } else {
      console.log(`Payment receipt email queued as fallback for ${recipientEmail} (application ${applicationId})`);
    }
  } catch (err) {
    console.error("Error enqueuing payment receipt email:", err);
  }
}
