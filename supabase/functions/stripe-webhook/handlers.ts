import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { generateReceiptPdf, storeReceiptPdf, type ReceiptData } from "../_shared/pdf-receipt.ts";
import { resolveInvoiceNumber } from "../_shared/invoice-number.ts";
import { buildNotificationMetadata } from "../_shared/notifications.ts";
import { activateMembership as activateMembershipShared } from "../_shared/activateMembership.ts";

export const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

export const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

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

export async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const applicationId = session.metadata?.applicationId;
  const userId = session.metadata?.userId;
  const paymentIntentId = (session.payment_intent as string) || session.id;
  const checkoutSessionId = session.id;

  console.log(`Checkout completed: session=${session.id}, application=${applicationId}, user=${userId}`);

  if (!applicationId) {
    console.error("No applicationId in checkout session metadata");
    return;
  }

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

  let receiptUrl: string | null = null;
  try {
    const charges = await stripe.charges.list({ payment_intent: paymentIntentId, limit: 1 });
    if (charges.data.length > 0) {
      receiptUrl = charges.data[0].receipt_url || null;
    }
  } catch (chargeErr) {
    console.error("Error fetching Stripe charge for receipt URL:", chargeErr);
  }

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
    }
  }

  let existingTx: { id: string; status: string } | null = null;

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
    const { data: txBySession } = await supabaseAdmin
      .from("transactions")
      .select("id, status")
      .eq("provider_transaction_id", checkoutSessionId)
      .maybeSingle();

    if (txBySession) {
      existingTx = txBySession;
      console.log(`Found transaction by session only: ${existingTx.id}`);
    } else {
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
    if (existingTx.status !== "completed") {
      const { error: txError } = await supabaseAdmin
        .from("transactions")
        .update({
          status: "completed",
          provider_payment_intent_id: paymentIntentId,
          provider_transaction_id: checkoutSessionId,
          completed_at: new Date().toISOString(),
          receipt_url: receiptUrl,
          invoice_pdf_url: invoicePdfUrl,
          ...(applicationId && !txBySessionAndApp ? { application_id: applicationId } : {}),
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
  }

  if (!appError) {
    if (userId) {
      await savePaymentMethod(userId, paymentIntentId, session.customer_email || null);
    }

    await enqueuePaymentReceiptEmail(applicationId, userId, session.amount_total, "usd", paymentIntentId, invoicePdfUrl);

    await assignReviewersToApplication(applicationId);
  }

  if (userId) {
    try {
      await supabaseAdmin.rpc("create_notification", {
        p_user_id: userId,
        p_title: "Payment Confirmed",
        p_message: "Your application fee has been confirmed and your application is now under review.",
        p_type: "payment",
        p_link: `/dashboard/applications/${applicationId}`,
        p_metadata: buildNotificationMetadata("payment.confirmed", {}, {
          application_id: applicationId,
        }),
      });
    } catch (notifErr) {
      console.error("Error creating payment notification:", notifErr);
    }
  }
}

async function handleMembershipPaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const paymentIntentId = paymentIntent.id;

  const { data: existing } = await supabaseAdmin
    .from("memberships")
    .select("id, user_id, status, tier, stripe_subscription_id, provider_subscription_id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();

  const userId = paymentIntent.metadata?.userId ?? existing?.user_id;

  if (!userId) {
    console.error("[membership] payment_intent.succeeded missing userId:", paymentIntentId);
    return;
  }

  if (existing?.status === "active" && existing.tier === "member") {
    console.log(`[membership] already active for payment intent ${paymentIntentId}, skipping`);
    return;
  }

  let periodEnd: string | null = null;
  const subId = existing?.provider_subscription_id ?? existing?.stripe_subscription_id;
  if (subId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subId);
      periodEnd = new Date(sub.current_period_end * 1000).toISOString();
    } catch { /* non-fatal */ }
  }

  const activated = await activateMembershipShared({
    userId,
    provider: "stripe",
    providerPaymentRef: paymentIntentId,
    providerSubscriptionId: subId,
    billingCurrency: "USD",
    amountMajor: 2,
    amountSubunits: 200,
    expiresAt: periodEnd,
    existingMembershipId: existing?.id ?? null,
  });

  if (!activated) {
    console.error("[membership] activateMembership failed for", paymentIntentId);
    return;
  }

  let transactionId: string | null = null;
  let invoiceNumber: string | null = null;
  const { data: existingTx } = await supabaseAdmin
    .from("transactions")
    .select("id, invoice_number")
    .eq("provider_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (existingTx) {
    transactionId = existingTx.id;
    invoiceNumber = existingTx.invoice_number;
  }

  try {
    if (!existingTx) {
    const { data: txRow, error: txError } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: userId,
        type: "subscription",
        status: "completed",
        amount: 2.00,
        currency: "usd",
        provider: "stripe",
        provider_payment_intent_id: paymentIntentId,
        provider_transaction_id: paymentIntentId,
        description: "Full Membership — MAALI ($2/month)",
        completed_at: new Date().toISOString(),
      })
      .select("id, invoice_number")
      .maybeSingle();

    if (txError) {
      console.error("[membership] failed to insert transaction:", txError);
    } else {
      transactionId = txRow?.id ?? null;
      invoiceNumber = txRow?.invoice_number ?? null;
      console.log(`[membership] transaction inserted: ${transactionId}, invoice: ${invoiceNumber}`);
    }
    }
  } catch (txErr) {
    console.error("[membership] unexpected error inserting transaction:", txErr);
  }

  await savePaymentMethod(userId, paymentIntentId, paymentIntent.receipt_email || null);

  let invoicePdfUrl: string | null = null;
  try {
    const { data: userProfile } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name")
      .eq("user_id", userId)
      .maybeSingle();

    const userName = userProfile
      ? `${userProfile.first_name || ""} ${userProfile.last_name || ""}`.trim() || "Member"
      : "Member";

    let paymentMethodLast4: string | null = null;
    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (pi.payment_method && typeof pi.payment_method === "string") {
        const pm = await stripe.paymentMethods.retrieve(pi.payment_method);
        paymentMethodLast4 = pm.card?.last4 ?? null;
      }
    } catch (pmErr) {
      console.warn("[membership] could not fetch payment method details:", pmErr);
    }

    if (!invoiceNumber && transactionId) {
      try {
        invoiceNumber = await resolveInvoiceNumber(transactionId, null);
      } catch (invErr) {
        console.warn("[membership] invoice number fallback:", invErr);
      }
    }
    const receiptInvoiceNumber =
      invoiceNumber ?? `INV-${paymentIntentId.substring(3, 11).toUpperCase()}`;

    const paymentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const receiptData: ReceiptData = {
      userName,
      projectTitle: "Full Membership — MAALI ($2/month)",
      applicationId: null,
      amount: "2.00",
      currency: "USD",
      paymentDate,
      statusLabel: "Paid",
      invoiceNumber: receiptInvoiceNumber,
      transactionId: paymentIntentId,
      billingEmail: null,
      paymentMethodLast4,
      receiptKind: "subscription",
    };

    const pdfBytes = await generateReceiptPdf(receiptData);
    const storageId = transactionId ?? `mbr_${paymentIntentId}`;
    invoicePdfUrl = await storeReceiptPdf(storageId, userId, pdfBytes);
    console.log(`[membership] PDF receipt stored: ${invoicePdfUrl}`);

    if (transactionId && invoicePdfUrl) {
      await supabaseAdmin
        .from("transactions")
        .update({ invoice_pdf_url: invoicePdfUrl })
        .eq("id", transactionId);
    }
  } catch (pdfErr) {
    console.error("[membership] failed to generate PDF receipt:", pdfErr);
  }

  try {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const recipientEmail = authUser?.user?.email ?? null;

    if (recipientEmail) {
      const { data: userProfile } = await supabaseAdmin
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", userId)
        .maybeSingle();

      const recipientName = userProfile
        ? `${userProfile.first_name || ""} ${userProfile.last_name || ""}`.trim() || "Member"
        : "Member";

      const siteUrl = Deno.env.get("SITE_URL") || "https://maali-opportunity-hub.lovable.app";
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const internalSecret = Deno.env.get("INTERNAL_EMAIL_SECRET");

      const payload = {
        recipientName,
        projectTitle: "Full Membership — MAALI",
        applicationId: null,
        amount: "2.00",
        currency: "USD",
        paymentDate: new Date().toLocaleDateString("en-US", {
          year: "numeric", month: "long", day: "numeric",
        }),
        transactionId: paymentIntentId,
        actionUrl: `${siteUrl}/dashboard`,
        invoicePdfUrl,
      };

      if (supabaseUrl) {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (internalSecret) headers["X-Internal-Secret"] = internalSecret;
        if (serviceRoleKey) headers["Authorization"] = `Bearer ${serviceRoleKey}`;

        const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            to: recipientEmail,
            type: "payment_receipt",
            data: payload,
            allowPublic: true,
          }),
        });

        if (res.ok) {
          console.log(`[membership] receipt email sent to ${recipientEmail}`);
        } else {
          const errBody = await res.text();
          console.error(`[membership] send-email failed (${res.status}): ${errBody}`);

          await supabaseAdmin.from("email_queue").insert({
            type: "payment_receipt",
            to_email: recipientEmail,
            payload,
            idempotency_key: `membership_receipt:${paymentIntentId}`,
          });
        }
      }
    } else {
      console.warn("[membership] no email found for user, skipping receipt email");
    }
  } catch (emailErr) {
    console.error("[membership] failed to send receipt email:", emailErr);
  }

  try {
    await supabaseAdmin.rpc("create_notification", {
      p_user_id: userId,
      p_title: "Full Membership Active",
      p_message: "Your $2/month Full Membership is now active. You can apply to all funding opportunities.",
      p_type: "payment",
      p_link: "/dashboard",
      p_metadata: buildNotificationMetadata("membership.activated", {}, {
        stripe_payment_intent_id: paymentIntentId,
      }),
    });
  } catch (notifErr) {
    console.error("[membership] failed to send notification:", notifErr);
  }
}

