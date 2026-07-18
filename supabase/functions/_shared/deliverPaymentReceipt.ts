import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0?no-dts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

/**
 * Try send-email for a payment_receipt; always fall back to email_queue on
 * missing config, non-2xx, or fetch errors (self-hosted often throws before
 * a response — previously those paths never queued).
 */
export async function deliverPaymentReceiptEmail(opts: {
  to: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
}): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const internalSecret = Deno.env.get("INTERNAL_EMAIL_SECRET");

  const enqueue = async (reason: string) => {
    console.warn(`[payment-receipt] enqueue (${reason}) → ${opts.to}`);
    const { error } = await supabaseAdmin.from("email_queue").insert({
      type: "payment_receipt",
      to_email: opts.to,
      payload: opts.payload,
      idempotency_key: opts.idempotencyKey,
    });
    if (error && (error as { code?: string }).code !== "23505") {
      console.error("[payment-receipt] enqueue failed:", error);
    }
  };

  if (!internalSecret) {
    await enqueue("missing_INTERNAL_EMAIL_SECRET");
    return;
  }
  if (!supabaseUrl) {
    await enqueue("missing_SUPABASE_URL");
    return;
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Internal-Secret": internalSecret,
    };
    if (serviceKey) headers["Authorization"] = `Bearer ${serviceKey}`;

    const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        to: opts.to,
        type: "payment_receipt",
        data: opts.payload,
        allowPublic: true,
        // Body fallbacks: Kong/edge relay strips Authorization + often custom headers
        internalSecret,
        token: serviceKey ?? undefined,
      }),
    });

    if (res.ok) {
      console.log(`[payment-receipt] sent to ${opts.to}`);
      return;
    }

    const errBody = await res.text();
    console.error(`[payment-receipt] send-email ${res.status}: ${errBody}`);
    await enqueue(`send_email_${res.status}`);
  } catch (e) {
    console.error("[payment-receipt] fetch failed:", e);
    await enqueue("fetch_error");
  }
}
