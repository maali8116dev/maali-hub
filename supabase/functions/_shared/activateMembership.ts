import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { issueMembershipReceipt } from "./issueMembershipReceipt.ts";

export const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export type ActivateMembershipParams = {
  userId: string;
  provider: "stripe" | "paystack";
  providerPaymentRef: string;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  paystackEmailToken?: string | null;
  billingCurrency: string;
  amountMajor: number;
  amountSubunits?: number | null;
  expiresAt?: string | null;
  description?: string;
  existingMembershipId?: string | null;
};

export async function findMembershipByPaymentRef(
  providerPaymentRef: string,
  userId?: string,
) {
  const { data: byRef } = await supabaseAdmin
    .from("memberships")
    .select("id, user_id, status, tier, provider_subscription_id, payment_provider")
    .eq("provider_payment_ref", providerPaymentRef)
    .maybeSingle();

  if (byRef) return byRef;

  const { data: byStripePi } = await supabaseAdmin
    .from("memberships")
    .select("id, user_id, status, tier, provider_subscription_id, payment_provider")
    .eq("stripe_payment_intent_id", providerPaymentRef)
    .maybeSingle();

  if (byStripePi) return byStripePi;

  if (userId) {
    const { data: rows } = await supabaseAdmin
      .from("memberships")
      .select("id, user_id, status, tier, provider_subscription_id, payment_provider")
      .eq("user_id", userId)
      .in("status", ["active", "pending_payment"])
      .order("updated_at", { ascending: false })
      .limit(1);
    return rows?.[0] ?? null;
  }

  return null;
}

export async function activateMembership(params: ActivateMembershipParams): Promise<boolean> {
  const {
    userId,
    provider,
    providerPaymentRef,
    providerCustomerId,
    providerSubscriptionId,
    paystackEmailToken,
    billingCurrency,
    amountMajor,
    amountSubunits,
    expiresAt,
    description = "Full Membership — MAALI (monthly)",
    existingMembershipId,
  } = params;

  let membershipId = existingMembershipId ?? null;
  let existing = membershipId
    ? await supabaseAdmin
        .from("memberships")
        .select(
          "id, status, tier, provider_customer_id, provider_subscription_id, paystack_email_token",
        )
        .eq("id", membershipId)
        .maybeSingle()
        .then((r) => r.data)
    : await findMembershipByPaymentRef(providerPaymentRef, userId);

  if (existing?.status === "active" && existing.tier === "member") {
    if (provider === "paystack") {
      const backfill: Record<string, string> = {};
      if (providerCustomerId && !existing.provider_customer_id) {
        backfill.provider_customer_id = providerCustomerId;
      }
      if (providerSubscriptionId && !existing.provider_subscription_id) {
        backfill.provider_subscription_id = providerSubscriptionId;
      }
      if (paystackEmailToken && !existing.paystack_email_token) {
        backfill.paystack_email_token = paystackEmailToken;
      }
      if (Object.keys(backfill).length > 0) {
        backfill.updated_at = new Date().toISOString();
        await supabaseAdmin.from("memberships").update(backfill).eq("id", existing.id);
      }
    }
    console.log(`[activateMembership] already active for ${providerPaymentRef}`);
    return true;
  }

  const amountPaidCents = Math.round(amountMajor * 100);
  const patch = {
    tier: "member",
    status: "active",
    payment_provider: provider,
    provider_payment_ref: providerPaymentRef,
    provider_customer_id: providerCustomerId ?? undefined,
    provider_subscription_id: providerSubscriptionId ?? undefined,
    paystack_email_token: paystackEmailToken ?? undefined,
    billing_currency: billingCurrency,
    amount_paid: amountSubunits ?? amountPaidCents,
    cancel_at_period_end: false,
    ...(expiresAt ? { expires_at: expiresAt } : {}),
    updated_at: new Date().toISOString(),
    ...(provider === "stripe" && providerCustomerId
      ? { stripe_customer_id: providerCustomerId }
      : {}),
    ...(provider === "stripe" && providerSubscriptionId
      ? { stripe_subscription_id: providerSubscriptionId }
      : {}),
    ...(provider === "stripe" ? { stripe_payment_intent_id: providerPaymentRef } : {}),
  };

  if (existing?.id) {
    membershipId = existing.id;
    const { error } = await supabaseAdmin.from("memberships").update(patch).eq("id", existing.id);
    if (error) {
      console.error("[activateMembership] update failed:", error.message);
      return false;
    }
  } else {
    const { data: inserted, error } = await supabaseAdmin
      .from("memberships")
      .insert({
        user_id: userId,
        starts_at: new Date().toISOString(),
        ...patch,
      })
      .select("id")
      .single();
    if (error) {
      console.error("[activateMembership] insert failed:", error.message);
      return false;
    }
    membershipId = inserted.id;
  }

  const { data: existingTx } = await supabaseAdmin
    .from("transactions")
    .select("id")
    .eq("provider_transaction_id", providerPaymentRef)
    .maybeSingle();

  let newTxId: string | null = null;
  if (!existingTx) {
    const { data: insertedTx, error: txError } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: userId,
        type: "subscription",
        status: "completed",
        amount: amountMajor,
        currency: billingCurrency.toLowerCase(),
        provider,
        provider_payment_intent_id: providerPaymentRef,
        provider_transaction_id: providerPaymentRef,
        description,
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();
    if (txError) {
      console.error("[activateMembership] transaction insert failed:", txError.message);
    }
    newTxId = insertedTx?.id ?? null;
  }

  // Issue PDF receipt + email for Paystack payments (Stripe does this in invoice.paid webhook).
  if (provider === "paystack" && (newTxId ?? existingTx?.id)) {
    const txId = (newTxId ?? existingTx!.id) as string;
    issueMembershipReceipt({
      userId,
      transactionId: txId,
      amount: amountMajor,
      currency: billingCurrency,
      providerRef: providerPaymentRef,
      idempotencyKey: `membership_receipt:${providerPaymentRef}`,
    }).catch((err) =>
      console.error("[activateMembership] receipt issue failed (non-fatal):", err),
    );
  }

  try {
    await supabaseAdmin.rpc("create_notification", {
      p_user_id: userId,
      p_title: "Membership activated",
      p_message: "Your Full Member subscription is active. You can now apply to opportunities.",
      p_type: "payment",
      p_link: "/dashboard",
      p_metadata: { provider, reference: providerPaymentRef },
    });
  } catch {
    /* non-fatal */
  }

  console.log(`[activateMembership] activated ${membershipId} for user ${userId} via ${provider}`);
  return true;
}