export async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const paymentIntentId = paymentIntent.id;

  const { data: membershipPi } = await supabaseAdmin
    .from("memberships")
    .select("id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (paymentIntent.metadata?.tier === "member" || membershipPi) {
    await handleMembershipPaymentSuccess(paymentIntent);
    return;
  }
  let userId = paymentIntent.metadata?.userId;
  let applicationId = paymentIntent.metadata?.applicationId;

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

  let receiptUrl: string | null = null;
  try {
    const charges = await stripe.charges.list({ payment_intent: paymentIntent.id, limit: 1 });
    if (charges.data.length > 0) {
      receiptUrl = charges.data[0].receipt_url || null;
    }
  } catch (chargeErr) {
    console.error("Error fetching Stripe charge for receipt URL:", chargeErr);
  }

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
    }
  }

  let existingTx: { id: string; status: string; provider_transaction_id: string | null } | null = null;

  const { data: txByPaymentIntent } = await supabaseAdmin
    .from("transactions")
    .select("id, status, provider_transaction_id")
    .eq("provider_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (txByPaymentIntent) {
    existingTx = txByPaymentIntent;
    console.log(`Found transaction by payment intent: ${existingTx.id}`);
  } else if (applicationId) {
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
  }

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

      if (userId) {
        await savePaymentMethod(userId, paymentIntentId, paymentIntent.receipt_email || null);
      }

      await enqueuePaymentReceiptEmail(applicationId, userId, paymentIntent.amount, paymentIntent.currency, paymentIntentId, invoicePdfUrl);

      await assignReviewersToApplication(applicationId);
    }

    if (userId) {
      try {
        await supabaseAdmin.rpc("create_notification", {
          p_user_id: userId,
          p_title: "Payment Confirmed",
          p_message: "Your application fee has been confirmed and your application is now under review.",
          p_type: "payment",
          p_link: `/dashboard/applications/${applicationId}`,
          p_metadata: buildNotificationMetadata("payment.confirmed", {}, {
            application_id: applicationId,
          }),
        });
      } catch (notifErr) {
        console.error("Error creating payment notification:", notifErr);
      }
    }
  }

  console.log(`Payment succeeded: ${paymentIntentId} for user ${userId}, application ${applicationId}`);
}

