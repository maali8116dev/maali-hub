import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0?no-dts";
import { generateReceiptPdf, storeReceiptPdf } from "./pdf-receipt.ts";
import { resolveInvoiceNumber } from "./invoice-number.ts";
import { deliverPaymentReceiptEmail } from "./deliverPaymentReceipt.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export type IssueMembershipReceiptParams = {
  userId: string;
  transactionId: string;
  amount: number;             // major units (e.g. 30 for GH₵30, 2 for $2)
  currency: string;           // "GHS", "USD", "NGN", etc.
  providerRef: string;        // shown as Transaction ID on PDF
  paymentMethodLast4?: string | null;
  billingEmail?: string | null;
  idempotencyKey?: string;    // for email_queue dedup
};

export async function issueMembershipReceipt(
  params: IssueMembershipReceiptParams,
): Promise<void> {
  const {
    userId,
    transactionId,
    amount,
    currency,
    providerRef,
    paymentMethodLast4 = null,
    billingEmail: billingEmailParam = null,
    idempotencyKey,
  } = params;

  const { data: userProfile } = await supabaseAdmin
    .from("profiles")
    .select("first_name, last_name")
    .eq("user_id", userId)
    .maybeSingle();

  const userName = userProfile
    ? `${userProfile.first_name || ""} ${userProfile.last_name || ""}`.trim() || "Member"
    : "Member";

  let billingEmail = billingEmailParam;
  if (!billingEmail) {
    const { data: billingAddr } = await supabaseAdmin
      .from("billing_addresses")
      .select("billing_email")
      .eq("user_id", userId)
      .eq("is_default", true)
      .is("deleted_at", null)
      .maybeSingle();
    billingEmail = billingAddr?.billing_email ?? null;
  }

  let invoiceNumber: string | null = null;
  try {
    invoiceNumber = await resolveInvoiceNumber(transactionId, null);
  } catch {
    invoiceNumber = `INV-${providerRef.slice(-8).toUpperCase()}`;
  }

  const paymentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const receiptData = {
    userName,
    projectTitle: "Full Membership — MAALI",
    applicationId: null,
    amount: amount.toFixed(2),
    currency: currency.toUpperCase(),
    paymentDate,
    statusLabel: "Paid",
    invoiceNumber: invoiceNumber!,
    transactionId: providerRef,
    billingEmail,
    paymentMethodLast4,
    receiptKind: "subscription" as const,
  };

  const pdfBytes = await generateReceiptPdf(receiptData);
  let invoicePdfUrl: string | null = null;

  try {
    invoicePdfUrl = await storeReceiptPdf(transactionId, userId, pdfBytes);
    await supabaseAdmin
      .from("transactions")
      .update({ invoice_pdf_url: invoicePdfUrl })
      .eq("id", transactionId);
  } catch (storeErr) {
    console.warn("[issueMembershipReceipt] PDF store failed (non-fatal):", storeErr);
  }

  // Send email receipt (or enqueue on any failure — including missing config / fetch throw)
  const siteUrl = Deno.env.get("SITE_URL") || "https://maalihub.com";

  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
  const recipientEmail = authUser?.user?.email ?? billingEmail ?? null;

  if (!recipientEmail) {
    console.warn("[issueMembershipReceipt] no recipient email, skipping");
    return;
  }

  await deliverPaymentReceiptEmail({
    to: recipientEmail,
    idempotencyKey: idempotencyKey ?? `membership_receipt:${providerRef}`,
    payload: {
      recipientName: userName,
      projectTitle: "Full Membership — MAALI",
      applicationId: null,
      amount: amount.toFixed(2),
      currency: currency.toUpperCase(),
      paymentDate,
      transactionId: providerRef,
      actionUrl: `${siteUrl}/dashboard/billing`,
      invoicePdfUrl,
    },
  });
}
