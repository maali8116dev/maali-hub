import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0?no-dts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { parseClientIp } from "../_shared/auth.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ valid: false, message: "Email is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Each lookup below is a paid API call and this endpoint is public, so cap
    // it per IP. Over the cap we skip the paid check rather than block sign-up
    // (many real users share one IP on mobile networks).
    const { data: limit, error: limitError } = await supabaseAdmin.rpc(
      "check_and_increment_rate_limit",
      {
        p_user_id: null,
        p_ip_address: parseClientIp(req),
        p_operation_type: "validate_email",
        p_max_requests: 20,
        p_window_minutes: 60,
      },
    );
    if (limitError) {
      console.error("validate-email rate limit check failed:", limitError.message);
    } else if (limit && !limit.allowed) {
      return new Response(
        JSON.stringify({ valid: true, skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("ABSTRACT_API_KEY");
    if (!apiKey) {
      console.error("ABSTRACT_API_KEY is not configured");
      return new Response(
        JSON.stringify({ valid: false, message: "Email validation service is unavailable." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch(
      `https://emailvalidation.abstractapi.com/v1/?api_key=${apiKey}&email=${encodeURIComponent(email)}`
    );

    if (!response.ok) {
      console.error(`Abstract API error: ${response.status} ${response.statusText}`);
      return new Response(
        JSON.stringify({ valid: false, message: "Email validation service error. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    // Check format
    if (!data.is_valid_format?.value) {
      return new Response(
        JSON.stringify({ valid: false, message: "Invalid email address format." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check disposable
    if (data.is_disposable_email?.value) {
      return new Response(
        JSON.stringify({ valid: false, message: "Temporary email addresses are not allowed." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check deliverability
    if (data.deliverability === "UNDELIVERABLE") {
      return new Response(
        JSON.stringify({ valid: false, message: "This email address cannot receive emails." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check MX records
    if (!data.is_mx_found?.value) {
      return new Response(
        JSON.stringify({ valid: false, message: "Invalid email domain." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ valid: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Email validation error:", error);
    return new Response(
      JSON.stringify({ valid: false, message: "Email validation failed. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