export async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
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

export async function handlePaymentCanceled(paymentIntent: Stripe.PaymentIntent) {
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

async function savePaymentMethod(
  userId: string,
  paymentIntentId: string,
  billingEmail?: string | null
): Promise<void> {
  try {
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

    const { data: existingMethod } = await supabaseAdmin
      .from("payment_methods")
      .select("id, is_default")
      .eq("user_id", userId)
      .eq("provider_id", providerId)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingMethod) {
      const shouldBePrimary = existingMethod.is_default;
      const { error: updateError } = await supabaseAdmin
        .from("payment_methods")
        .update({
          is_active: true,
          expiry_month: expiryMonth,
          expiry_year: expiryYear,
          method_type: shouldBePrimary ? "primary" : "secondary",
          updated_at: new Date().toISOString(),
          deleted_at: null,
        })
        .eq("id", existingMethod.id);

      if (updateError) {
        console.error("Error updating payment method:", updateError);
      } else {
        console.log(`Updated payment method ${existingMethod.id} for user ${userId}`);
      }
    } else {
      const { data: existingDefaults } = await supabaseAdmin
        .from("payment_methods")
        .select("id")
        .eq("user_id", userId)
        .eq("is_default", true)
        .is("deleted_at", null)
        .maybeSingle();

      const isDefault = !existingDefaults;
      const methodType = isDefault ? "primary" : "secondary";

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
  }
}

async function generateAndStoreReceiptPdf(
  transactionId: string,
  userId: string,
  transaction: any,
  applicationId: string | null
): Promise<string | null> {
  try {
    const { data: userProfile } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name")
      .eq("user_id", userId)
      .maybeSingle();

    const userName = userProfile
      ? `${userProfile.first_name || ""} ${userProfile.last_name || ""}`.trim() || "N/A"
      : "N/A";

    const isSubscription = transaction.type === "subscription";
    let opportunityTitle: string | null = null;
    if (isSubscription) {
      opportunityTitle = transaction.description || "Full Membership — MAALI";
    } else if (transaction.opportunity_id) {
      const { data: opportunity } = await supabaseAdmin
        .from("opportunities")
        .select("title")
        .eq("id", transaction.opportunity_id)
        .maybeSingle();
      opportunityTitle = opportunity?.title || null;
    }

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

    const amount = parseFloat(transaction.amount).toFixed(2);
    const currency = (transaction.currency || "USD").toUpperCase();
    let invoiceNumber = transaction.invoice_number;
    if (!invoiceNumber) {
      try {
        invoiceNumber = await resolveInvoiceNumber(transactionId, null);
      } catch (invErr) {
        console.warn("[receipt] invoice number generation failed:", invErr);
        invoiceNumber = `INV-${transaction.id.substring(0, 8).toUpperCase()}`;
      }
    }
    const paymentDate = new Date(transaction.completed_at || transaction.created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const statusLabel = transaction.status === "completed" ? "Paid" : transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1);

    const receiptData: ReceiptData = {
      userName,
      projectTitle: opportunityTitle,
      applicationId: transaction.application_id || null,
      amount,
      currency,
      paymentDate,
      statusLabel,
      invoiceNumber,
      transactionId: transaction.provider_payment_intent_id || transaction.provider_transaction_id || null,
      billingEmail: transaction.billing_email || null,
      paymentMethodLast4,
      receiptKind: isSubscription ? "subscription" : "application_fee",
    };

    console.log("[Webhook] Generating PDF receipt...");
    const pdfBytes = await generateReceiptPdf(receiptData);
    console.log("[Webhook] PDF generated, bytes length:", pdfBytes.length);

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

async function assignReviewersToApplication(applicationId: string) {
  try {
    const { data: existingAssignments } = await supabaseAdmin
      .from("application_assignments")
      .select("id")
      .eq("application_id", applicationId)
      .limit(1);

    if (existingAssignments && existingAssignments.length > 0) {
      console.log(`Reviewers already assigned to application ${applicationId}`);
      return;
    }

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
              p_metadata: buildNotificationMetadata(
                "admin.reviewerCapacityNeeded",
                {
                  opportunityTitle,
                  availableCount,
                  requiredReviewers: 2,
                },
                {
                  application_id: applicationId,
                  opportunity_id: appData?.opportunity_id,
                  opportunity_title: opportunityTitle,
                  required_reviewers: 2,
                  assigned_reviewers: availableCount,
                },
              ),
            })
          )
        );
      } catch (e) {
        console.error("Failed to notify admins about missing reviewer:", e);
      }
    };

    const PREFERRED_REVIEWERS = 2;
    let { data: assignments, error: assignError } = await supabaseAdmin.rpc(
      "assign_reviewers_to_application",
      {
        p_application_id: applicationId,
        p_num_reviewers: PREFERRED_REVIEWERS,
      }
    );

    if (assignError) {
      if (assignError.message?.includes("already assigned")) {
        console.log(`Reviewers already assigned to application ${applicationId}`);
        return;
      }

      const msg = assignError.message || "";
      const notEnough = msg.toLowerCase().includes("not enough available reviewers");

      if (notEnough) {
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

      await Promise.allSettled(
        assignments.map(async (assignment: any) => {
          try {
            await supabaseAdmin.rpc("create_notification", {
              p_user_id: assignment.reviewer_id,
              p_title: "New Application Assigned",
              p_message: `A new application for "${opportunityTitle}" has been assigned to you for review.`,
              p_type: "review_assigned",
              p_link: `/reviewer/applications/${applicationId}`,
              p_metadata: buildNotificationMetadata(
                "review.assigned",
                { opportunityTitle },
                {
                  application_id: applicationId,
                  opportunity_id: appData?.opportunity_id,
                  assignment_id: assignment.assignment_id,
                },
              ),
            });
          } catch (notifError) {
            console.error(`Failed to notify reviewer ${assignment.reviewer_id}:`, notifError);
          }
        })
      );
    } else {
      console.warn(`No reviewers assigned to application ${applicationId} - manual assignment may be required`);
      await notifyAdminsMissingReviewer(0);
    }
  } catch (err) {
    console.error(`Unexpected error assigning reviewers to application ${applicationId}:`, err);
  }
}

