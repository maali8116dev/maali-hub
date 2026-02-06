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

const baseStyles = `
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; }
    .button { display: inline-block; background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .button:hover { background: #15803d; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 14px; font-weight: 500; }
    .status-approved { background: #dcfce7; color: #166534; }
    .status-rejected { background: #fee2e2; color: #991b1b; }
    .status-review { background: #fef3c7; color: #92400e; }
  </style>
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
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
              <h1>🔐 Password Reset</h1>
            </div>
            <div class="content">
              <p>Dear ${recipientName},</p>
              <p>We received a request to reset your password for your Maali account.</p>
              <p>Click the button below to create a new password:</p>
              ${redirectUrl ? `<a href="${redirectUrl}" class="button" style="background: #f59e0b;">Reset Password</a>` : ""}
              <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
              <p>This link will expire in 1 hour for security reasons.</p>
              <p>Best regards,<br>The Maali Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Maali. All rights reserved.</p>
              <p>If the button doesn't work, copy and paste this link into your browser:</p>
              ${redirectUrl ? `<p style="word-break: break-all; color: #f59e0b;">${redirectUrl}</p>` : ""}
            </div>
          </div>
        `,
      };

    case "signup":
      return {
        subject: "Verify Your Email - Maali",
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <h1>✉️ Verify Your Email</h1>
            </div>
            <div class="content">
              <p>Dear ${recipientName},</p>
              <p>Thank you for signing up for Maali! Please verify your email address to activate your account and access all features.</p>
              ${redirectUrl ? `<a href="${redirectUrl}" class="button">Verify Email Address</a>` : ""}
              <p>If you didn't create an account with Maali, you can safely ignore this email.</p>
              <p>This verification link will expire in 24 hours.</p>
              <p>Best regards,<br>The Maali Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Maali. All rights reserved.</p>
              <p>If the button doesn't work, copy and paste this link into your browser:</p>
              ${redirectUrl ? `<p style="word-break: break-all; color: #16a34a;">${redirectUrl}</p>` : ""}
            </div>
          </div>
        `,
      };

    case "magiclink":
      return {
        subject: "Sign In to Maali",
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <h1>🔗 Magic Link Sign In</h1>
            </div>
            <div class="content">
              <p>Dear ${recipientName},</p>
              <p>Click the button below to sign in to your Maali account:</p>
              ${redirectUrl ? `<a href="${redirectUrl}" class="button">Sign In</a>` : ""}
              <p>If you didn't request this magic link, please ignore this email.</p>
              <p>This link will expire in 1 hour.</p>
              <p>Best regards,<br>The Maali Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Maali. All rights reserved.</p>
              <p>If the button doesn't work, copy and paste this link into your browser:</p>
              ${redirectUrl ? `<p style="word-break: break-all; color: #16a34a;">${redirectUrl}</p>` : ""}
            </div>
          </div>
        `,
      };

    case "email_change":
    case "email_change_token_new":
    case "email_change_token_current":
      return {
        subject: "Confirm Email Change - Maali",
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <h1>📧 Confirm Email Change</h1>
            </div>
            <div class="content">
              <p>Dear ${recipientName},</p>
              <p>You requested to change your email address for your Maali account.</p>
              <p>Click the button below to confirm this change:</p>
              ${redirectUrl ? `<a href="${redirectUrl}" class="button">Confirm Email Change</a>` : ""}
              <p>If you didn't request this change, please ignore this email or contact support immediately.</p>
              <p>This link will expire in 1 hour.</p>
              <p>Best regards,<br>The Maali Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Maali. All rights reserved.</p>
              <p>If the button doesn't work, copy and paste this link into your browser:</p>
              ${redirectUrl ? `<p style="word-break: break-all; color: #16a34a;">${redirectUrl}</p>` : ""}
            </div>
          </div>
        `,
      };

    default:
      return {
        subject: "Maali Account Notification",
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <h1>Maali Notification</h1>
            </div>
            <div class="content">
              <p>Dear ${recipientName},</p>
              <p>You have a new notification from Maali.</p>
              ${redirectUrl ? `<a href="${redirectUrl}" class="button">View Details</a>` : ""}
              <p>Best regards,<br>The Maali Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Maali. All rights reserved.</p>
            </div>
          </div>
        `,
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