export async function extendMembershipRenewal(params: {
  userId: string;
  providerSubscriptionId: string;
  providerPaymentRef: string;
  provider: "paystack";
  billingCurrency: string;
  amountMajor: number;
  expiresAt: string;
}): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from("memberships")
    .select("id")
    .eq("user_id", params.userId)
    .eq("provider_subscription_id", params.providerSubscriptionId)
    .maybeSingle();

  if (existing) {
    await supabaseAdmin
      .from("memberships")
      .update({
        status: "active",
        tier: "member",
        expires_at: params.expiresAt,
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  }

  const { data: existingTx } = await supabaseAdmin
    .from("transactions")
    .select("id")
    .eq("provider_transaction_id", params.providerPaymentRef)
    .maybeSingle();

  let renewalTxId: string | null = existingTx?.id ?? null;
  if (!existingTx) {
    const { data: insertedTx } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: params.userId,
        type: "subscription",
        status: "completed",
        amount: params.amountMajor,
        currency: params.billingCurrency.toLowerCase(),
        provider: params.provider,
        provider_payment_intent_id: params.providerPaymentRef,
        provider_transaction_id: params.providerPaymentRef,
        description: "Full Membership renewal — MAALI",
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();
    renewalTxId = insertedTx?.id ?? null;
  }

  if (renewalTxId) {
    issueMembershipReceipt({
      userId: params.userId,
      transactionId: renewalTxId,
      amount: params.amountMajor,
      currency: params.billingCurrency,
      providerRef: params.providerPaymentRef,
      idempotencyKey: `membership_receipt:${params.providerPaymentRef}`,
    }).catch((err) =>
      console.error("[extendMembershipRenewal] receipt issue failed (non-fatal):", err),
    );
  }
}