async function enqueuePaymentReceiptEmail(
  applicationId: string,
  userId: string | undefined,
  amountInCents: number | null,
  currency: string,
  transactionId: string,
  invoicePdfUrl?: string | null
) {
  try {
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
      projectTitle: opportunityTitle,
      applicationId,
      amount,
      currency: currency.toUpperCase(),
      paymentDate,
      transactionId,
      actionUrl: `${siteUrl}/dashboard/applications/${applicationId}`,
      invoicePdfUrl: invoicePdfUrl || null,
    };

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

export async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = typeof invoice.subscription === "string"
    ? invoice.subscription
    : invoice.subscription?.id ?? null;

  if (!subscriptionId) {
    console.log("[invoice.paid] No subscription ID — skipping (one-time charge)");
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.userId;

  if (!userId) {
    console.error("[invoice.paid] No userId in subscription metadata:", subscriptionId);
    return;
  }

  const newPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
  const paymentIntentId = typeof invoice.payment_intent === "string"
    ? invoice.payment_intent
    : invoice.payment_intent?.id ?? null;

  let existing: { id: string; status: string; tier: string } | null = null;
  const { data: bySub } = await supabaseAdmin
    .from("memberships")
    .select("id, status, tier")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  existing = bySub;

  if (!existing && paymentIntentId) {
    const { data: byPi } = await supabaseAdmin
      .from("memberships")
      .select("id, status, tier")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle();
    existing = byPi;
  }

  if (!existing) {
    const { data: rows } = await supabaseAdmin
      .from("memberships")
      .select("id, status, tier")
      .eq("user_id", userId)
      .in("status", ["active", "pending_payment"])
      .order("updated_at", { ascending: false })
      .limit(1);
    existing = rows?.[0] ?? null;
  }

  if (existing) {
    const { error: memErr } = await supabaseAdmin
      .from("memberships")
      .update({
        tier:                     "member",
        status:                   "active",
        stripe_subscription_id:   subscriptionId,
        stripe_payment_intent_id: paymentIntentId ?? undefined,
        cancel_at_period_end:     false,
        expires_at:               newPeriodEnd,
        updated_at:               new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (memErr) {
      console.error("[invoice.paid] Failed to update membership:", memErr.message);
      return;
    }
  } else {
    await supabaseAdmin.from("memberships").insert({
      user_id:                  userId,
      tier:                     "member",
      status:                   "active",
      stripe_subscription_id:   subscriptionId,
      stripe_payment_intent_id: paymentIntentId,
      amount_paid:              invoice.amount_paid ?? 200,
      starts_at:                new Date().toISOString(),
      expires_at:               newPeriodEnd,
    });
  }

  const stripeInvoiceId = invoice.id;
  let existingTxId: string | null = null;
  const { data: txByInvoice } = await supabaseAdmin
    .from("transactions")
    .select("id")
    .eq("stripe_invoice_id", stripeInvoiceId)
    .maybeSingle();
  existingTxId = txByInvoice?.id ?? null;

  if (!existingTxId && paymentIntentId) {
    const { data: txByPi } = await supabaseAdmin
      .from("transactions")
      .select("id")
      .eq("provider_payment_intent_id", paymentIntentId)
      .maybeSingle();
    existingTxId = txByPi?.id ?? null;
  }

  if (existingTxId) {
    console.log(`[invoice.paid] Transaction already exists (${existingTxId}) for invoice ${stripeInvoiceId}`);
    return;
  }

  const amountPaid = (invoice.amount_paid ?? 200) / 100;
  const { data: txRow, error: txError } = await supabaseAdmin
    .from("transactions")
    .insert({
      user_id:                  userId,
      type:                     "subscription",
      status:                   "completed",
      amount:                   amountPaid,
      currency:                 invoice.currency ?? "usd",
      provider:                 "stripe",
      provider_payment_intent_id: paymentIntentId,
      provider_transaction_id:  paymentIntentId,
      stripe_invoice_id:        stripeInvoiceId,
      description:              "Full Membership — MAALI ($2/month)",
      completed_at:             new Date().toISOString(),
    })
    .select("id, invoice_number")
    .maybeSingle();

  if (txError) {
    console.error("[invoice.paid] Failed to insert transaction:", txError.message);
    return;
  }

  const transactionId = txRow?.id ?? null;

  let invoicePdfUrl: string | null = null;
  if (transactionId && paymentIntentId) {
    try {
      const { data: userProfile } = await supabaseAdmin
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", userId)
        .maybeSingle();

      const userName = userProfile
        ? `${userProfile.first_name || ""} ${userProfile.last_name || ""}`.trim() || "Member"
        : "Member";

      let paymentMethodLast4: string | null = null;
      try {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (pi.payment_method && typeof pi.payment_method === "string") {
          const pm = await stripe.paymentMethods.retrieve(pi.payment_method);
          paymentMethodLast4 = pm.card?.last4 ?? null;
        }
      } catch { /* non-fatal */ }

      let invoiceNumber = txRow?.invoice_number ?? null;
      if (!invoiceNumber) {
        try {
          invoiceNumber = await resolveInvoiceNumber(transactionId, null);
        } catch { /* non-fatal */ }
      }

      const receiptData: ReceiptData = {
        userName,
        projectTitle:        "Full Membership — MAALI ($2/month)",
        applicationId:       null,
        amount:              amountPaid.toFixed(2),
        currency:            (invoice.currency ?? "usd").toUpperCase(),
        paymentDate:         new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
        statusLabel:         "Paid",
        invoiceNumber:       invoiceNumber ?? `INV-${stripeInvoiceId.substring(3, 11).toUpperCase()}`,
        transactionId:       paymentIntentId,
        billingEmail:        invoice.customer_email ?? null,
        paymentMethodLast4,
        receiptKind:         "subscription",
      };

      const pdfBytes = await generateReceiptPdf(receiptData);
      invoicePdfUrl  = await storeReceiptPdf(transactionId, userId, pdfBytes);

      await supabaseAdmin
        .from("transactions")
        .update({ invoice_pdf_url: invoicePdfUrl })
        .eq("id", transactionId);

      console.log(`[invoice.paid] PDF receipt stored: ${invoicePdfUrl}`);
    } catch (pdfErr) {
      console.error("[invoice.paid] PDF generation failed (non-fatal):", pdfErr);
    }
  }

  try {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const recipientEmail = authUser?.user?.email ?? invoice.customer_email ?? null;
    if (recipientEmail) {
      const { data: userProfile } = await supabaseAdmin
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", userId)
        .maybeSingle();
      const recipientName = userProfile
        ? `${userProfile.first_name || ""} ${userProfile.last_name || ""}`.trim() || "Member"
        : "Member";

      const siteUrl      = Deno.env.get("SITE_URL") || "https://maali-opportunity-hub.lovable.app";
      const supabaseUrl  = Deno.env.get("SUPABASE_URL");
      const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const internalSecret = Deno.env.get("INTERNAL_EMAIL_SECRET");

      const payload = {
        recipientName,
        projectTitle:  "Full Membership — MAALI",
        applicationId: null,
        amount:        amountPaid.toFixed(2),
        currency:      (invoice.currency ?? "usd").toUpperCase(),
        paymentDate:   new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
        transactionId: paymentIntentId,
        actionUrl:     `${siteUrl}/dashboard/billing`,
        invoicePdfUrl,
      };

      if (supabaseUrl) {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (internalSecret) headers["X-Internal-Secret"] = internalSecret;
        if (serviceKey)     headers["Authorization"]     = `Bearer ${serviceKey}`;

        const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers,
          body: JSON.stringify({ to: recipientEmail, type: "payment_receipt", data: payload, allowPublic: true }),
        });

        if (!res.ok) {
          const errBody = await res.text();
          console.error(`[invoice.paid] send-email failed (${res.status}): ${errBody}`);
          await supabaseAdmin.from("email_queue").insert({
            type: "payment_receipt",
            to_email: recipientEmail,
            payload,
            idempotency_key: `membership_receipt:${stripeInvoiceId}`,
          });
        } else {
          console.log(`[invoice.paid] Receipt email sent to ${recipientEmail}`);
        }
      }
    }
  } catch (emailErr) {
    console.error("[invoice.paid] Email failed (non-fatal):", emailErr);
  }

  console.log(`[invoice.paid] Handled invoice ${stripeInvoiceId} for user ${userId}`);
}

export async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId;
  if (!userId) {
    console.error("[subscription.deleted] No userId in subscription metadata:", sub.id);
    return;
  }

  const { error } = await supabaseAdmin.rpc("downgrade_membership_to_community", {
    p_user_id: userId,
  });

  if (error) {
    console.error("[subscription.deleted] Downgrade RPC failed:", error.message);
    return;
  }

  try {
    await supabaseAdmin.rpc("create_notification", {
      p_user_id:  userId,
      p_title:    "Membership ended",
      p_message:  "Your Full Membership has ended. You're now on the free Community plan. Upgrade any time to apply again.",
      p_type:     "payment",
      p_link:     "/dashboard/billing",
      p_metadata: buildNotificationMetadata("membership.ended", {}, {
        stripe_subscription_id: sub.id,
      }),
    });
  } catch { /* non-fatal */ }

  console.log(`[subscription.deleted] Downgraded user ${userId} to community`);
}

export async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId;
  if (!userId) {
    console.log("[subscription.updated] No userId in metadata — skipping");
    return;
  }

  const newPeriodEnd = new Date(sub.current_period_end * 1000).toISOString();

  const patch: Record<string, unknown> = {
    cancel_at_period_end: sub.cancel_at_period_end,
    expires_at:           newPeriodEnd,
    updated_at:           new Date().toISOString(),
  };

  if (sub.status === "active") {
    patch.tier = "member";
    patch.status = "active";
    patch.stripe_subscription_id = sub.id;
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from("memberships")
    .update(patch)
    .eq("user_id", userId)
    .eq("stripe_subscription_id", sub.id)
    .select("id");

  if (updateErr) {
    console.error("[subscription.updated] Update failed:", updateErr.message);
    return;
  }

  if (!updated?.length && sub.status === "active") {
    await supabaseAdmin
      .from("memberships")
      .update(patch)
      .eq("user_id", userId)
      .eq("status", "pending_payment")
      .eq("tier", "member");
  }

  console.log(`[subscription.updated] Synced sub ${sub.id} for user ${userId}: status=${sub.status}, cancel_at_period_end=${sub.cancel_at_period_end}`);
}
