import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type EmailType = 
  | "application_submitted"
  | "application_approved"
  | "application_rejected"
  | "application_under_review"
  | "status_update"
  | "welcome"
  | "email_verification"
  | "password_reset";

interface SendEmailRequest {
  to: string;
  type: EmailType;
  data: {
    recipientName?: string;
    projectTitle?: string;
    applicationId?: string;
    statusMessage?: string;
    actionUrl?: string;
  };
}

const getEmailContent = (type: EmailType, data: SendEmailRequest["data"]) => {
  const { recipientName = "Applicant", projectTitle, applicationId, statusMessage, actionUrl } = data;
  
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

  switch (type) {
    case "application_submitted":
      return {
        subject: `Application Submitted - ${projectTitle || "Maali"}`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <h1>🎉 Application Submitted!</h1>
            </div>
            <div class="content">
              <p>Dear ${recipientName},</p>
              <p>Thank you for submitting your application for <strong>${projectTitle}</strong>.</p>
              <p>Your application ID is: <strong>${applicationId}</strong></p>
              <p>Our team will review your application and get back to you within 5-7 business days.</p>
              ${actionUrl ? `<a href="${actionUrl}" class="button">View Application Status</a>` : ""}
              <p>If you have any questions, please don't hesitate to contact us.</p>
              <p>Best regards,<br>The Maali Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Maali. All rights reserved.</p>
              <p>This is an automated message. Please do not reply directly to this email.</p>
            </div>
          </div>
        `,
      };

    case "application_approved":
      return {
        subject: `Congratulations! Your Application Has Been Approved - ${projectTitle}`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <h1>✅ Application Approved!</h1>
            </div>
            <div class="content">
              <p>Dear ${recipientName},</p>
              <p>We are delighted to inform you that your application for <strong>${projectTitle}</strong> has been <span class="status-badge status-approved">Approved</span>!</p>
              <p>Application ID: <strong>${applicationId}</strong></p>
              ${statusMessage ? `<p>${statusMessage}</p>` : "<p>Our team will be in touch shortly with the next steps.</p>"}
              ${actionUrl ? `<a href="${actionUrl}" class="button">View Details</a>` : ""}
              <p>Congratulations once again!</p>
              <p>Best regards,<br>The Maali Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Maali. All rights reserved.</p>
            </div>
          </div>
        `,
      };

    case "application_rejected":
      return {
        subject: `Application Update - ${projectTitle}`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header" style="background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);">
              <h1>Application Update</h1>
            </div>
            <div class="content">
              <p>Dear ${recipientName},</p>
              <p>Thank you for your interest in <strong>${projectTitle}</strong>.</p>
              <p>After careful consideration, we regret to inform you that your application has not been successful at this time.</p>
              ${statusMessage ? `<p><strong>Feedback:</strong> ${statusMessage}</p>` : ""}
              <p>We encourage you to explore other opportunities on our platform and apply again in the future.</p>
              ${actionUrl ? `<a href="${actionUrl}" class="button">Browse Opportunities</a>` : ""}
              <p>Best regards,<br>The Maali Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Maali. All rights reserved.</p>
            </div>
          </div>
        `,
      };

    case "application_under_review":
      return {
        subject: `Your Application is Under Review - ${projectTitle}`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
              <h1>📋 Under Review</h1>
            </div>
            <div class="content">
              <p>Dear ${recipientName},</p>
              <p>Your application for <strong>${projectTitle}</strong> is now <span class="status-badge status-review">Under Review</span>.</p>
              <p>Application ID: <strong>${applicationId}</strong></p>
              <p>Our team is carefully evaluating your submission. You will receive an update once a decision has been made.</p>
              ${actionUrl ? `<a href="${actionUrl}" class="button">Track Application</a>` : ""}
              <p>Thank you for your patience.</p>
              <p>Best regards,<br>The Maali Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Maali. All rights reserved.</p>
            </div>
          </div>
        `,
      };

    case "status_update":
      return {
        subject: `Application Status Update - ${projectTitle || "Maali"}`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <h1>📬 Status Update</h1>
            </div>
            <div class="content">
              <p>Dear ${recipientName},</p>
              <p>There has been an update to your application${projectTitle ? ` for <strong>${projectTitle}</strong>` : ""}.</p>
              ${applicationId ? `<p>Application ID: <strong>${applicationId}</strong></p>` : ""}
              ${statusMessage ? `<p>${statusMessage}</p>` : ""}
              ${actionUrl ? `<a href="${actionUrl}" class="button">View Details</a>` : ""}
              <p>Best regards,<br>The Maali Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Maali. All rights reserved.</p>
            </div>
          </div>
        `,
      };

    case "welcome":
      return {
        subject: "Welcome to Maali! 🌱",
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <h1>🌱 Welcome to Maali!</h1>
            </div>
            <div class="content">
              <p>Dear ${recipientName},</p>
              <p>Welcome to Maali – your gateway to funding opportunities across Africa!</p>
              <p>With your new account, you can:</p>
              <ul>
                <li>Browse funding opportunities tailored to your needs</li>
                <li>Submit applications with ease</li>
                <li>Track your application status in real-time</li>
                <li>Receive notifications on new opportunities</li>
              </ul>
              ${actionUrl ? `<a href="${actionUrl}" class="button">Explore Opportunities</a>` : ""}
              <p>If you have any questions, our support team is here to help.</p>
              <p>Best regards,<br>The Maali Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Maali. All rights reserved.</p>
            </div>
          </div>
        `,
      };

    case "email_verification":
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
              ${actionUrl ? `<a href="${actionUrl}" class="button">Verify Email Address</a>` : ""}
              <p>If you didn't create an account with Maali, you can safely ignore this email.</p>
              <p>This verification link will expire in 24 hours.</p>
              <p>Best regards,<br>The Maali Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Maali. All rights reserved.</p>
              <p>If the button doesn't work, copy and paste this link into your browser:</p>
              ${actionUrl ? `<p style="word-break: break-all; color: #16a34a;">${actionUrl}</p>` : ""}
            </div>
          </div>
        `,
      };

    case "password_reset":
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
              ${actionUrl ? `<a href="${actionUrl}" class="button" style="background: #f59e0b;">Reset Password</a>` : ""}
              <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
              <p>This link will expire in 1 hour for security reasons.</p>
              <p>Best regards,<br>The Maali Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Maali. All rights reserved.</p>
              <p>If the button doesn't work, copy and paste this link into your browser:</p>
              ${actionUrl ? `<p style="word-break: break-all; color: #f59e0b;">${actionUrl}</p>` : ""}
            </div>
          </div>
        `,
      };

    default:
      return {
        subject: "Notification from Maali",
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <h1>Maali Notification</h1>
            </div>
            <div class="content">
              <p>Dear ${recipientName},</p>
              ${statusMessage ? `<p>${statusMessage}</p>` : "<p>You have a new notification from Maali.</p>"}
              ${actionUrl ? `<a href="${actionUrl}" class="button">View Details</a>` : ""}
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
    // Validate authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { to, type, data }: SendEmailRequest = await req.json();

    if (!to || !type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { subject, html } = getEmailContent(type, data || {});

    // Get configured from email or fall back to default
    const fromEmail = Deno.env.get("FROM_EMAIL") || "Maali <onboarding@resend.dev>";

    const emailResponse = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject,
      html,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in send-email function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);