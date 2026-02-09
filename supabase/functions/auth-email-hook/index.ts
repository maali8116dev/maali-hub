import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Supabase Auth Hook payload structure
interface AuthHookPayload {
  user: {
    id: string;
    email: string;
    user_metadata?: {
      first_name?: string;
      last_name?: string;
      [key: string]: unknown;
    };
  };
  email_data: {
    token?: string;
    token_hash?: string;
    redirect_to?: string;
    email_action_type: "signup" | "password_reset" | "recovery" | "email_change" | "magiclink" | "email_change_token_new" | "email_change_token_current" | string;
  };
}

// Base URL for logo and links
const baseUrl = Deno.env.get("SITE_URL") || "https://yourdomain.com";
const logoUrl = `${baseUrl}/static/maali-logo.png`; // Update with your actual logo path

// Primary gradient colors (Terra Cotta to Golden Orange)
// hsl(15 75% 45%) = #C85A2E, hsl(35 85% 55%) = #F5A623
const primaryGradient = "linear-gradient(135deg, #C85A2E 0%, #F5A623 100%)";

// AWS-style email template helper
const emailTemplate = (title: string, content: string) => `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        background-color: #eee;
        margin: 0;
        padding: 0;
        color: #212121;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
        background-color: #eee;
      }
      .email-section {
        background-color: #ffffff;
      }
      .header {
        background: ${primaryGradient};
        padding: 20px;
        text-align: center;
      }
      .header img {
        max-width: 75px;
        height: auto;
      }
      .content {
        padding: 25px 35px;
      }
      .content h1 {
        color: #333;
        font-size: 20px;
        font-weight: bold;
        margin: 0 0 15px 0;
      }
      .content p {
        color: #333;
        font-size: 14px;
        line-height: 24px;
        margin: 6px 0 14px 0;
      }
      .button {
        display: inline-block;
        background: ${primaryGradient};
        color: #ffffff !important;
        padding: 12px 24px;
        text-decoration: none;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 500;
        margin: 20px 0;
      }
      .button:visited {
        color: #ffffff !important;
      }
      .button:hover {
        opacity: 0.9;
      }
      .button-warning {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        color: #ffffff !important;
      }
      .divider {
        border: none;
        border-top: 1px solid #e5e7eb;
        margin: 0;
      }
      .footer {
        padding: 25px 35px;
      }
      .footer p {
        color: #333;
        font-size: 14px;
        margin: 0;
      }
      .footer-links {
        color: #333;
        font-size: 12px;
        margin: 24px 0;
        padding: 0 20px;
      }
      .footer-links a {
        color: #2754C5;
        text-decoration: underline;
        font-size: 14px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="email-section">
        <div class="header">
          <img src="${logoUrl}" alt="Maali Logo" width="75" height="45" />
        </div>
        <div class="content">
          <h1>${title}</h1>
          ${content}
        </div>
        <hr class="divider" />
        <div class="footer">
          <p>Maali will never email you and ask you to disclose or verify your password, credit card, or banking account number.</p>
        </div>
      </div>
      <p class="footer-links">
        This message was produced and distributed by Maali Opportunity Hub. © ${new Date().getFullYear()}, Maali. All rights reserved. View our 
        <a href="${baseUrl}/privacy" target="_blank">privacy policy</a>.
      </p>
    </div>
  </body>
  </html>
`;

