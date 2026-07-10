import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0?no-dts";
import { signWebhookPayload } from "../_shared/partnerWebhookCrypto.ts";

const BATCH_SIZE = 20;
const BACKOFF_MINUTES = [1, 5, 30, 120, 360];
const MAX_ATTEMPTS = 5;

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

interface WebhookRow {
  id: string;
  partner_id: number;
  event_id: string;
  payload: Record<string, unknown>;
  attempt_count: number;
}

serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const isLocal = supabaseUrl.includes("127.0.0.1") || supabaseUrl.includes("localhost");
  const cronSecret = Deno.env.get("CRON_SECRET");

  if (!isLocal && !cronSecret) {
    return new Response(JSON.stringify({ error: "CRON_SECRET not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (cronSecret) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  try {
    const { data: batch, error: claimError } = await supabaseAdmin.rpc(
      "claim_partner_webhook_batch",
      { p_limit: BATCH_SIZE },
    );

    if (claimError) {
      console.error("claim_partner_webhook_batch:", claimError);
      return new Response(JSON.stringify({ error: claimError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!batch?.length) {
      return new Response(JSON.stringify({ processed: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    let delivered = 0;
    let failed = 0;

    for (const row of batch as WebhookRow[]) {
      const { data: hook } = await supabaseAdmin
        .from("partner_webhooks")
        .select("endpoint_url, signing_secret")
        .eq("partner_id", row.partner_id)
        .single();

      if (!hook?.endpoint_url || !hook.signing_secret) {
        await markFailed(row.id, row.attempt_count, null, "Webhook endpoint or secret missing");
        failed++;
        continue;
      }

      const rawBody = JSON.stringify(row.payload);
      const signature = await signWebhookPayload(rawBody, hook.signing_secret);

      let responseStatus: number | null = null;
      let errMsg: string | null = null;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(hook.endpoint_url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Maali-Signature": signature,
            "X-Maali-Event-Id": row.event_id,
          },
          body: rawBody,
          signal: controller.signal,
        });

        clearTimeout(timeout);
        responseStatus = res.status;

        if (res.ok) {
          await supabaseAdmin
            .from("partner_webhook_outbox")
            .update({
              status: "delivered",
              delivered_at: new Date().toISOString(),
              last_response_status: responseStatus,
              last_error: null,
            })
            .eq("id", row.id);
          delivered++;
          continue;
        }

        errMsg = `HTTP ${res.status}`;
      } catch (e) {
        errMsg = e instanceof Error ? e.message : "Delivery failed";
      }

      await markFailed(row.id, row.attempt_count, responseStatus, errMsg);
      failed++;
    }

    return new Response(
      JSON.stringify({ processed: batch.length, delivered, failed }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("process-partner-webhooks:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

async function markFailed(
  id: string,
  attemptCount: number,
  responseStatus: number | null,
  errMsg: string | null,
) {
  const nextAttempt = attemptCount + 1;
  const isDead = nextAttempt >= MAX_ATTEMPTS;
  const backoffMin = BACKOFF_MINUTES[Math.min(nextAttempt - 1, BACKOFF_MINUTES.length - 1)];
  const nextAt = new Date(Date.now() + backoffMin * 60 * 1000).toISOString();

  await supabaseAdmin
    .from("partner_webhook_outbox")
    .update({
      status: isDead ? "dead_letter" : "failed",
      attempt_count: nextAttempt,
      next_attempt_at: isDead ? new Date().toISOString() : nextAt,
      last_response_status: responseStatus,
      last_error: errMsg,
    })
    .eq("id", id);
}
