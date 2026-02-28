import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

/**
 * process-email-queue
 *
 * A worker function designed to be called on a schedule (e.g. every 1-2 minutes
 * via Supabase cron / pg_cron or an external scheduler).
 *
 * It claims a batch of pending/failed emails from `email_queue`, sends them via
 * Resend, and updates their status. Implements exponential backoff for retries
 * and dead-lettering after max attempts.
 */

const BATCH_SIZE = 10;

// Exponential backoff intervals in minutes: 1m, 5m, 30m, 2h, 12h
const BACKOFF_MINUTES = [1, 5, 30, 120, 720];

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

serve(async (req: Request) => {
  // This function can be invoked by cron or manually.
  // Optional: verify a shared secret header for security.
  const cronSecret = Deno.env.get("CRON_SECRET");
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
    // Atomically claim a batch of emails ready to send using a SQL function.
    // This prevents multiple workers from processing the same rows.
    const { data: emails, error: fetchError } = await supabaseAdmin.rpc(
      "claim_email_batch",
      { p_limit: BATCH_SIZE }
    );

    if (fetchError) {
      console.error("Error claiming email queue batch:", fetchError);
      return new Response(JSON.stringify({ error: "Failed to claim queue batch" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!emails || emails.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "Queue empty" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Route each email through the send-email edge function.
    // We call it internally via HTTP so all template logic stays in one place.
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const internalSecret = Deno.env.get("INTERNAL_EMAIL_SECRET");
    const sendEmailUrl = `${supabaseUrl}/functions/v1/send-email`;

    let sent = 0;
    let failed = 0;

    for (const email of emails) {
      try {
        const payload = email.payload as Record<string, unknown>;

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (internalSecret) {
          headers["X-Internal-Secret"] = internalSecret;
        }

        const response = await fetch(sendEmailUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            to: email.to_email,
            type: email.type,
            data: payload,
            // Allow public path in send-email, but we still guard payment_receipt
            // with INTERNAL_EMAIL_SECRET on the server side.
            allowPublic: true,
          }),
        });

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`send-email returned ${response.status}: ${errBody}`);
        }

        // Mark as sent
        await supabaseAdmin
          .from("email_queue")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", email.id);

        sent++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const newAttemptCount = (email.attempt_count || 0) + 1;
        const maxAttempts = email.max_attempts || 5;

        if (newAttemptCount >= maxAttempts) {
          // Dead-letter
          await supabaseAdmin
            .from("email_queue")
            .update({
              status: "dead",
              attempt_count: newAttemptCount,
              last_error: errorMessage,
            })
            .eq("id", email.id);
          console.error(`Email ${email.id} dead-lettered after ${newAttemptCount} attempts: ${errorMessage}`);
        } else {
          // Schedule retry with exponential backoff
          const backoffIndex = Math.min(newAttemptCount - 1, BACKOFF_MINUTES.length - 1);
          const backoffMs = BACKOFF_MINUTES[backoffIndex] * 60 * 1000;
          const nextAttempt = new Date(Date.now() + backoffMs).toISOString();

          await supabaseAdmin
            .from("email_queue")
            .update({
              status: "failed",
              attempt_count: newAttemptCount,
              last_error: errorMessage,
              next_attempt_at: nextAttempt,
            })
            .eq("id", email.id);
          console.warn(`Email ${email.id} failed (attempt ${newAttemptCount}), retry at ${nextAttempt}: ${errorMessage}`);
        }

        failed++;
      }
    }

    console.log(`Email queue processed: ${sent} sent, ${failed} failed out of ${emails.length}`);

    return new Response(
      JSON.stringify({ processed: emails.length, sent, failed }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Email queue worker error:", error);
    return new Response(
      JSON.stringify({ error: "Worker failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

