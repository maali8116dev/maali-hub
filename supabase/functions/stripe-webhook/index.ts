import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

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
  const userId = paymentIntent.metadata.userId;
  const applicationId = paymentIntent.metadata.applicationId;

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
      })
      .eq("id", applicationId);

    if (applicationError) {
      console.error("Error updating application:", applicationError);
    }
  }

  console.log(`Payment succeeded: ${paymentIntentId} for user ${userId}`);
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
