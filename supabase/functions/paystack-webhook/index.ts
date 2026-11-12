import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { verifyPaystackSignature } from "../_shared/paystackApi.ts";
import { supabaseAdmin, activateMembership, extendMembershipRenewal } from "../_shared/activateMembership.ts";
import { isPaystackMembershipCharge } from "../_shared/paymentProvider.ts";

type PaystackEvent = {
  event: string;
  data: Record<string, unknown>;
};

function eventId(payload: PaystackEvent): string {
  const data = payload.data ?? {};
  const id = data.id ?? data.reference ?? data.subscription_code ?? data.invoice_code;
  return `${payload.event}:${String(id)}`;
}

function metadataUserId(data: Record<string, unknown>): string | null {
  const meta = data.metadata as Record<string, unknown> | undefined;
  if (typeof meta?.userId === "string") return meta.userId;
  if (typeof meta?.user_id === "string") return meta.user_id;
  const custom = meta?.custom_fields as Array<{ variable_name?: string; value?: string }> | undefined;
  const field = custom?.find((f) => f.variable_name === "user_id");
  return field?.value ?? null;
}

function isPrepaidCharge(data: Record<string, unknown>): boolean {
  const meta = data.metadata as Record<string, unknown> | undefined;
  if (meta?.billingMode === "prepaid" || meta?.renewal_type === "prepaid") return true;
  const custom = meta?.custom_fields as Array<{ variable_name?: string; value?: string }> | undefined;
  const field = custom?.find((f) => f.variable_name === "billing_mode");
  return field?.value === "prepaid";
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function resolveExpiresAt(data: Record<string, unknown>): string {
  const sub = data.subscription as Record<string, unknown> | undefined;
  const npd = sub?.next_payment_date ?? data.next_payment_date;
  if (typeof npd === "string") {
    const d = new Date(npd);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(Date.now() + THIRTY_DAYS_MS).toISOString();
}

function chargePlanCode(data: Record<string, unknown>): string | null {
  const plan = data.plan as Record<string, unknown> | string | undefined;
  if (typeof plan === "string") return plan || null;
  return typeof plan?.plan_code === "string" ? plan.plan_code : null;
}

const MEMBERSHIP_COLUMNS = "id, user_id, status, tier, renewal_type, provider_payment_ref";

async function handleChargeSuccess(data: Record<string, unknown>) {
  const reference = String(data.reference ?? "");
  const currency = String(data.currency ?? "NGN").toUpperCase();
  const amountKobo = Number(data.amount ?? 0);

  if (!reference) {
    console.error("[paystack-webhook] charge.success missing reference");
    return;
  }

  if (!isPaystackMembershipCharge(amountKobo, currency, chargePlanCode(data))) {
    console.error(
      `[paystack-webhook] ${reference}: ${amountKobo} ${currency} is not a Full Membership charge — not activating`,
    );
    return;
  }

  const customer = data.customer as Record<string, unknown> | undefined;
  const customerCode = typeof customer?.customer_code === "string" ? customer.customer_code : null;
  const subscription = data.subscription as Record<string, unknown> | undefined;
  const subCode = typeof subscription?.subscription_code === "string"
    ? subscription.subscription_code
    : typeof data.subscription_code === "string"
    ? data.subscription_code
    : null;

  // The membership this charge belongs to: the checkout row for this
  // reference, else the payer's active Paystack membership (renewal charges
  // carry a new reference and often no metadata or subscription code).
  const { data: byRef } = await supabaseAdmin
    .from("memberships")
    .select(MEMBERSHIP_COLUMNS)
    .eq("provider_payment_ref", reference)
    .maybeSingle();

  const metaUserId = metadataUserId(data);
  let current = byRef;
  if (!current && (metaUserId || customerCode)) {
    let query = supabaseAdmin
      .from("memberships")
      .select(MEMBERSHIP_COLUMNS)
      .eq("payment_provider", "paystack")
      .eq("status", "active")
      .eq("tier", "member");
    query = metaUserId
      ? query.eq("user_id", metaUserId)
      : query.eq("provider_customer_id", customerCode);
    const { data: rows } = await query.order("updated_at", { ascending: false }).limit(1);
    current = rows?.[0] ?? null;
  }

  const userId = metaUserId ?? current?.user_id ?? null;
  if (!userId) {
    console.error("[paystack-webhook] charge.success missing userId");
    return;
  }

  const amountMajor = amountKobo / 100;
  const prepaid = isPrepaidCharge(data) || byRef?.renewal_type === "prepaid";
  const expiresAt = prepaid
    ? new Date(Date.now() + THIRTY_DAYS_MS).toISOString()
    : resolveExpiresAt(data);

  const isRenewal =
    !prepaid &&
    current?.status === "active" &&
    current.tier === "member" &&
    current.renewal_type !== "prepaid" &&
    current.provider_payment_ref !== reference;

  if (isRenewal) {
    await extendMembershipRenewal({
      userId,
      membershipId: current!.id,
      providerPaymentRef: reference,
      provider: "paystack",
      billingCurrency: currency,
      amountMajor,
      expiresAt,
    });
    return;
  }

  await activateMembership({
    userId,
    provider: "paystack",
    providerPaymentRef: reference,
    providerCustomerId: customerCode,
    // Prepaid one-time charges have no subscription_code — never treat as Plan renewal.
    providerSubscriptionId: prepaid ? null : subCode,
    billingCurrency: currency,
    amountMajor,
    amountSubunits: amountKobo,
    expiresAt,
    renewalType: prepaid ? "prepaid" : "subscription",
  });
}

async function handleSubscriptionCreate(data: Record<string, unknown>) {
  const subCode = String(data.subscription_code ?? "");
  const emailToken = typeof data.email_token === "string" ? data.email_token : null;
  const customer = data.customer as Record<string, unknown> | undefined;
  const customerCode = typeof customer?.customer_code === "string" ? customer.customer_code : null;
  const userId = metadataUserId(data);

  if (!subCode) return;

  const { data: alreadyLinked } = await supabaseAdmin
    .from("memberships")
    .select("id")
    .eq("provider_subscription_id", subCode)
    .maybeSingle();
  if (alreadyLinked) return;

  let membershipQuery = supabaseAdmin
    .from("memberships")
    .select("id, user_id")
    .eq("payment_provider", "paystack");

  if (userId) {
    membershipQuery = membershipQuery.eq("user_id", userId);
  } else if (customerCode) {
    membershipQuery = membershipQuery.eq("provider_customer_id", customerCode);
  }

  const { data: membership } = await membershipQuery
    .in("status", ["active", "pending_payment"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    throw new Error(`subscription.create — no membership for sub ${subCode} yet; will retry`);
  }

  await supabaseAdmin
    .from("memberships")
    .update({
      provider_subscription_id: subCode,
      provider_customer_id: customerCode ?? undefined,
      paystack_email_token: emailToken ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", membership.id);
}

async function handleSubscriptionDisable(data: Record<string, unknown>) {
  const subCode = String(data.subscription_code ?? "");
  if (!subCode) return;

  const { data: membership } = await supabaseAdmin
    .from("memberships")
    .select("user_id")
    .eq("provider_subscription_id", subCode)
    .maybeSingle();

  if (!membership?.user_id) return;

  await supabaseAdmin.rpc("downgrade_membership_to_community", {
    p_user_id: membership.user_id,
  });
}

/** Cancelled but paid through the current period: access ends on subscription.disable. */
async function handleSubscriptionNotRenew(data: Record<string, unknown>) {
  const subCode = String(data.subscription_code ?? "");
  if (!subCode) return;

  const { error } = await supabaseAdmin
    .from("memberships")
    .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
    .eq("provider_subscription_id", subCode);
  if (error) throw new Error(`subscription.not_renew update failed: ${error.message}`);
}

async function handleInvoicePaymentFailed(data: Record<string, unknown>) {
  const subscription = data.subscription as Record<string, unknown> | undefined;
  const subCode = typeof subscription?.subscription_code === "string"
    ? subscription.subscription_code
    : null;
  if (!subCode) return;

  const { data: membership } = await supabaseAdmin
    .from("memberships")
    .select("user_id")
    .eq("provider_subscription_id", subCode)
    .maybeSingle();

  if (!membership?.user_id) return;

  try {
    await supabaseAdmin.rpc("create_notification", {
      p_user_id: membership.user_id,
      p_title: "Membership payment failed",
      p_message: "We could not charge your Paystack subscription. Update your payment method to keep Full Member access.",
      p_type: "payment",
      p_link: "/dashboard/billing",
      p_metadata: { provider: "paystack", subscription_code: subCode },
    });
  } catch {
    /* non-fatal */
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const signature = req.headers.get("x-paystack-signature");
  const body = await req.text();

  const valid = await verifyPaystackSignature(body, signature);
  if (!valid) {
    console.error("[paystack-webhook] invalid signature");
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
  }

  let payload: PaystackEvent;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const id = eventId(payload);

  const { error: insertErr } = await supabaseAdmin
    .from("paystack_events")
    .insert({ id, type: payload.event, status: "processing" });

  if (insertErr) {
    if ((insertErr as { code?: string }).code === "23505") {
      const { data: existing } = await supabaseAdmin
        .from("paystack_events")
        .select("status, attempts")
        .eq("id", id)
        .maybeSingle();

      if (existing?.status === "completed") {
        return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
      }

      await supabaseAdmin
        .from("paystack_events")
        .update({
          status: "processing",
          attempts: (existing?.attempts ?? 0) + 1,
          error: null,
        })
        .eq("id", id);
    } else {
      console.error("[paystack-webhook] event insert failed:", insertErr);
    }
  }

  try {
    switch (payload.event) {
      case "charge.success":
        await handleChargeSuccess(payload.data);
        break;
      case "subscription.create":
        await handleSubscriptionCreate(payload.data);
        break;
      case "subscription.disable":
        await handleSubscriptionDisable(payload.data);
        break;
      case "subscription.not_renew":
        await handleSubscriptionNotRenew(payload.data);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(payload.data);
        break;
      default:
        console.log(`[paystack-webhook] unhandled: ${payload.event}`);
    }

    await supabaseAdmin
      .from("paystack_events")
      .update({ status: "completed", processed_at: new Date().toISOString(), error: null })
      .eq("id", id);

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error) {
    console.error("[paystack-webhook] handler error:", error);
    await supabaseAdmin
      .from("paystack_events")
      .update({
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      })
      .eq("id", id);
    return new Response(JSON.stringify({ error: "Processing failed" }), { status: 500 });
  }
});
