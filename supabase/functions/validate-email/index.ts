import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
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
