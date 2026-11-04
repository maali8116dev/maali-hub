import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0?no-dts";
import { getCorsHeaders } from "../_shared/cors.ts";

/**
 * Marks prepaid memberships past expires_at as expired.
 * Invoke via cron with Authorization: Bearer $CRON_SECRET
 */
serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const isLocal = (Deno.env.get("SUPABASE_URL") ?? "").includes("127.0.0.1") ||
    (Deno.env.get("SUPABASE_URL") ?? "").includes("localhost");

  if (!cronSecret && !isLocal) {
    return new Response(JSON.stringify({ error: "CRON_SECRET not configured" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (cronSecret && token !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("memberships")
    .update({ status: "expired", updated_at: now })
    .eq("status", "active")
    .eq("renewal_type", "prepaid")
    .lt("expires_at", now)
    .select("id, user_id");

  if (error) {
    console.error("[expire-prepaid-memberships]", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const expired = data ?? [];
  for (const row of expired) {
    try {
      await supabase.rpc("create_notification", {
        p_user_id: row.user_id,
        p_title: "Membership expired",
        p_message:
          "Your prepaid Full Membership has ended. Renew with Opay/bank or card to keep applying.",
        p_type: "payment",
        p_link: "/dashboard/billing",
        p_metadata: { renewal_type: "prepaid", membership_id: row.id },
      });
    } catch {
      /* non-fatal */
    }
  }

  return new Response(
    JSON.stringify({ expired: expired.length, ids: expired.map((r) => r.id) }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
