import { EMAIL_LOGO_PNG_BASE64 } from "./emailLogoBase64.ts";

/** Public site base URL (no trailing slash). */
export function getSiteBaseUrl(): string {
  return (Deno.env.get("SITE_URL") || "https://yourdomain.com").replace(/\/+$/, "");
}

// Gmail and most clients block data: URIs and remote webp. Use a CID inline
// attachment instead — referenced via cid: in the HTML and shipped with the email.
export const EMAIL_LOGO_CID = "maali-logo";

export const EMAIL_LOGO_IMG_HTML =
  `<img src="cid:${EMAIL_LOGO_CID}" alt="Maali Opportunity Hub" width="160" style="max-width:160px;height:auto;display:block;margin:0 auto;" />`;

/** Resend inline attachment for the logo. Add to `attachments` on every email. */
export const EMAIL_LOGO_ATTACHMENT = {
  filename: "maali-logo.png",
  content: EMAIL_LOGO_PNG_BASE64,
  content_id: EMAIL_LOGO_CID,
} as const;

/** External URL fallback (PDF receipts, etc.). */
export function getEmailLogoUrl(siteUrl = getSiteBaseUrl()): string {
  const explicit = Deno.env.get("EMAIL_LOGO_URL");
  if (explicit) return explicit;
  const path = Deno.env.get("EMAIL_LOGO_PATH") || "/images/logo.png";
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
