import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import {
  stripe,
  supabaseAdmin,
  handleCheckoutCompleted,
  handlePaymentSuccess,
  handlePaymentFailure,
  handlePaymentCanceled,
  handleInvoicePaid,
  handleSubscriptionDeleted,
  handleSubscriptionUpdated,
} from "./handlers.ts";

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

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

  // Idempotency + retry tracking.
  // Try to claim the event. On PK conflict, only skip if previously completed;
  // otherwise allow Stripe's retry to re-run the handler.
  const { error: insertErr } = await supabaseAdmin
    .from("stripe_events")
    .insert({ id: event.id, type: event.type, status: "processing" });

  if (insertErr) {
    if ((insertErr as { code?: string }).code === "23505") {
      const { data: existing } = await supabaseAdmin
        .from("stripe_events")
        .select("status, attempts")
        .eq("id", event.id)
        .maybeSingle();

      if (existing?.status === "completed") {
        console.log(`Duplicate stripe event ignored (already completed): ${event.id} (${event.type})`);
        return new Response(
          JSON.stringify({ received: true, duplicate: true }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      console.log(`Retrying stripe event ${event.id} (${event.type}), prior status=${existing?.status}, attempt=${(existing?.attempts ?? 0) + 1}`);
      await supabaseAdmin
        .from("stripe_events")
        .update({
          status: "processing",
          attempts: (existing?.attempts ?? 0) + 1,
          error: null,
        })
        .eq("id", event.id);
    } else {
      console.error("Failed to record stripe event, processing anyway:", insertErr);
    }
  }

  try {
    switch (event.type) {
      // Legacy per-application fee checkouts (archived). New applies use membership on /join.
      case "checkout.session.completed": {
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      }

      case "payment_intent.succeeded": {
        await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;
      }

      case "payment_intent.payment_failed": {
        await handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
        break;
      }

      case "payment_intent.canceled": {
        await handlePaymentCanceled(event.data.object as Stripe.PaymentIntent);
        break;
      }

      // ── Subscription lifecycle ──────────────────────────────────────────────

      case "invoice.paid": {
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      }

      case "customer.subscription.deleted": {
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      }

      case "customer.subscription.updated": {
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    await supabaseAdmin
      .from("stripe_events")
      .update({ status: "completed", processed_at: new Date().toISOString(), error: null })
      .eq("id", event.id);

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing webhook:", error);
    await supabaseAdmin
      .from("stripe_events")
      .update({
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      })
      .eq("id", event.id);
    return new Response(
      JSON.stringify({ error: "Webhook processing failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