const getEmailContent = (
  emailActionType: AuthHookPayload["email_data"]["email_action_type"],
  recipientName: string,
  redirectUrl: string
) => {
  // Normalize the action type to handle variations (Supabase may send "recovery" for password reset)
  const normalizedType = typeof emailActionType === "string" ? emailActionType.toLowerCase() : emailActionType;
  
  switch (normalizedType) {
    case "password_reset":
    case "recovery": // Supabase sends "recovery" for password reset emails
      return {
        subject: "Reset Your Password - Maali",
        html: emailTemplate(
          "Reset your password",
          `
            <p>We received a request to reset your password for your Maali account. We want to make sure it's really you.</p>
            <p>Click the button below to create a new password. If you didn't request a password reset, you can ignore this message.</p>
            ${redirectUrl ? `<div style="text-align: center;"><a href="${redirectUrl}" class="button button-warning" style="color:#ffffff;text-decoration:none;">Reset Password</a></div>` : ''}
            <p>This link will expire in 1 hour for security reasons.</p>
            <p>Best regards,<br>The Maali Team</p>
          `
        ),
      };

    case "signup":
      return {
        subject: "Verify Your Email - Maali",
        html: emailTemplate(
          "Verify your email address",
          `
            <p>Thanks for starting the new Maali account creation process. We want to make sure it's really you. Please click the button below to verify your email address. If you don't want to create an account, you can ignore this message.</p>
            ${redirectUrl ? `<div style="text-align: center;"><a href="${redirectUrl}" class="button" style="color:#ffffff;text-decoration:none;">Verify Email Address</a></div>` : ''}
            <p>This verification link will expire in 24 hours.</p>
            <p>Best regards,<br>The Maali Team</p>
          `
        ),
      };

    case "magiclink":
      return {
        subject: "Sign In to Maali",
        html: emailTemplate(
          "Sign in to your account",
          `
            <p>Click the button below to sign in to your Maali account. If you didn't request this magic link, you can ignore this message.</p>
            ${redirectUrl ? `<div style="text-align: center;"><a href="${redirectUrl}" class="button" style="color:#ffffff;text-decoration:none;">Sign In</a></div>` : ''}
            <p>This link will expire in 1 hour.</p>
            <p>Best regards,<br>The Maali Team</p>
          `
        ),
      };

    case "email_change":
    case "email_change_token_new":
    case "email_change_token_current":
      return {
        subject: "Confirm Email Change - Maali",
        html: emailTemplate(
          "Confirm email change",
          `
            <p>You requested to change your email address for your Maali account. We want to make sure it's really you.</p>
            <p>Click the button below to confirm this change. If you didn't request this change, you can ignore this message.</p>
            ${redirectUrl ? `<div style="text-align: center;"><a href="${redirectUrl}" class="button" style="color:#ffffff;text-decoration:none;">Confirm Email Change</a></div>` : ''}
            <p>This link will expire in 1 hour.</p>
            <p>Best regards,<br>The Maali Team</p>
          `
        ),
      };

    default:
      return {
        subject: "Maali Account Notification",
        html: emailTemplate(
          "Maali Notification",
          `
            <p>You have a new notification from Maali.</p>
            ${redirectUrl ? `<div style="text-align: center;"><a href="${redirectUrl}" class="button" style="color:#ffffff;text-decoration:none;">View Details</a></div>` : ''}
            <p>Best regards,<br>The Maali Team</p>
          `
        ),
      };
  }
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Supabase Auth Hook sends the payload directly
    const payload: AuthHookPayload = await req.json();

    // Log the payload for debugging
    console.log("Auth email hook received payload:", JSON.stringify({
      user_id: payload.user?.id,
      email: payload.user?.email,
      email_action_type: payload.email_data?.email_action_type,
      has_redirect_to: !!payload.email_data?.redirect_to,
    }, null, 2));

    if (!payload.user || !payload.email_data) {
      console.error("Invalid payload structure:", payload);
      return new Response(
        JSON.stringify({ error: "Invalid payload structure" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user, email_data } = payload;
    const { email, user_metadata } = user;
    const { email_action_type, redirect_to, token } = email_data;
    
    console.log(`Processing email for action type: "${email_action_type}"`);

    // Get recipient name from user_metadata or fetch from profiles table
    let recipientName = "User";
    
    if (user_metadata?.first_name || user_metadata?.last_name) {
      recipientName = `${user_metadata.first_name || ""} ${user_metadata.last_name || ""}`.trim() || "User";
    } else {
      // Try to fetch from profiles table
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("user_id", user.id)
          .single();
        
        if (profile?.first_name || profile?.last_name) {
          recipientName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "User";
        }
      } catch (err) {
        console.log("Could not fetch profile, using default name:", err);
      }
    }

    // Build redirect URL with token in hash fragment
    // Auth.tsx expects: /auth#access_token=TOKEN&type=recovery
    // Supabase's redirect_to might already have the token, or we need to construct it
    let redirectUrl = redirect_to;
    
    if (!redirectUrl) {
      const siteUrl = Deno.env.get("SITE_URL") || "http://localhost:5173";
      redirectUrl = `${siteUrl}/auth`;
    }
    
    // Normalize the action type
    const normalizedType = typeof email_action_type === "string" ? email_action_type.toLowerCase() : email_action_type;
    
    // Check if redirect_to already contains a hash (token already appended by Supabase)
    const hasHash = redirectUrl.includes('#');
    
    // For password reset (recovery), ensure token is in hash fragment
    if ((normalizedType === "password_reset" || normalizedType === "recovery")) {
      if (!hasHash && token) {
        // Token not in URL yet, construct it
        const baseUrl = redirectUrl.split('#')[0].split('?')[0];
        const urlPath = baseUrl.endsWith('/auth') ? baseUrl : `${baseUrl}/auth`;
        // Construct URL with token in hash: /auth#access_token=TOKEN&type=recovery
        redirectUrl = `${urlPath}#access_token=${encodeURIComponent(token)}&type=recovery`;
      } else if (!hasHash) {
        // No token available, log warning but use redirect_to as-is
        console.warn("Password reset requested but no token available in payload");
      }
      // If hasHash is true, Supabase already constructed the URL correctly
    } else if (normalizedType === "signup" && !hasHash && token) {
      // For email verification
      const baseUrl = redirectUrl.split('#')[0].split('?')[0];
      const urlPath = baseUrl.endsWith('/auth') ? baseUrl : `${baseUrl}/auth`;
      redirectUrl = `${urlPath}#access_token=${encodeURIComponent(token)}&type=signup`;
    } else if (normalizedType === "magiclink" && !hasHash && token) {
      // For magic link
      const baseUrl = redirectUrl.split('#')[0].split('?')[0];
      const urlPath = baseUrl.endsWith('/auth') ? baseUrl : `${baseUrl}/auth`;
      redirectUrl = `${urlPath}#access_token=${encodeURIComponent(token)}&type=magiclink`;
    }
    
    console.log(`Constructed redirect URL (first 150 chars): ${redirectUrl.substring(0, 150)}`);

    // Get email content based on action type
    const { subject, html } = getEmailContent(email_action_type, recipientName, redirectUrl);

    // Get configured from email or fall back to default
    const fromEmail = Deno.env.get("FROM_EMAIL") || "Maali <onboarding@resend.dev>";

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject,
      html,
    });

    console.log(`Email sent successfully for ${email_action_type}:`, emailResponse);

    // Return 200 to indicate success to Supabase
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in auth-email-hook:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    
    // Return 200 even on error to prevent Supabase from retrying indefinitely
    // Log the error for monitoring instead
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);

