import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { getCorsHeaders, escapeHtml } from "../_shared/cors.ts";
import {
  CONTACT_SUBJECT_LABELS,
  getEmailLabels,
  getEmailTypeCopy,
  pickLocale,
  resolveEmailLocale,
  type EmailLocale,
} from "../_shared/email-i18n.ts";
import { EMAIL_LOGO_ATTACHMENT, EMAIL_LOGO_IMG_HTML, getSiteBaseUrl } from "../_shared/emailBrand.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PUBLIC_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const PUBLIC_RATE_LIMIT_MAX_PER_IP = 20;
const PUBLIC_RATE_LIMIT_MAX_PER_EMAIL = 6;
const publicRateLimitStore = new Map<string, number[]>();

function parseClientIP(req: Request): string {
  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    return xForwardedFor.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "unknown";
}

function consumeRateLimit(key: string, maxRequests: number, windowMs: number): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const cutoff = now - windowMs;
  const attempts = (publicRateLimitStore.get(key) || []).filter((ts) => ts > cutoff);

  if (attempts.length >= maxRequests) {
    const retryAfterMs = attempts[0] + windowMs - now;
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  attempts.push(now);
  publicRateLimitStore.set(key, attempts);
  return { allowed: true, retryAfterSec: 0 };
}

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
  | "payment_receipt"
  | "kyc_verified"
  | "kyc_rejected"
  | "partner_invite";

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
    invoicePdfUrl?: string | null;
    // KYC fields
    rejectionReason?: string;
    // Partner invite fields
    partnerOrgName?: string;
    inviteUrl?: string;
    locale?: string;
  };
}

