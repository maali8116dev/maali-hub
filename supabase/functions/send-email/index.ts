import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { getCorsHeaders, escapeHtml } from "../_shared/cors.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

type EmailType = 
  | "application_submitted"
  | "application_approved"
  | "application_rejected"
  | "application_under_review"
  | "status_update"
  | "welcome"
  | "email_verification"
  | "password_reset"
  | "contact_submission"
  | "contact_confirmation"
  | "payment_receipt";

interface SendEmailRequest {
  to: string;
  type: EmailType;
  allowPublic?: boolean;
  data: {
    recipientName?: string;
    projectTitle?: string;
    applicationId?: string;
    statusMessage?: string;
    actionUrl?: string;
    // Contact form specific fields
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    country?: string;
    subject?: string;
    message?: string;
    submissionId?: string;
    // Payment receipt fields
    amount?: string;
    currency?: string;
    paymentDate?: string;
    invoiceNumber?: string;
    transactionId?: string;
  };
}

const getEmailContent = (type: EmailType, data: SendEmailRequest["data"]) => {
  // M1 FIX: HTML-escape all user-provided data to prevent HTML injection in emails
  const recipientName = escapeHtml(data.recipientName || data.firstName || "Applicant");
  const projectTitle = data.projectTitle ? escapeHtml(data.projectTitle) : undefined;
  const applicationId = data.applicationId ? escapeHtml(data.applicationId) : undefined;
  const statusMessage = data.statusMessage ? escapeHtml(data.statusMessage) : undefined;
  const actionUrl = data.actionUrl; // URLs are used in href attributes, not HTML-escaped
  
  // Contact form fields (HTML-escaped)
  const firstName = data.firstName ? escapeHtml(data.firstName) : undefined;
  const lastName = data.lastName ? escapeHtml(data.lastName) : undefined;
  const email = data.email ? escapeHtml(data.email) : undefined;
  const phone = data.phone ? escapeHtml(data.phone) : undefined;
  const country = data.country ? escapeHtml(data.country) : undefined;
  const subject = data.subject ? escapeHtml(data.subject) : undefined;
  const message = data.message ? escapeHtml(data.message) : undefined;
  const submissionId = data.submissionId ? escapeHtml(data.submissionId) : undefined;
  
  // Base URL for logo and links
  const baseUrl = Deno.env.get("SITE_URL") || "https://yourdomain.com";
  const logoUrl = `${baseUrl}/static/maali-logo.png`; // Update with your actual logo path
  
  // Primary gradient colors (Terra Cotta to Golden Orange)
  // hsl(15 75% 45%) = #C85A2E, hsl(35 85% 55%) = #F5A623
  const primaryGradient = "linear-gradient(135deg, #C85A2E 0%, #F5A623 100%)";
  
  // AWS-style email template helper
  const emailTemplate = (title: string, content: string, verificationCode?: string) => `
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
          -webkit-text-size-adjust: 100%;
          -ms-text-size-adjust: 100%;
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
          display: block;
          margin: 0 auto;
        }
        .content {
          padding: 25px 35px;
        }
        .content h1 {
          color: #333;
          font-size: 20px;
          font-weight: bold;
          margin: 0 0 15px 0;
          line-height: 1.4;
        }
        .content p {
          color: #333;
          font-size: 14px;
          line-height: 24px;
          margin: 6px 0 14px 0;
        }
        .verification-section {
          text-align: center;
          margin: 20px 0;
        }
        .verification-label {
          color: #333;
          font-size: 14px;
          font-weight: bold;
          margin: 0;
        }
        .verification-code {
          color: #333;
          font-size: 36px;
          font-weight: bold;
          margin: 10px 0;
          word-break: break-all;
        }
        .verification-expiry {
          color: #333;
          font-size: 14px;
          margin: 0;
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
          text-align: center;
        }
        .button:hover {
          opacity: 0.9;
        }
        .button-warning {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
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
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 9999px;
          font-size: 14px;
          font-weight: 500;
        }
        .status-approved {
          background-color: #dcfce7;
          color: #166534;
        }
        .status-rejected {
          background-color: #fee2e2;
          color: #991b1b;
        }
        .status-review {
          background-color: #fef3c7;
          color: #92400e;
        }
        ul {
          color: #333;
          font-size: 14px;
          line-height: 24px;
          margin: 6px 0 14px 0;
          padding-left: 20px;
        }
        table {
          border-collapse: collapse;
          width: 100%;
        }
        /* Mobile Responsive Styles */
        @media only screen and (max-width: 600px) {
          .container {
            padding: 10px !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .email-section {
            width: 100% !important;
          }
          .header {
            padding: 15px 10px !important;
          }
          .header img {
            max-width: 60px !important;
          }
          .content {
            padding: 20px 15px !important;
          }
          .content h1 {
            font-size: 18px !important;
            margin: 0 0 12px 0 !important;
          }
          .content p {
            font-size: 14px !important;
            line-height: 22px !important;
            margin: 5px 0 12px 0 !important;
          }
          .verification-code {
            font-size: 28px !important;
          }
          .button {
            display: block !important;
            width: 100% !important;
            padding: 14px 20px !important;
            margin: 15px 0 !important;
            box-sizing: border-box;
          }
          .footer {
            padding: 20px 15px !important;
          }
          .footer p {
            font-size: 13px !important;
          }
          .footer-links {
            font-size: 11px !important;
            padding: 0 15px !important;
            margin: 20px 0 !important;
          }
          .footer-links a {
            font-size: 13px !important;
          }
          ul {
            font-size: 14px !important;
            padding-left: 18px !important;
          }
        }
        /* Additional mobile optimizations for small screens */
        @media only screen and (max-width: 480px) {
          .container {
            padding: 5px !important;
          }
          .header {
            padding: 12px 8px !important;
          }
          .header img {
            max-width: 50px !important;
          }
          .content {
            padding: 15px 12px !important;
          }
          .content h1 {
            font-size: 16px !important;
          }
          .verification-code {
            font-size: 24px !important;
          }
          .button {
            padding: 12px 16px !important;
            font-size: 13px !important;
          }
        }
        /* Mobile styles for summary sections - values stack under labels */
        @media only screen and (max-width: 600px) {
          .summary-section {
            padding: 12px 15px !important;
            margin: 15px 0 !important;
          }
          .summary-table {
            font-size: 13px !important;
            width: 100% !important;
          }
          .summary-row {
            display: block !important;
            width: 100% !important;
          }
          .summary-label {
            display: block !important;
            width: 100% !important;
            padding: 8px 0 4px 0 !important;
            text-align: left !important;
            font-weight: 600 !important;
            font-size: 12px !important;
            color: #6b7280 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.5px !important;
          }
          .summary-value {
            display: block !important;
            width: 100% !important;
            padding: 0 0 12px 0 !important;
            text-align: left !important;
            font-size: 14px !important;
            color: #111827 !important;
            font-weight: 500 !important;
            border-bottom: 1px solid #e5e7eb !important;
          }
          .summary-row:last-child .summary-value {
            border-bottom: none !important;
            padding-bottom: 0 !important;
          }
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
            ${verificationCode ? `
              <div class="verification-section">
                <p class="verification-label">Verification code</p>
                <p class="verification-code">${verificationCode}</p>
                <p class="verification-expiry">(This code is valid for 10 minutes)</p>
              </div>
            ` : ''}
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

  // Reusable summary section for application-related emails
  const buildSummarySection = (
    rows: { label: string; value?: string; monospace?: boolean }[],
    sectionTitle?: string
  ) => {
    const visibleRows = rows.filter((row) => row.value);
    if (visibleRows.length === 0) return "";

    return `
      <div class="summary-section" style="background-color:#f9fafb;padding:16px 20px;border-radius:6px;margin:20px 0;border:1px solid #e5e7eb;">
        ${sectionTitle ? `<p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#374151;">${sectionTitle}</p>` : ""}
        <!--[if mso]>
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#111827;">
          ${visibleRows
            .map(
              (row) => `
                <tr>
                  <td style="padding:8px 0;color:#6b7280;width:40%;">${row.label}</td>
                  <td style="padding:8px 0;text-align:right;${row.monospace ? "font-family:monospace;" : ""}word-break:break-word;">${row.value}</td>
                </tr>
              `
            )
            .join("")}
        </table>
        <![endif]-->
        <!--[if !mso]><!-- -->
        <table width="100%" cellpadding="0" cellspacing="0" class="summary-table" style="font-size:14px;color:#111827;width:100%;border-collapse:collapse;">
          ${visibleRows
            .map(
              (row, index) => `
                <tr class="summary-row">
                  <td colspan="2" class="summary-label" style="padding:${index === 0 ? '0' : '12px'} 0 4px 0;color:#6b7280;word-break:break-word;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;width:100%;">${row.label}</td>
                </tr>
                <tr class="summary-row">
                  <td colspan="2" class="summary-value" style="padding:0 0 12px 0;${row.monospace ? "font-family:monospace;" : ""}word-break:break-word;font-size:14px;color:#111827;font-weight:500;border-bottom:1px solid #e5e7eb;width:100%;">${row.value}</td>
                </tr>
              `
            )
            .join("")}
        </table>
        <!--<![endif]-->
      </div>
    `;
  };

  switch (type) {
    case "application_submitted":
      return {
        subject: `Application Submitted - ${projectTitle || "Maali"}`,
        html: emailTemplate(
          "Application Submitted",
          `
            <p>Dear ${recipientName},</p>
            <p>Thanks for submitting your application. We want to make sure we have everything we need.</p>
            <p>Your application for <strong>${projectTitle}</strong> has been successfully submitted.</p>
            ${buildSummarySection(
              [
                { label: "Project", value: projectTitle },
                { label: "Application ID", value: applicationId, monospace: true },
                { label: "Status", value: "Submitted" },
              ],
              "Application summary"
            )}
            <p>Our team will review your application and get back to you within 5-7 business days.</p>
            ${actionUrl ? `<div style="text-align: center;"><a href="${actionUrl}" class="button" style="color:#ffffff;text-decoration:none;">View Application Status</a></div>` : ''}
            <p>If you have any questions, please don't hesitate to contact us.</p>
            <p>Best regards,<br>The Maali Team</p>
          `
        ),
      };

    case "application_approved":
      return {
        subject: `Congratulations! Your Application Has Been Approved - ${projectTitle}`,
        html: emailTemplate(
          "Application Approved",
          `
            <p>Dear ${recipientName},</p>
            <p>We are delighted to inform you that your application for <strong>${projectTitle}</strong> has been <span class="status-badge status-approved">Approved</span>!</p>
            ${buildSummarySection(
              [
                { label: "Project", value: projectTitle },
                { label: "Application ID", value: applicationId, monospace: true },
                { label: "Status", value: "Approved" },
              ],
              "Application summary"
            )}
            ${statusMessage ? `<p>${statusMessage}</p>` : '<p>Our team will be in touch shortly with the next steps.</p>'}
            ${actionUrl ? `<div style="text-align: center;"><a href="${actionUrl}" class="button" style="color:#ffffff;text-decoration:none;">View Details</a></div>` : ''}
            <p>Congratulations once again!</p>
            <p>Best regards,<br>The Maali Team</p>
          `
        ),
      };

    case "application_rejected":
      return {
        subject: `Application Update - ${projectTitle}`,
        html: emailTemplate(
          "Application Update",
          `
            <p>Dear ${recipientName},</p>
            <p>Thank you for your interest in <strong>${projectTitle}</strong>.</p>
            <p>After careful consideration, we regret to inform you that your application has not been successful at this time.</p>
            ${buildSummarySection(
              [
                { label: "Project", value: projectTitle },
                { label: "Application ID", value: applicationId, monospace: true },
                { label: "Status", value: "Rejected" },
              ],
              "Application summary"
            )}
            ${statusMessage ? `<p><strong>Feedback:</strong> ${statusMessage}</p>` : ''}
            <p>We encourage you to explore other opportunities on our platform and apply again in the future.</p>
            ${actionUrl ? `<div style="text-align: center;"><a href="${actionUrl}" class="button" style="color:#ffffff;text-decoration:none;">Browse Opportunities</a></div>` : ''}
            <p>Best regards,<br>The Maali Team</p>
          `
        ),
      };

    case "application_under_review":
      return {
        subject: `Your Application is Under Review - ${projectTitle}`,
        html: emailTemplate(
          "Application Under Review",
          `
            <p>Dear ${recipientName},</p>
            <p>Your application for <strong>${projectTitle}</strong> is now <span class="status-badge status-review">Under Review</span>.</p>
            ${buildSummarySection(
              [
                { label: "Project", value: projectTitle },
                { label: "Application ID", value: applicationId, monospace: true },
                { label: "Status", value: "Under review" },
              ],
              "Application summary"
            )}
            <p>Our team is carefully evaluating your submission. You will receive an update once a decision has been made.</p>
            ${actionUrl ? `<div style="text-align: center;"><a href="${actionUrl}" class="button" style="color:#ffffff;text-decoration:none;">Track Application</a></div>` : ''}
            <p>Thank you for your patience.</p>
            <p>Best regards,<br>The Maali Team</p>
          `
        ),
      };

    case "status_update":
      return {
        subject: `Application Status Update - ${projectTitle || "Maali"}`,
        html: emailTemplate(
          "Status Update",
          `
            <p>Dear ${recipientName},</p>
            <p>There has been an update to your application${projectTitle ? ` for <strong>${projectTitle}</strong>` : ''}.</p>
            ${buildSummarySection(
              [
                { label: "Project", value: projectTitle },
                { label: "Application ID", value: applicationId, monospace: true },
              ],
              "Application summary"
            )}
            ${statusMessage ? `<p>${statusMessage}</p>` : ''}
            ${actionUrl ? `<div style="text-align: center;"><a href="${actionUrl}" class="button" style="color:#ffffff;text-decoration:none;">View Details</a></div>` : ''}
            <p>Best regards,<br>The Maali Team</p>
          `
        ),
      };

    case "welcome":
      return {
        subject: "Welcome to Maali! 🌱",
        html: emailTemplate(
          "Welcome to Maali",
          `
            <p>Dear ${recipientName},</p>
            <p>Welcome to Maali – your gateway to funding opportunities across Africa!</p>
            <p>With your new account, you can:</p>
            <ul>
              <li>Browse funding opportunities tailored to your needs</li>
              <li>Submit applications with ease</li>
              <li>Track your application status in real-time</li>
              <li>Receive notifications on new opportunities</li>
            </ul>
            ${actionUrl ? `<div style="text-align: center;"><a href="${actionUrl}" class="button" style="color:#ffffff;text-decoration:none;">Explore Opportunities</a></div>` : ''}
            <p>If you have any questions, our support team is here to help.</p>
            <p>Best regards,<br>The Maali Team</p>
          `
        ),
      };

    case "email_verification":
      return {
        subject: "Verify Your Email - Maali",
        html: emailTemplate(
          "Verify your email address",
          `
            <p>Thanks for starting the new Maali account creation process. We want to make sure it's really you. Please click the button below to verify your email address. If you don't want to create an account, you can ignore this message.</p>
            ${actionUrl ? `<div style="text-align: center;"><a href="${actionUrl}" class="button" style="color:#ffffff;text-decoration:none;">Verify Email Address</a></div>` : ''}
            <p>This verification link will expire in 24 hours.</p>
            <p>Best regards,<br>The Maali Team</p>
          `
        ),
      };

    case "password_reset":
      return {
        subject: "Reset Your Password - Maali",
        html: emailTemplate(
          "Reset your password",
          `
            <p>We received a request to reset your password for your Maali account. We want to make sure it's really you.</p>
            <p>Click the button below to create a new password. If you didn't request a password reset, you can ignore this message.</p>
            ${actionUrl ? `<div style="text-align: center;"><a href="${actionUrl}" class="button button-warning" style="color:#ffffff;text-decoration:none;">Reset Password</a></div>` : ''}
            <p>This link will expire in 1 hour for security reasons.</p>
            <p>Best regards,<br>The Maali Team</p>
          `
        ),
      };

    case "contact_confirmation":
      return {
        subject: "Thank You for Contacting Maali",
        html: emailTemplate(
          "Message Received",
          `
            <p>Dear ${firstName || recipientName},</p>
            <p>Thank you for reaching out to Maali! We have received your message and our team will get back to you within 24 hours.</p>
            <p><strong>Your Message:</strong></p>
            <p style="background-color: #f9fafb; padding: 15px; border-radius: 4px; margin: 15px 0;">${message || 'No message provided'}</p>
            ${submissionId ? `<p>Reference ID: <strong>${submissionId}</strong></p>` : ''}
            <p>If you have any urgent questions, please don't hesitate to contact us directly at support@maali.africa.</p>
            <p>Best regards,<br>The Maali Team</p>
          `
        ),
      };

    case "payment_receipt": {
      const amount = data.amount ? escapeHtml(data.amount) : "0.00";
      const currency = data.currency ? escapeHtml(data.currency) : "USD";
      const paymentDate = data.paymentDate ? escapeHtml(data.paymentDate) : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const invoiceNum = data.invoiceNumber ? escapeHtml(data.invoiceNumber) : undefined;
      const transactionIdVal = data.transactionId ? escapeHtml(data.transactionId) : undefined;

      return {
        subject: `Payment Receipt - ${projectTitle || "Maali"}`,
        html: emailTemplate(
          "Payment Receipt",
          `
            <p>Dear ${recipientName},</p>
            <p>Thank you for your payment. Here is your receipt:</p>
            <div style="background-color:#f9fafb;padding:16px 20px;border-radius:6px;margin:20px 0;border:1px solid #e5e7eb;">
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#111827;">
                ${projectTitle ? `
                  <tr>
                    <td style="padding:4px 0;color:#6b7280;">Project</td>
                    <td style="padding:4px 0;text-align:right;font-weight:500;">${projectTitle}</td>
                  </tr>
                ` : ''}
                ${applicationId ? `
                  <tr>
                    <td style="padding:4px 0;color:#6b7280;">Application ID</td>
                    <td style="padding:4px 0;text-align:right;font-family:monospace;">${applicationId}</td>
                  </tr>
                ` : ''}
                <tr>
                  <td style="padding:4px 0;color:#6b7280;">Amount</td>
                  <td style="padding:4px 0;text-align:right;font-weight:600;">${currency} ${amount}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#6b7280;">Date</td>
                  <td style="padding:4px 0;text-align:right;">${paymentDate}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#6b7280;">Status</td>
                  <td style="padding:4px 0;text-align:right;">
                    <span class="status-badge status-approved">Paid</span>
                  </td>
                </tr>
                ${invoiceNum ? `
                  <tr>
                    <td style="padding:4px 0;color:#6b7280;">Invoice #</td>
                    <td style="padding:4px 0;text-align:right;">${invoiceNum}</td>
                  </tr>
                ` : ''}
                ${transactionIdVal ? `
                  <tr>
                    <td style="padding:4px 0;color:#6b7280;">Transaction ID</td>
                    <td style="padding:4px 0;text-align:right;font-family:monospace;">${transactionIdVal}</td>
                  </tr>
                ` : ''}
              </table>
            </div>
            <p>Your application fee has been confirmed and your application is now under review.</p>
            ${actionUrl ? `<div style="text-align:center;margin:16px 0;"><a href="${actionUrl}" class="button" style="color:#ffffff;text-decoration:none;">View Application</a></div>` : ''}
            <p>Please keep this email for your records. If you have any questions about this payment, please contact our support team.</p>
            <p>Best regards,<br>The Maali Team</p>
          `
        ),
      };
    }

    case "contact_submission": {
      const subjectLabels: Record<string, string> = {
        funding: "Funding Inquiry",
        application: "Application Support",
        partnership: "Partnership",
        technical: "Technical Support",
        general: "General Inquiry"
      };
      const subjectLabel = subjectLabels[subject || 'general'] || subject || 'General Inquiry';
      
      return {
        subject: `New Contact Form Submission: ${subjectLabel}`,
        html: emailTemplate(
          "New Contact Form Submission",
          `
            <p>A new contact form submission has been received:</p>
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 4px; margin: 20px 0;">
              <p><strong>Name:</strong> ${firstName || ''} ${lastName || ''}</p>
              <p><strong>Email:</strong> ${email || 'N/A'}</p>
              ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
              ${country ? `<p><strong>Country:</strong> ${country}</p>` : ''}
              <p><strong>Subject:</strong> ${subjectLabel}</p>
              <p><strong>Message:</strong></p>
              <p style="white-space: pre-wrap; margin-top: 10px;">${message || 'No message provided'}</p>
            </div>
            ${submissionId ? `<p>Submission ID: <strong>${submissionId}</strong></p>` : ''}
            <p>Please respond to this inquiry within 24 hours.</p>
            <p>Best regards,<br>Maali Contact System</p>
          `
        ),
      };
    }

    default:
      return {
        subject: "Notification from Maali",
        html: emailTemplate(
          "Maali Notification",
          `
            <p>Dear ${recipientName},</p>
            ${statusMessage ? `<p>${statusMessage}</p>` : '<p>You have a new notification from Maali.</p>'}
            ${actionUrl ? `<div style="text-align: center;"><a href="${actionUrl}" class="button" style="color:#ffffff;text-decoration:none;">View Details</a></div>` : ''}
            <p>Best regards,<br>The Maali Team</p>
          `
        ),
      };
  }
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const { to, type, data, allowPublic }: SendEmailRequest & { allowPublic?: boolean } = await req.json();
    
    // Determine request context
    const internalSecret = Deno.env.get("INTERNAL_EMAIL_SECRET");
    const internalHeader = req.headers.get("X-Internal-Secret");
    const isInternal = internalSecret && internalHeader === internalSecret;

    // Allow certain emails without user JWT:
    // - Contact emails (public site forms) when allowPublic is true
    // - Payment receipts only from internal callers that know INTERNAL_EMAIL_SECRET
    const isContactEmail = type === "contact_confirmation" || type === "contact_submission";
    const isPaymentReceipt = type === "payment_receipt";
    const isPublicAllowed =
      (allowPublic === true && isContactEmail) ||
      (allowPublic === true && isPaymentReceipt && Boolean(isInternal));
    
    if (!isPublicAllowed) {
      // Validate authorization for non-contact emails
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
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
          { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
    }

    if (!to || !type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, type" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Validate and sanitize email address
    const sanitizedEmail = typeof to === 'string' ? to.trim() : '';
    
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitizedEmail)) {
      return new Response(
        JSON.stringify({ error: "Invalid email address format" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const { subject, html } = getEmailContent(type, data || {});

    // Get configured from email or fall back to default
    const fromEmail = Deno.env.get("FROM_EMAIL") || "Maali <onboarding@resend.dev>";

    const emailResponse = await resend.emails.send({
      from: fromEmail,
      to: [sanitizedEmail], // Use sanitized email
      subject,
      html,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in send-email function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
};

serve(handler);