import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

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

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const applicationId = session.metadata?.applicationId;
  const userId = session.metadata?.userId;
  const paymentIntentId = (session.payment_intent as string) || session.id;

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
    console.log(`Application ${applicationId} already marked as paid, skipping checkout handler`);
    return;
  }

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

    // Send invoice email to applicant
    await sendPaymentReceiptEmail(applicationId, userId, session.amount_total, "usd", paymentIntentId);
  }

  // Update transaction status
  const { error: txError } = await supabaseAdmin
    .from("transactions")
    .update({
      status: "completed",
      provider_transaction_id: paymentIntentId,
      completed_at: new Date().toISOString(),
    })
    .eq("application_id", applicationId)
    .eq("status", "pending");

  if (txError) {
    console.error("Error updating transaction after checkout:", txError);
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

  // Update transaction status
  const { error: transactionError } = await supabaseAdmin
    .from("transactions")
    .update({
      status: "completed",
      provider_transaction_id: paymentIntent.id,
      completed_at: new Date().toISOString(),
    })
    .eq("provider_payment_intent_id", paymentIntentId);

  if (transactionError) {
    console.error("Error updating transaction:", transactionError);
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

      // Send invoice email to applicant
      await sendPaymentReceiptEmail(applicationId, userId, paymentIntent.amount, paymentIntent.currency, paymentIntentId);
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

async function sendPaymentReceiptEmail(
  applicationId: string,
  userId: string | undefined,
  amountInCents: number | null,
  currency: string,
  transactionId: string
) {
  try {
    // Get applicant email and name, plus project title
    const { data: appData } = await supabaseAdmin
      .from("applications")
      .select("contact_email, user_id, project_id, full_legal_name")
      .eq("id", applicationId)
      .maybeSingle();

    if (!appData) {
      console.error("Cannot send receipt: application not found");
      return;
    }

    // Get user email from auth if contact_email not available
    let recipientEmail = appData.contact_email;
    let recipientName = appData.full_legal_name || "Applicant";
    const targetUserId = userId || appData.user_id;

    if (targetUserId) {
      // Get profile name
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (profile?.first_name) {
        recipientName = `${profile.first_name} ${profile.last_name || ""}`.trim();
      }

      // Get auth email if no contact email
      if (!recipientEmail) {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
        recipientEmail = authUser?.user?.email || null;
      }
    }

    if (!recipientEmail) {
      console.error("Cannot send receipt: no email found for applicant");
      return;
    }

    // Get project title
    let projectTitle = "Project";
    if (appData.project_id) {
      const { data: project } = await supabaseAdmin
        .from("projects")
        .select("title")
        .eq("id", appData.project_id)
        .maybeSingle();
      if (project?.title) projectTitle = project.title;
    }

    const amount = amountInCents ? (amountInCents / 100).toFixed(2) : "0.00";
    const siteUrl = Deno.env.get("SITE_URL") || "https://maali-opportunity-hub.lovable.app";

    // Call the send-email edge function internally via Resend directly
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("Cannot send receipt: RESEND_API_KEY not configured");
      return;
    }

    const resend = new Resend(resendApiKey);
    const fromEmail = Deno.env.get("FROM_EMAIL") || "Maali <onboarding@resend.dev>";

    const primaryGradient = "linear-gradient(135deg, #C85A2E 0%, #F5A623 100%)";
    const baseUrl = siteUrl;
    const logoUrl = `${baseUrl}/static/maali-logo.png`;
    const paymentDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #eee; margin: 0; padding: 0; color: #212121; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #eee; }
          .email-section { background-color: #ffffff; }
          .header { background: ${primaryGradient}; padding: 20px; text-align: center; }
          .header img { max-width: 75px; height: auto; }
          .content { padding: 25px 35px; }
          .content h1 { color: #333; font-size: 20px; font-weight: bold; margin: 0 0 15px 0; }
          .content p { color: #333; font-size: 14px; line-height: 24px; margin: 6px 0 14px 0; }
          .button { display: inline-block; background: ${primaryGradient}; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: 500; margin: 20px 0; }
          .divider { border: none; border-top: 1px solid #e5e7eb; margin: 0; }
          .footer { padding: 25px 35px; }
          .footer p { color: #333; font-size: 14px; margin: 0; }
          .footer-links { color: #333; font-size: 12px; margin: 24px 0; padding: 0 20px; }
          .footer-links a { color: #2754C5; text-decoration: underline; font-size: 14px; }
          .status-badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 14px; font-weight: 500; background-color: #dcfce7; color: #166534; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="email-section">
            <div class="header">
              <img src="${logoUrl}" alt="Maali Logo" width="75" height="45" />
            </div>
            <div class="content">
              <h1>Payment Receipt</h1>
              <p>Dear ${recipientName},</p>
              <p>Thank you for your payment. Here is your receipt:</p>
              <div style="background-color: #f9fafb; padding: 20px; border-radius: 4px; margin: 20px 0;">
                <p><strong>Project:</strong> ${projectTitle}</p>
                <p><strong>Application ID:</strong> ${applicationId}</p>
                <p><strong>Amount:</strong> ${currency.toUpperCase()} ${amount}</p>
                <p><strong>Date:</strong> ${paymentDate}</p>
                <p><strong>Status:</strong> <span class="status-badge">Paid</span></p>
                <p><strong>Transaction ID:</strong> ${transactionId}</p>
              </div>
              <p>Your application fee has been confirmed and your application is now under review.</p>
              <div style="text-align: center;">
                <a href="${siteUrl}/dashboard/applications/${applicationId}" class="button" style="color:#ffffff;text-decoration:none;">View Application</a>
              </div>
              <p>Please keep this email for your records. If you have any questions about this payment, please contact our support team.</p>
              <p>Best regards,<br>The Maali Team</p>
            </div>
            <hr class="divider" />
            <div class="footer">
              <p>Maali will never email you and ask you to disclose or verify your password, credit card, or banking account number.</p>
            </div>
          </div>
          <p class="footer-links">
            This message was produced and distributed by Maali Opportunity Hub. &copy; ${new Date().getFullYear()}, Maali. All rights reserved. View our
            <a href="${baseUrl}/privacy" target="_blank">privacy policy</a>.
          </p>
        </div>
      </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: fromEmail,
      to: [recipientEmail],
      subject: `Payment Receipt - ${projectTitle}`,
      html,
    });

    console.log(`Payment receipt email sent to ${recipientEmail}:`, emailResponse);
  } catch (err) {
    console.error("Error sending payment receipt email:", err);
  }
}
