import { supabase } from "@/integrations/supabase/client";

type EmailType = 
  | "application_submitted"
  | "application_approved"
  | "application_rejected"
  | "application_under_review"
  | "status_update"
  | "welcome";

interface EmailData {
  recipientName?: string;
  projectTitle?: string;
  applicationId?: string;
  statusMessage?: string;
  actionUrl?: string;
}

interface SendEmailParams {
  to: string;
  type: EmailType;
  data?: EmailData;
}

/**
 * Send an email using the Resend edge function
 * @param params - Email parameters including recipient, type, and data
 * @returns Promise with the email send result
 */
export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    
    if (!sessionData.session) {
      return { success: false, error: "User not authenticated" };
    }

    const response = await supabase.functions.invoke("send-email", {
      body: params,
    });

    if (response.error) {
      console.error("Email send error:", response.error);
      return { success: false, error: response.error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to send email:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

/**
 * Send application submission confirmation email
 */
export async function sendApplicationSubmittedEmail(
  to: string,
  recipientName: string,
  projectTitle: string,
  applicationId: string,
  dashboardUrl?: string
) {
  return sendEmail({
    to,
    type: "application_submitted",
    data: {
      recipientName,
      projectTitle,
      applicationId,
      actionUrl: dashboardUrl,
    },
  });
}

/**
 * Send application approved email
 */
export async function sendApplicationApprovedEmail(
  to: string,
  recipientName: string,
  projectTitle: string,
  applicationId: string,
  message?: string
) {
  return sendEmail({
    to,
    type: "application_approved",
    data: {
      recipientName,
      projectTitle,
      applicationId,
      statusMessage: message,
    },
  });
}

/**
 * Send application rejected email
 */
export async function sendApplicationRejectedEmail(
  to: string,
  recipientName: string,
  projectTitle: string,
  feedback?: string,
  browseUrl?: string
) {
  return sendEmail({
    to,
    type: "application_rejected",
    data: {
      recipientName,
      projectTitle,
      statusMessage: feedback,
      actionUrl: browseUrl,
    },
  });
}

/**
 * Send application under review email
 */
export async function sendApplicationUnderReviewEmail(
  to: string,
  recipientName: string,
  projectTitle: string,
  applicationId: string,
  trackingUrl?: string
) {
  return sendEmail({
    to,
    type: "application_under_review",
    data: {
      recipientName,
      projectTitle,
      applicationId,
      actionUrl: trackingUrl,
    },
  });
}

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail(
  to: string,
  recipientName: string,
  exploreUrl?: string
) {
  return sendEmail({
    to,
    type: "welcome",
    data: {
      recipientName,
      actionUrl: exploreUrl,
    },
  });
}

/**
 * Send generic status update email
 */
export async function sendStatusUpdateEmail(
  to: string,
  recipientName: string,
  message: string,
  projectTitle?: string,
  applicationId?: string,
  actionUrl?: string
) {
  return sendEmail({
    to,
    type: "status_update",
    data: {
      recipientName,
      projectTitle,
      applicationId,
      statusMessage: message,
      actionUrl,
    },
  });
}