const getEmailContent = (type: EmailType, data: SendEmailRequest["data"]): { subject: string; html: string; attachmentUrl?: string | null } => {
  const locale: EmailLocale = resolveEmailLocale(data.locale);
  const L = getEmailLabels(locale);
  const typeCopy = getEmailTypeCopy(type, locale);
  // M1 FIX: HTML-escape all user-provided data to prevent HTML injection in emails
  const recipientName = escapeHtml(data.recipientName || data.firstName || L.applicant);
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
  const baseUrl = getSiteBaseUrl();
  
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
            ${EMAIL_LOGO_IMG_HTML}
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
        subject: typeCopy.subject({ projectTitle }),
        html: emailTemplate(
          typeCopy.title,
          `
            <p>${L.dear} ${recipientName},</p>
            <p>${pickLocale(locale, {
              en: "Thanks for submitting your application. We want to make sure we have everything we need.",
              fr: "Merci d'avoir soumis votre candidature. Nous voulons nous assurer d'avoir tout ce dont nous avons besoin.",
              pt: "Obrigado por submeter a sua candidatura. Queremos garantir que temos tudo o que precisamos.",
              de: "Vielen Dank für die Einreichung Ihrer Bewerbung. Wir möchten sicherstellen, dass uns alle erforderlichen Informationen vorliegen.",
            })}</p>
            <p>${pickLocale(locale, {
              en: `Your application for <strong>${projectTitle}</strong> has been successfully submitted.`,
              fr: `Votre candidature pour <strong>${projectTitle}</strong> a été soumise avec succès.`,
              pt: `A sua candidatura para <strong>${projectTitle}</strong> foi submetida com sucesso.`,
              de: `Ihre Bewerbung für <strong>${projectTitle}</strong> wurde erfolgreich eingereicht.`,
            })}</p>
            ${buildSummarySection(
              [
                { label: L.project, value: projectTitle },
                { label: L.applicationId, value: applicationId, monospace: true },
                { label: L.status, value: L.submitted },
              ],
              L.applicationSummary
            )}
            <p>${pickLocale(locale, {
              en: "Our team will review your application and get back to you within 5-7 business days.",
              fr: "Notre équipe examinera votre candidature et vous répondra sous 5 à 7 jours ouvrables.",
              pt: "A nossa equipa irá analisar a sua candidatura e responder-lhe em 5 a 7 dias úteis.",
              de: "Unser Team prüft Ihre Bewerbung und meldet sich innerhalb von 5–7 Werktagen bei Ihnen.",
            })}</p>
            ${actionUrl ? `<div style="text-align: center;"><a href="${actionUrl}" class="button" style="color:#ffffff;text-decoration:none;">${L.viewApplicationStatus}</a></div>` : ''}
            <p>${pickLocale(locale, {
              en: "If you have any questions, please don't hesitate to contact us.",
              fr: "Si vous avez des questions, n'hésitez pas à nous contacter.",
              pt: "Se tiver alguma dúvida, não hesite em contactar-nos.",
              de: "Bei Fragen können Sie sich jederzeit an uns wenden.",
            })}</p>
            <p>${L.bestRegards}<br>${L.team}</p>
          `
        ),
        attachmentUrl: null,
      };

    case "application_approved":
      return {
        subject: typeCopy.subject({ projectTitle }),
        html: emailTemplate(
          typeCopy.title,
          `
            <p>${L.dear} ${recipientName},</p>
            <p>We are delighted to inform you that your application for <strong>${projectTitle}</strong> has been <span class="status-badge status-approved">Approved</span>!</p>
            ${buildSummarySection(
              [
                { label: L.project, value: projectTitle },
                { label: L.applicationId, value: applicationId, monospace: true },
                { label: L.status, value: L.approved },
              ],
              L.applicationSummary
            )}
            ${statusMessage ? `<p>${statusMessage}</p>` : '<p>Our team will be in touch shortly with the next steps.</p>'}
            ${actionUrl ? `<div style="text-align: center;"><a href="${actionUrl}" class="button" style="color:#ffffff;text-decoration:none;">${L.viewDetails}</a></div>` : ''}
            <p>Congratulations once again!</p>
            <p>${L.bestRegards}<br>${L.team}</p>
          `
        ),
        attachmentUrl: null,
      };

    case "application_rejected":
      return {
        subject: typeCopy.subject({ projectTitle }),
        html: emailTemplate(
          typeCopy.title,
          `
            <p>${L.dear} ${recipientName},</p>
            <p>Thank you for your interest in <strong>${projectTitle}</strong>.</p>
            <p>After careful consideration, we regret to inform you that your application has not been successful at this time.</p>
            ${buildSummarySection(
              [
                { label: L.project, value: projectTitle },
                { label: L.applicationId, value: applicationId, monospace: true },
                { label: L.status, value: L.rejected },
              ],
              L.applicationSummary
            )}
            ${statusMessage ? `<p><strong>${L.feedback}:</strong> ${statusMessage}</p>` : ''}
            <p>We encourage you to explore other opportunities on our platform and apply again in the future.</p>
            ${actionUrl ? `<div style="text-align: center;"><a href="${actionUrl}" class="button" style="color:#ffffff;text-decoration:none;">${L.browseOpportunities}</a></div>` : ''}
            <p>${L.bestRegards}<br>${L.team}</p>
          `
        ),
        attachmentUrl: null,
      };

    case "application_under_review":
      return {
        subject: typeCopy.subject({ projectTitle }),
        html: emailTemplate(
          typeCopy.title,
          `
            <p>${L.dear} ${recipientName},</p>
            <p>${pickLocale(locale, {
              en: `Your application for <strong>${projectTitle}</strong> is now <span class="status-badge status-review">Under Review</span>.`,
              fr: `Votre candidature pour <strong>${projectTitle}</strong> est <span class="status-badge status-review">en cours d'examen</span>.`,
              pt: `A sua candidatura para <strong>${projectTitle}</strong> está <span class="status-badge status-review">em análise</span>.`,
              de: `Ihre Bewerbung für <strong>${projectTitle}</strong> wird <span class="status-badge status-review">geprüft</span>.`,
            })}</p>
            ${buildSummarySection(
              [
                { label: L.project, value: projectTitle },
                { label: L.applicationId, value: applicationId, monospace: true },
                { label: L.status, value: L.underReview },
              ],
              L.applicationSummary
            )}
            <p>${pickLocale(locale, {
              en: "Our team is carefully evaluating your submission. You will receive an update once a decision has been made.",
              fr: "Notre équipe évalue attentivement votre dossier. Vous recevrez une mise à jour dès qu'une décision sera prise.",
              pt: "A nossa equipa está a avaliar cuidadosamente a sua submissão. Receberá uma atualização assim que houver uma decisão.",
              de: "Unser Team prüft Ihre Einreichung sorgfältig. Sie erhalten eine Benachrichtigung, sobald eine Entscheidung getroffen wurde.",
            })}</p>
            ${actionUrl ? `<div style="text-align: center;"><a href="${actionUrl}" class="button" style="color:#ffffff;text-decoration:none;">${L.trackApplication}</a></div>` : ''}
            <p>${pickLocale(locale, {
              en: "Thank you for your patience.",
              fr: "Merci pour votre patience.",
              pt: "Obrigado pela sua paciência.",
              de: "Vielen Dank für Ihre Geduld.",
            })}</p>
            <p>${L.bestRegards}<br>${L.team}</p>
          `
        ),
        attachmentUrl: null,
      };

    case "status_update":
      return {
        subject: typeCopy.subject({ projectTitle }),
        html: emailTemplate(
          typeCopy.title,
          `
            <p>${L.dear} ${recipientName},</p>
            <p>${pickLocale(locale, {
              en: `There has been an update to your application${projectTitle ? ` for <strong>${projectTitle}</strong>` : ''}.`,
              fr: `Il y a une mise à jour concernant votre candidature${projectTitle ? ` pour <strong>${projectTitle}</strong>` : ''}.`,
              pt: `Há uma atualização na sua candidatura${projectTitle ? ` para <strong>${projectTitle}</strong>` : ''}.`,
              de: `Es gibt ein Update zu Ihrer Bewerbung${projectTitle ? ` für <strong>${projectTitle}</strong>` : ''}.`,
            })}</p>
            ${buildSummarySection(
              [
                { label: L.project, value: projectTitle },
                { label: L.applicationId, value: applicationId, monospace: true },
              ],
              L.applicationSummary
            )}
            ${statusMessage ? `<p>${statusMessage}</p>` : ''}
            ${actionUrl ? `<div style="text-align: center;"><a href="${actionUrl}" class="button" style="color:#ffffff;text-decoration:none;">${L.viewDetails}</a></div>` : ''}
            <p>${L.bestRegards}<br>${L.team}</p>
          `
        ),
        attachmentUrl: null,
      };

    case "welcome":
      return {
        subject: typeCopy.subject({}),
        html: emailTemplate(
          typeCopy.title,
          `
            <p>${L.dear} ${recipientName},</p>
            <p>${pickLocale(locale, {
              en: "Welcome to Maali – your gateway to funding opportunities across Africa!",
              fr: "Bienvenue sur Maali – votre passerelle vers les opportunités de financement en Afrique !",
              pt: "Bem-vindo à Maali – a sua porta de entrada para oportunidades de financiamento em África!",
              de: "Willkommen bei Maali – Ihr Zugang zu Finanzierungsmöglichkeiten in ganz Afrika!",
            })}</p>
            <p>${pickLocale(locale, {
              en: "With your new account, you can:",
              fr: "Avec votre nouveau compte, vous pouvez :",
              pt: "Com a sua nova conta, pode:",
              de: "Mit Ihrem neuen Konto können Sie:",
            })}</p>
            <ul>
              <li>${pickLocale(locale, { en: "Browse funding opportunities tailored to your needs", fr: "Parcourir des opportunités de financement adaptées à vos besoins", pt: "Explorar oportunidades de financiamento adaptadas às suas necessidades", de: "Finanzierungsmöglichkeiten finden, die zu Ihnen passen" })}</li>
              <li>${pickLocale(locale, { en: "Submit applications with ease", fr: "Soumettre des candidatures facilement", pt: "Submeter candidaturas com facilidade", de: "Bewerbungen einfach einreichen" })}</li>
              <li>${pickLocale(locale, { en: "Track your application status in real-time", fr: "Suivre le statut de vos candidatures en temps réel", pt: "Acompanhar o estado das candidaturas em tempo real", de: "Den Status Ihrer Bewerbungen in Echtzeit verfolgen" })}</li>
              <li>${pickLocale(locale, { en: "Receive notifications on new opportunities", fr: "Recevoir des notifications sur les nouvelles opportunités", pt: "Receber notificações sobre novas oportunidades", de: "Benachrichtigungen über neue Opportunities erhalten" })}</li>
            </ul>
            ${actionUrl ? `<div style="text-align: center;"><a href="${actionUrl}" class="button" style="color:#ffffff;text-decoration:none;">${L.exploreOpportunities}</a></div>` : ''}
            <p>${pickLocale(locale, {
              en: "If you have any questions, our support team is here to help.",
              fr: "Si vous avez des questions, notre équipe d'assistance est là pour vous aider.",
              pt: "Se tiver dúvidas, a nossa equipa de apoio está disponível para ajudar.",
              de: "Bei Fragen steht Ihnen unser Support-Team gerne zur Verfügung.",
            })}</p>
            <p>${L.bestRegards}<br>${L.team}</p>
          `
        ),
        attachmentUrl: null,
      };

    case "email_verification":
      return {
        subject: typeCopy.subject({}),
        html: emailTemplate(
          typeCopy.title,
          `
            <p>${pickLocale(locale, {
              en: "Thanks for starting the new Maali account creation process. We want to make sure it's really you. Please click the button below to verify your email address. If you don't want to create an account, you can ignore this message.",
              fr: "Merci d'avoir commencé la création de votre compte Maali. Cliquez sur le bouton ci-dessous pour vérifier votre adresse e-mail. Si vous ne souhaitez pas créer de compte, ignorez ce message.",
              pt: "Obrigado por iniciar a criação da sua conta Maali. Clique no botão abaixo para verificar o seu e-mail. Se não pretende criar uma conta, ignore esta mensagem.",
              de: "Vielen Dank für die Registrierung bei Maali. Bitte klicken Sie auf die Schaltfläche unten, um Ihre E-Mail-Adresse zu bestätigen. Wenn Sie kein Konto erstellen möchten, ignorieren Sie diese Nachricht.",
            })}</p>
            ${actionUrl ? `<div style="text-align: center;"><a href="${actionUrl}" class="button" style="color:#ffffff;text-decoration:none;">${L.verifyEmail}</a></div>` : ''}
            <p>${pickLocale(locale, {
              en: "This verification link will expire in 24 hours.",
              fr: "Ce lien de vérification expirera dans 24 heures.",
              pt: "Este link de verificação expira em 24 horas.",
              de: "Dieser Bestätigungslink läuft in 24 Stunden ab.",
            })}</p>
            <p>${L.bestRegards}<br>${L.team}</p>
          `
        ),
        attachmentUrl: null,
      };

    case "password_reset":
      return {
        subject: typeCopy.subject({}),
        html: emailTemplate(
          typeCopy.title,
          `
            <p>${pickLocale(locale, {
              en: "We received a request to reset your password for your Maali account. We want to make sure it's really you.",
              fr: "Nous avons reçu une demande de réinitialisation du mot de passe de votre compte Maali.",
              pt: "Recebemos um pedido para redefinir a palavra-passe da sua conta Maali.",
              de: "Wir haben eine Anfrage zum Zurücksetzen des Passworts für Ihr Maali-Konto erhalten.",
            })}</p>
            <p>${pickLocale(locale, {
              en: "Click the button below to create a new password. If you didn't request a password reset, you can ignore this message.",
              fr: "Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe. Si vous n'avez pas demandé de réinitialisation, ignorez ce message.",
              pt: "Clique no botão abaixo para criar uma nova palavra-passe. Se não solicitou a redefinição, ignore esta mensagem.",
              de: "Klicken Sie auf die Schaltfläche unten, um ein neues Passwort zu erstellen. Wenn Sie keine Zurücksetzung angefordert haben, ignorieren Sie diese Nachricht.",
            })}</p>
            ${actionUrl ? `<div style="text-align: center;"><a href="${actionUrl}" class="button button-warning" style="color:#ffffff;text-decoration:none;">${L.resetPassword}</a></div>` : ''}
            <p>${pickLocale(locale, {
              en: "This link will expire in 1 hour for security reasons.",
              fr: "Ce lien expirera dans 1 heure pour des raisons de sécurité.",
              pt: "Este link expira em 1 hora por motivos de segurança.",
              de: "Dieser Link läuft aus Sicherheitsgründen in 1 Stunde ab.",
            })}</p>
            <p>${L.bestRegards}<br>${L.team}</p>
          `
        ),
        attachmentUrl: null,
      };

    case "contact_confirmation":
      return {
        subject: typeCopy.subject({}),
        html: emailTemplate(
          typeCopy.title,
          `
            <p>${L.dear} ${firstName || recipientName},</p>
            <p>${pickLocale(locale, {
              en: "Thank you for reaching out to Maali! We have received your message and our team will get back to you within 24 hours.",
              fr: "Merci d'avoir contacté Maali ! Nous avons reçu votre message et notre équipe vous répondra sous 24 heures.",
              pt: "Obrigado por contactar a Maali! Recebemos a sua mensagem e a nossa equipa responderá em 24 horas.",
              de: "Vielen Dank für Ihre Nachricht an Maali! Wir haben Ihre Anfrage erhalten und melden uns innerhalb von 24 Stunden.",
            })}</p>
            <p><strong>${L.yourMessage}:</strong></p>
            <p style="background-color: #f9fafb; padding: 15px; border-radius: 4px; margin: 15px 0;">${message || L.noMessage}</p>
            ${submissionId ? `<p>${L.referenceId}: <strong>${submissionId}</strong></p>` : ''}
            <p>${pickLocale(locale, {
              en: "If you have any urgent questions, please don't hesitate to contact us directly at support@maali.africa.",
              fr: "Pour toute question urgente, contactez-nous directement à support@maali.africa.",
              pt: "Para questões urgentes, contacte-nos diretamente em support@maali.africa.",
              de: "Bei dringenden Fragen erreichen Sie uns unter support@maali.africa.",
            })}</p>
            <p>${L.bestRegards}<br>${L.team}</p>
          `
        ),
        attachmentUrl: null,
      };

    case "payment_receipt": {
      const amount = data.amount ? escapeHtml(data.amount) : "0.00";
      const currency = data.currency ? escapeHtml(data.currency) : "USD";
      const paymentDate = data.paymentDate ? escapeHtml(data.paymentDate) : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const invoiceNum = data.invoiceNumber ? escapeHtml(data.invoiceNumber) : undefined;
      const transactionIdVal = data.transactionId ? escapeHtml(data.transactionId) : undefined;

      const invoicePdfUrl = data.invoicePdfUrl || null;

      return {
        subject: typeCopy.subject({ projectTitle }),
        html: emailTemplate(
          typeCopy.title,
          `
            <p>${L.dear} ${recipientName},</p>
            <p>${pickLocale(locale, {
              en: "Thank you for your payment. Here is your receipt:",
              fr: "Merci pour votre paiement. Voici votre reçu :",
              pt: "Obrigado pelo seu pagamento. Aqui está o seu recibo:",
              de: "Vielen Dank für Ihre Zahlung. Hier ist Ihre Quittung:",
            })}</p>
            ${invoicePdfUrl ? `<p>${L.pdfAttached}</p>` : ''}
            <div style="background-color:#f9fafb;padding:16px 20px;border-radius:6px;margin:20px 0;border:1px solid #e5e7eb;">
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#111827;">
                ${projectTitle ? `
                  <tr>
                    <td style="padding:4px 0;color:#6b7280;">${L.project}</td>
                    <td style="padding:4px 0;text-align:right;font-weight:500;">${projectTitle}</td>
                  </tr>
                ` : ''}
                ${applicationId ? `
                  <tr>
                    <td style="padding:4px 0;color:#6b7280;">${L.applicationId}</td>
                    <td style="padding:4px 0;text-align:right;font-family:monospace;">${applicationId}</td>
                  </tr>
                ` : ''}
                <tr>
                  <td style="padding:4px 0;color:#6b7280;">${L.amount}</td>
                  <td style="padding:4px 0;text-align:right;font-weight:600;">${currency} ${amount}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#6b7280;">${L.date}</td>
                  <td style="padding:4px 0;text-align:right;">${paymentDate}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#6b7280;">${L.status}</td>
                  <td style="padding:4px 0;text-align:right;">
                    <span class="status-badge status-approved">${L.paid}</span>
                  </td>
                </tr>
                ${invoiceNum ? `
                  <tr>
                    <td style="padding:4px 0;color:#6b7280;">${L.invoiceNum}</td>
                    <td style="padding:4px 0;text-align:right;">${invoiceNum}</td>
                  </tr>
                ` : ''}
                ${transactionIdVal ? `
                  <tr>
                    <td style="padding:4px 0;color:#6b7280;">${L.transactionId}</td>
                    <td style="padding:4px 0;text-align:right;font-family:monospace;">${transactionIdVal}</td>
                  </tr>
                ` : ''}
              </table>
            </div>
            <p>${pickLocale(locale, {
              en: "Your application fee has been confirmed and your application is now under review.",
              fr: "Vos frais de candidature ont été confirmés et votre dossier est en cours d'examen.",
              pt: "A taxa de candidatura foi confirmada e a sua candidatura está em análise.",
              de: "Ihre Bewerbungsgebühr wurde bestätigt und Ihre Bewerbung wird nun geprüft.",
            })}</p>
            ${actionUrl ? `<div style="text-align:center;margin:16px 0;"><a href="${actionUrl}" class="button" style="color:#ffffff;text-decoration:none;">${L.viewApplicationStatus}</a></div>` : ''}
            <p>${L.keepRecords} ${L.paymentQuestions}</p>
            <p>${L.bestRegards}<br>${L.team}</p>
          `
        ),
        attachmentUrl: invoicePdfUrl,
      };
    }

    case "contact_submission": {
      const subjectLabels = CONTACT_SUBJECT_LABELS[locale];
      const subjectLabel = subjectLabels[subject || "general"] || subject || subjectLabels.general;

      return {
        subject: typeCopy.subject({ subjectLabel }),
        html: emailTemplate(
          typeCopy.title,
          `
            <p>${pickLocale(locale, {
              en: "A new contact form submission has been received:",
              fr: "Une nouvelle soumission du formulaire de contact a été reçue :",
              pt: "Foi recebida uma nova submissão do formulário de contacto:",
              de: "Eine neue Kontaktformular-Einreichung ist eingegangen:",
            })}</p>
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 4px; margin: 20px 0;">
              <p><strong>${L.name}:</strong> ${firstName || ''} ${lastName || ''}</p>
              <p><strong>${L.email}:</strong> ${email || L.na}</p>
              ${phone ? `<p><strong>${L.phone}:</strong> ${phone}</p>` : ''}
              ${country ? `<p><strong>${L.country}:</strong> ${country}</p>` : ''}
              <p><strong>${L.subject}:</strong> ${subjectLabel}</p>
              <p><strong>${L.message}:</strong></p>
              <p style="white-space: pre-wrap; margin-top: 10px;">${message || L.noMessage}</p>
            </div>
            ${submissionId ? `<p>${L.submissionId}: <strong>${submissionId}</strong></p>` : ''}
            <p>${L.respondWithin24h}</p>
            <p>${L.bestRegards}<br>${L.contactSystem}</p>
          `
        ),
        attachmentUrl: null,
      };
    }

    case "kyc_verified":
      return {
        subject: typeCopy.subject({}),
        html: emailTemplate(
          typeCopy.title,
          `
            <p>${L.dear} ${recipientName},</p>
            <p>${pickLocale(locale, {
              en: 'We are pleased to inform you that your identity verification (KYC) has been <span class="status-badge status-approved">Verified</span>.',
              fr: 'Nous avons le plaisir de vous informer que votre vérification d\'identité (KYC) a été <span class="status-badge status-approved">approuvée</span>.',
              pt: 'Temos o prazer de informar que a sua verificação de identidade (KYC) foi <span class="status-badge status-approved">aprovada</span>.',
              de: 'Wir freuen uns, Ihnen mitteilen zu können, dass Ihre Identitätsprüfung (KYC) <span class="status-badge status-approved">genehmigt</span> wurde.',
            })}</p>
            <p>${pickLocale(locale, {
              en: "Your account is now fully verified and you can access all features of the platform.",
              fr: "Votre compte est entièrement vérifié et vous pouvez accéder à toutes les fonctionnalités.",
              pt: "A sua conta está totalmente verificada e pode aceder a todas as funcionalidades.",
              de: "Ihr Konto ist nun vollständig verifiziert und Sie können alle Funktionen nutzen.",
            })}</p>
            ${actionUrl ? `<div style="text-align: center;"><a href="${actionUrl}" class="button" style="color:#ffffff;text-decoration:none;">${L.goToDashboard}</a></div>` : ''}
            <p>${pickLocale(locale, {
              en: "Thank you for completing the verification process.",
              fr: "Merci d'avoir terminé le processus de vérification.",
              pt: "Obrigado por concluir o processo de verificação.",
              de: "Vielen Dank für den Abschluss des Verifizierungsprozesses.",
            })}</p>
            <p>${L.bestRegards}<br>${L.team}</p>
          `
        ),
        attachmentUrl: null,
      };

    case "kyc_rejected": {
      const rejectionReason = data.rejectionReason ? escapeHtml(data.rejectionReason) : undefined;
      return {
        subject: typeCopy.subject({}),
        html: emailTemplate(
          typeCopy.title,
          `
            <p>${L.dear} ${recipientName},</p>
            <p>${pickLocale(locale, {
              en: 'Unfortunately, your identity verification (KYC) has been <span class="status-badge status-rejected">Rejected</span>.',
              fr: 'Malheureusement, votre vérification d\'identité (KYC) a été <span class="status-badge status-rejected">refusée</span>.',
              pt: 'Infelizmente, a sua verificação de identidade (KYC) foi <span class="status-badge status-rejected">rejeitada</span>.',
              de: 'Leider wurde Ihre Identitätsprüfung (KYC) <span class="status-badge status-rejected">abgelehnt</span>.',
            })}</p>
            ${rejectionReason ? `
              <div style="background-color:#fef2f2;padding:16px 20px;border-radius:6px;margin:20px 0;border:1px solid #fecaca;">
                <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#991b1b;">${L.reasonForRejection}:</p>
                <p style="margin:0;font-size:14px;color:#7f1d1d;">${rejectionReason}</p>
              </div>
            ` : ''}
            <p>${pickLocale(locale, {
              en: "You can update your documents and resubmit your verification at any time.",
              fr: "Vous pouvez mettre à jour vos documents et resoumettre votre vérification à tout moment.",
              pt: "Pode atualizar os seus documentos e reenviar a verificação a qualquer momento.",
              de: "Sie können Ihre Dokumente jederzeit aktualisieren und die Verifizierung erneut einreichen.",
            })}</p>
            ${actionUrl ? `<div style="text-align: center;"><a href="${actionUrl}" class="button" style="color:#ffffff;text-decoration:none;">${L.resubmitVerification}</a></div>` : ''}
            <p>${pickLocale(locale, {
              en: "If you believe this was an error, please contact our support team.",
              fr: "Si vous pensez qu'il s'agit d'une erreur, contactez notre équipe d'assistance.",
              pt: "Se acredita que isto foi um erro, contacte a nossa equipa de apoio.",
              de: "Wenn Sie glauben, dass dies ein Fehler ist, wenden Sie sich an unser Support-Team.",
            })}</p>
            <p>${L.bestRegards}<br>${L.team}</p>
          `
        ),
        attachmentUrl: null,
      };
    }

    case "partner_invite": {
      const partnerOrgName = data.partnerOrgName ? escapeHtml(data.partnerOrgName) : pickLocale(locale, {
        en: "your organization",
        fr: "votre organisation",
        pt: "a sua organização",
        de: "Ihrer Organisation",
      });
      const inviteUrl = data.inviteUrl || data.actionUrl;
      return {
        subject: typeCopy.subject({ partnerOrgName }),
        html: emailTemplate(
          typeCopy.title,
          `
            <p>${L.dear} ${recipientName},</p>
            <p>${pickLocale(locale, {
              en: `You have been invited to manage <strong>${partnerOrgName}</strong> on the Maali Partner Portal.`,
              fr: `Vous avez été invité à gérer <strong>${partnerOrgName}</strong> sur le portail partenaire Maali.`,
              pt: `Foi convidado a gerir <strong>${partnerOrgName}</strong> no portal de parceiros Maali.`,
              de: `Sie wurden eingeladen, <strong>${partnerOrgName}</strong> im Maali-Partnerportal zu verwalten.`,
            })}</p>
            <p>${pickLocale(locale, {
              en: "As a partner, you'll be able to:",
              fr: "En tant que partenaire, vous pourrez :",
              pt: "Como parceiro, poderá:",
              de: "Als Partner können Sie:",
            })}</p>
            <ul>
              <li>${pickLocale(locale, { en: "Post and manage funding opportunities", fr: "Publier et gérer des opportunités de financement", pt: "Publicar e gerir oportunidades de financiamento", de: "Finanzierungsmöglichkeiten veröffentlichen und verwalten" })}</li>
              <li>${pickLocale(locale, { en: "Review and respond to applicants", fr: "Examiner et répondre aux candidats", pt: "Analisar e responder a candidatos", de: "Bewerber prüfen und antworten" })}</li>
              <li>${pickLocale(locale, { en: "Track your organization's impact", fr: "Suivre l'impact de votre organisation", pt: "Acompanhar o impacto da sua organização", de: "Den Impact Ihrer Organisation verfolgen" })}</li>
            </ul>
            <p>${pickLocale(locale, {
              en: "Click the button below to set up your account and get started. This invitation link expires in 24 hours.",
              fr: "Cliquez sur le bouton ci-dessous pour configurer votre compte. Ce lien expire dans 24 heures.",
              pt: "Clique no botão abaixo para configurar a sua conta. Este convite expira em 24 horas.",
              de: "Klicken Sie auf die Schaltfläche unten, um Ihr Konto einzurichten. Dieser Einladungslink läuft in 24 Stunden ab.",
            })}</p>
            ${inviteUrl ? `<div style="text-align: center;"><a href="${inviteUrl}" class="button" style="color:#ffffff;text-decoration:none;">${L.acceptInvitation}</a></div>` : ""}
            <p>${pickLocale(locale, {
              en: "If you weren't expecting this invitation, you can safely ignore this email.",
              fr: "Si vous n'attendiez pas cette invitation, ignorez cet e-mail.",
              pt: "Se não esperava este convite, pode ignorar este e-mail.",
              de: "Wenn Sie diese Einladung nicht erwartet haben, ignorieren Sie diese E-Mail.",
            })}</p>
            <p>${L.bestRegards}<br>${L.team}</p>
          `
        ),
        attachmentUrl: null,
      };
    }

    default:
      return {
        subject: typeCopy.subject({}),
        html: emailTemplate(
          typeCopy.title,
          `
            <p>${L.dear} ${recipientName},</p>
            ${statusMessage ? `<p>${statusMessage}</p>` : `<p>${L.newNotification}</p>`}
            ${actionUrl ? `<div style="text-align: center;"><a href="${actionUrl}" class="button" style="color:#ffffff;text-decoration:none;">${L.viewDetails}</a></div>` : ''}
            <p>${L.bestRegards}<br>${L.team}</p>
          `
        ),
        attachmentUrl: null,
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
    const emailData = data || {};
    
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

      const token = authHeader.replace("Bearer ", "");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      // Allow trusted internal function-to-function calls using service role key.
      const isTrustedInternal = serviceRoleKey && token === serviceRoleKey;

      if (!isTrustedInternal) {
        // Validate as a normal user JWT
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );

        const { data: userData, error: userError } = await supabase.auth.getUser(token);

        if (userError || !userData?.user) {
          console.error("[send-email] User auth failed:", userError?.message);
          return new Response(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
          );
        }
      }
    }

    if (!type) {
      return new Response(
        JSON.stringify({ error: "Missing required field: type" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const senderEmail = typeof emailData.email === "string" ? emailData.email.trim() : "";
    if (isContactEmail && !senderEmail) {
      return new Response(
        JSON.stringify({ error: "Missing required contact sender email" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (isContactEmail && !EMAIL_REGEX.test(senderEmail)) {
      return new Response(
        JSON.stringify({ error: "Invalid sender email format" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    let recipientEmail = typeof to === "string" ? to.trim() : "";
    if (type === "contact_submission") {
      recipientEmail = (Deno.env.get("CONTACT_NOTIFICATION_EMAIL") || Deno.env.get("SUPPORT_EMAIL") || "").trim();
      if (!recipientEmail) {
        return new Response(
          JSON.stringify({ error: "Server misconfiguration: support recipient is not set" }),
          { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
    } else if (type === "contact_confirmation") {
      recipientEmail = senderEmail;
    }

    if (!recipientEmail || !EMAIL_REGEX.test(recipientEmail)) {
      return new Response(
        JSON.stringify({ error: "Invalid recipient email address format" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (isPublicAllowed && isContactEmail) {
      const clientIP = parseClientIP(req);

      const ipLimit = consumeRateLimit(
        `contact:ip:${clientIP}`,
        PUBLIC_RATE_LIMIT_MAX_PER_IP,
        PUBLIC_RATE_LIMIT_WINDOW_MS,
      );
      if (!ipLimit.allowed) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          {
            status: 429,
            headers: {
              ...getCorsHeaders(req),
              "Content-Type": "application/json",
              "Retry-After": String(ipLimit.retryAfterSec),
            },
          }
        );
      }

      const emailLimit = consumeRateLimit(
        `contact:email:${senderEmail.toLowerCase()}`,
        PUBLIC_RATE_LIMIT_MAX_PER_EMAIL,
        PUBLIC_RATE_LIMIT_WINDOW_MS,
      );
      if (!emailLimit.allowed) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          {
            status: 429,
            headers: {
              ...getCorsHeaders(req),
              "Content-Type": "application/json",
              "Retry-After": String(emailLimit.retryAfterSec),
            },
          }
        );
      }
    }

    const emailContent = getEmailContent(type, emailData);
    const { subject, html, attachmentUrl } = emailContent;

    // Get configured from email or fall back to default
    const fromEmail = Deno.env.get("FROM_EMAIL") || "Maali <onboarding@resend.dev>";

    // Prepare email payload
    const emailPayload: any = {
      from: fromEmail,
      to: [recipientEmail],
      subject,
      html,
      attachments: [EMAIL_LOGO_ATTACHMENT],
    };

    // Add PDF attachment if available
    if (attachmentUrl && type === "payment_receipt") {
      try {
        console.log(`[send-email] Attempting to attach PDF from URL: ${attachmentUrl}`);
        
        // Extract file path from URL - handle multiple URL formats
        const urlObj = new URL(attachmentUrl);
        let filePath: string | null = null;
        
        // Pattern 1: /storage/v1/object/public/receipts/userId/file.pdf
        const publicMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/receipts\/(.+)/);
        if (publicMatch) {
          filePath = publicMatch[1];
          console.log(`[send-email] Extracted path from public URL: ${filePath}`);
        } else {
          // Pattern 2: /storage/v1/object/sign/receipts/userId/file.pdf (signed URLs)
          const signedMatch = urlObj.pathname.match(/\/storage\/v1\/object\/sign\/receipts\/(.+)/);
          if (signedMatch) {
            filePath = signedMatch[1].split('?')[0]; // Remove query params
            console.log(`[send-email] Extracted path from signed URL: ${filePath}`);
          } else {
            // Pattern 3: Direct path extraction (fallback)
            const pathParts = urlObj.pathname.split('/receipts/');
            if (pathParts.length > 1) {
              filePath = pathParts[1].split('?')[0]; // Remove query params
              console.log(`[send-email] Extracted path using fallback method: ${filePath}`);
            }
          }
        }
        
        if (!filePath) {
          console.error(`[send-email] Could not extract file path from URL: ${attachmentUrl}`);
          console.error(`[send-email] URL pathname: ${urlObj.pathname}`);
        } else {
          console.log(`[send-email] Downloading PDF from storage, path: ${filePath}`);
          
          // Download PDF from storage using service role (works for private buckets)
          const { data: pdfData, error: downloadError } = await supabaseAdmin.storage
            .from("receipts")
            .download(filePath);

          if (!downloadError && pdfData) {
            const pdfArrayBuffer = await pdfData.arrayBuffer();
            const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfArrayBuffer)));
            
            // Extract filename from path
            const fileName = filePath.split('/').pop() || `receipt-${emailData.transactionId || 'receipt'}.pdf`;
            
            emailPayload.attachments.push({
              filename: fileName,
              content: pdfBase64,
              content_type: "application/pdf",
            });
            
            console.log(`[send-email] PDF attachment added successfully: ${fileName} (${pdfArrayBuffer.byteLength} bytes)`);
          } else {
            console.error(`[send-email] Failed to download PDF from storage`);
            console.error(`[send-email] Path: ${filePath}`);
            console.error(`[send-email] Error:`, downloadError);
            // Log the error but continue without attachment
          }
        }
      } catch (attachErr) {
        console.error("[send-email] Error attaching PDF to email:", attachErr);
        console.error("[send-email] Error details:", attachErr instanceof Error ? attachErr.stack : String(attachErr));
        // Continue without attachment - don't fail the email
      }
    }

    const emailResponse = await resend.emails.send(emailPayload);

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
