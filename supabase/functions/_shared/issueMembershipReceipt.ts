import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { generateReceiptPdf, storeReceiptPdf } from "./pdf-receipt.ts";
import { resolveInvoiceNumber } from "./invoice-number.ts";

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

  // Send email receipt
  const siteUrl = Deno.env.get("SITE_URL") || "https://maalihub.com";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const internalSecret = Deno.env.get("INTERNAL_EMAIL_SECRET");

  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
  const recipientEmail = authUser?.user?.email ?? billingEmail ?? null;

  if (!recipientEmail || !supabaseUrl) return;

  const payload = {
    recipientName: userName,
    projectTitle: "Full Membership — MAALI",
    applicationId: null,
    amount: amount.toFixed(2),
    currency: currency.toUpperCase(),
    paymentDate,
    transactionId: providerRef,
    actionUrl: `${siteUrl}/dashboard/billing`,
    invoicePdfUrl,
  };

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (internalSecret) headers["X-Internal-Secret"] = internalSecret;
    if (serviceKey) headers["Authorization"] = `Bearer ${serviceKey}`;

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

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[issueMembershipReceipt] send-email failed (${res.status}): ${errBody}`);
      // Enqueue for retry
      await supabaseAdmin.from("email_queue").insert({
        type: "payment_receipt",
        to_email: recipientEmail,
        payload,
        idempotency_key: idempotencyKey ?? `membership_receipt:${providerRef}`,
      });
    }
  } catch (emailErr) {
    console.error("[issueMembershipReceipt] email failed (non-fatal):", emailErr);
  }
}
