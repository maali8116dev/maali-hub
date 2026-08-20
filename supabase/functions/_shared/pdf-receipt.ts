import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0?no-dts";
// Try importing pdf-lib with explicit target for Deno
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1?target=deno";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export type ReceiptKind = "application_fee" | "subscription";

export interface ReceiptData {
  userName: string;
  projectTitle: string | null;
  applicationId: string | null;
  amount: string;
  currency: string;
  paymentDate: string;
  statusLabel: string;
  invoiceNumber: string;
  transactionId: string | null;
  billingEmail: string | null;
  paymentMethodLast4: string | null;
  locale?: string | null;
  receiptKind?: ReceiptKind;
}

type ReceiptLocale = "en" | "fr";

interface ReceiptCopy {
  paymentReceipt: string;
  thanksTitle: string;
  hereIsReceipt: string;
  total: string;
  billedTo: string;
  receiptDetails: string;
  dateLabel: string;
  statusLabel: string;
  paymentMethodPrefix: string;
  description: string;
  qty: string;
  unitPrice: string;
  amount: string;
  applicationFee: string;
  applicationLabel: string;
  subtotal: string;
  totalPaid: string;
  payments: string;
  notes: string;
  confirmationNote: string;
  membershipConfirmationNote: string;
  keepReceiptNote: string;
  transactionIdLabel: string;
  membershipLabel: string;
}

const RECEIPT_COPY: Record<ReceiptLocale, ReceiptCopy> = {
  en: {
    paymentReceipt: "Payment Receipt",
    thanksTitle: "Thanks for your payment",
    hereIsReceipt: "Here's your receipt for",
    total: "Total",
    billedTo: "Billed to",
    receiptDetails: "Receipt details",
    dateLabel: "Date",
    statusLabel: "Status",
    paymentMethodPrefix: "Card ending in",
    description: "Description",
    qty: "Qty",
    unitPrice: "Unit price",
    amount: "Amount",
    applicationFee: "Application fee",
    applicationLabel: "Application",
    subtotal: "Subtotal",
    totalPaid: "Total paid",
    payments: "Payments",
    notes: "Notes",
    confirmationNote: "Your application fee has been confirmed and your application is under review.",
    membershipConfirmationNote: "Your Full Membership is active. You can apply to funding opportunities on MAALI.",
    keepReceiptNote: "Please keep this receipt for your records.",
    transactionIdLabel: "Transaction ID",
    membershipLabel: "Full Membership",
  },
  fr: {
    paymentReceipt: "Recu de paiement",
    thanksTitle: "Merci pour votre paiement",
    hereIsReceipt: "Voici votre recu pour",
    total: "Total",
    billedTo: "Facture a",
    receiptDetails: "Details du recu",
    dateLabel: "Date",
    statusLabel: "Statut",
    paymentMethodPrefix: "Carte se terminant par",
    description: "Description",
    qty: "Qte",
    unitPrice: "Prix unitaire",
    amount: "Montant",
    applicationFee: "Frais de candidature",
    applicationLabel: "Candidature",
    subtotal: "Sous-total",
    totalPaid: "Total paye",
    payments: "Paiements",
    notes: "Remarques",
    confirmationNote: "Vos frais de candidature ont ete confirmes et votre dossier est en cours d'examen.",
    membershipConfirmationNote: "Votre adhesion Full Member est active. Vous pouvez postuler aux opportunites sur MAALI.",
    keepReceiptNote: "Veuillez conserver ce recu pour vos dossiers.",
    transactionIdLabel: "ID de transaction",
    membershipLabel: "Full Member",
  },
};

function resolveReceiptLocale(locale?: string | null): ReceiptLocale {
  if (!locale) return "en";
  const normalized = locale.toLowerCase().split("-")[0];
  return normalized === "fr" ? "fr" : "en";
}

/**
 * Convert HSL color (from Tailwind CSS variables) to RGB for pdf-lib
 * @param h Hue (0-360)
 * @param s Saturation (0-100)
 * @param l Lightness (0-100)
 * @returns RGB color object for pdf-lib
 */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  s /= 100;
  l /= 100;
  
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  
  let r = 0, g = 0, b = 0;
  
  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else if (h >= 300 && h < 360) {
    r = c; g = 0; b = x;
  }
  
  return {
    r: Math.round((r + m) * 255) / 255,
    g: Math.round((g + m) * 255) / 255,
    b: Math.round((b + m) * 255) / 255,
  };
}

/**
 * Maali Design System colors extracted from Tailwind CSS variables
 * Matches src/index.css design tokens exactly
 */
function getDesignSystemColors() {
  return {
    // Primary - Terra Cotta / African Earth (hsl(15 75% 45%))
    primary: hslToRgb(15, 75, 45),
    primaryLight: hslToRgb(15, 65, 60),
    primaryDark: hslToRgb(15, 85, 35),
    primaryForeground: hslToRgb(30, 15, 98),
    
    // Warning - Golden Orange (hsl(35 85% 55%))
    warning: hslToRgb(35, 85, 55),
    
    // Background & Text
    background: hslToRgb(30, 15, 98),
    foreground: hslToRgb(25, 25, 15),
    
    // Card & Surfaces
    card: hslToRgb(30, 15, 99),
    cardForeground: hslToRgb(25, 25, 15),
    
    // Muted - Soft Beige
    muted: hslToRgb(35, 20, 92),
    mutedForeground: hslToRgb(25, 15, 45),
    
    // Border
    border: hslToRgb(35, 20, 85),
    
    // Success - Deep Green
    success: hslToRgb(140, 70, 35),
    
    // Accent - Vibrant Green
    accent: hslToRgb(140, 55, 45),
    
    // Destructive / Total (red like Uber receipt)
    destructive: hslToRgb(0, 72, 51),
  };
}

async function tryEmbedLogo(pdfDoc: PDFDocument) {
  const explicitLogoUrl = Deno.env.get("RECEIPT_LOGO_URL");
  const siteUrl = (Deno.env.get("SITE_URL") || "https://maalihub.com").replace(/\/+$/, "");
  const publicLogoPath = Deno.env.get("RECEIPT_LOGO_PATH") || "/images/logo.png";
  const logoUrl = explicitLogoUrl || `${siteUrl}${publicLogoPath.startsWith("/") ? "" : "/"}${publicLogoPath}`;

  if (!logoUrl) return null;

  try {
    const response = await fetch(logoUrl);
    if (!response.ok) return null;

    const bytes = await response.arrayBuffer();
    const lowerUrl = logoUrl.toLowerCase();

    if (lowerUrl.endsWith(".png")) {
      return await pdfDoc.embedPng(bytes);
    }

    if (lowerUrl.endsWith(".jpg") || lowerUrl.endsWith(".jpeg")) {
      return await pdfDoc.embedJpg(bytes);
    }
  } catch (_error) {
    return null;
  }

  return null;
}

/**
 * Generate PDF receipt bytes from receipt data using pdf-lib
 */
export async function generateReceiptPdf(data: ReceiptData): Promise<Uint8Array> {
  try {
    // Verify pdf-lib is loaded
    if (!PDFDocument || !rgb || !StandardFonts) {
      throw new Error("pdf-lib imports are missing or undefined");
    }
    
    const pdfDoc = await PDFDocument.create();
    
    const page = pdfDoc.addPage([595, 842]); // A4 size in points
    
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const copy = RECEIPT_COPY[resolveReceiptLocale(data.locale)];

  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  const left = 48; // Increased from 44 to match Tailwind spacing (12px = 48pt/4)
  const right = pageWidth - 48;
  
  // Get design system colors matching Tailwind CSS variables
  const ds = getDesignSystemColors();
  
  // Convert to pdf-lib rgb format
  const destructiveRgb = rgb(ds.destructive.r, ds.destructive.g, ds.destructive.b);
  const colors = {
    primary: rgb(ds.primary.r, ds.primary.g, ds.primary.b),
    foreground: rgb(ds.foreground.r, ds.foreground.g, ds.foreground.b),
    mutedForeground: rgb(ds.mutedForeground.r, ds.mutedForeground.g, ds.mutedForeground.b),
    border: rgb(ds.border.r, ds.border.g, ds.border.b),
    success: rgb(ds.success.r, ds.success.g, ds.success.b),
  };

  const tableWidth = right - left;
  const unitPrice = `${data.currency} ${data.amount}`;
  const isSubscription = data.receiptKind === "subscription";
  const title = data.projectTitle && data.projectTitle !== "N/A" ? data.projectTitle : null;
  const lineItemTitle = isSubscription
    ? (title ?? copy.membershipLabel)
    : title
      ? `${copy.applicationFee} - ${title}`
      : copy.applicationFee;

  let y = pageHeight - 48;

  // ----- Header: logo left, date right (minimal, no band) -----
  const logo = await tryEmbedLogo(pdfDoc);
  if (logo) {
    const maxLogoW = 100;
    const scale = Math.min(maxLogoW / logo.width, 28 / logo.height);
    page.drawImage(logo, {
      x: left,
      y: y - logo.height * scale,
      width: logo.width * scale,
      height: logo.height * scale,
    });
  } else {
    page.drawText("Maali", {
      x: left,
      y: y - 14,
      size: 18,
      font: boldFont,
      color: colors.foreground,
    });
  }
  page.drawText(data.paymentDate, {
    x: right - font.widthOfTextAtSize(data.paymentDate, 10),
    y: y - 12,
    size: 10,
    font,
    color: colors.mutedForeground,
  });
  y -= 44;

  // ----- Personalized thanks + intro -----
  const thanksText = `${copy.thanksTitle}, ${data.userName || "there"}`;
  page.drawText(thanksText, {
    x: left,
    y,
    size: 16,
    font: boldFont,
    color: colors.foreground,
  });
  y -= 20;
  const introText = isSubscription
    ? `${copy.hereIsReceipt} ${title ?? copy.membershipLabel}.`
    : title
      ? `${copy.hereIsReceipt} ${title}.`
      : `${copy.hereIsReceipt} your application.`;
  page.drawText(introText, {
    x: left,
    y,
    size: 10,
    font,
    color: colors.mutedForeground,
  });
  y -= 28;

  // ----- Total (bold left, amount right in red) -----
  page.drawText(copy.total, {
    x: left,
    y,
    size: 12,
    font: boldFont,
    color: colors.foreground,
  });
  page.drawText(unitPrice, {
    x: right - boldFont.widthOfTextAtSize(unitPrice, 12),
    y,
    size: 12,
    font: boldFont,
    color: destructiveRgb,
  });
  y -= 8;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.5, color: colors.border });
  y -= 20;

  // ----- Itemized: 1 Application fee - Title / amount -----
  page.drawText(`1 ${lineItemTitle}`, {
    x: left,
    y,
    size: 10,
    font,
    color: colors.foreground,
    maxWidth: tableWidth - 80,
  });
  page.drawText(unitPrice, {
    x: right - font.widthOfTextAtSize(unitPrice, 10),
    y,
    size: 10,
    font,
    color: colors.foreground,
  });
  y -= 18;
  page.drawText(copy.subtotal, { x: left, y, size: 10, font, color: colors.mutedForeground });
  page.drawText(unitPrice, {
    x: right - font.widthOfTextAtSize(unitPrice, 10),
    y,
    size: 10,
    font,
    color: colors.foreground,
  });
  y -= 10;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.5, color: colors.border });
  y -= 24;

  // ----- Payments section -----
  page.drawText(copy.payments, {
    x: left,
    y,
    size: 11,
    font: boldFont,
    color: colors.foreground,
  });
  y -= 18;
  const cardLine = data.paymentMethodLast4
    ? `${copy.paymentMethodPrefix} ${data.paymentMethodLast4}`
    : "Payment";
  page.drawText(cardLine, { x: left, y, size: 10, font, color: colors.foreground });
  page.drawText(data.paymentDate, {
    x: right - font.widthOfTextAtSize(data.paymentDate, 9),
    y,
    size: 9,
    font,
    color: colors.mutedForeground,
  });
  y -= 14;
  page.drawText(data.statusLabel, { x: left, y, size: 9, font, color: colors.success });
  page.drawText(unitPrice, {
    x: right - font.widthOfTextAtSize(unitPrice, 10),
    y,
    size: 10,
    font,
    color: colors.foreground,
  });
  y -= 14;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.5, color: colors.border });
  y -= 24;

  // ----- Order / details footer -----
  page.drawText(
    isSubscription
      ? (title ?? copy.membershipLabel)
      : title
        ? `Application fee for ${title}`
        : "Application fee",
    { x: left, y, size: 10, font, color: colors.mutedForeground }
  );
  y -= 16;
  page.drawText(isSubscription ? copy.membershipConfirmationNote : copy.confirmationNote, {
    x: left,
    y,
    size: 9,
    font,
    color: colors.mutedForeground,
    maxWidth: tableWidth,
  });
  y -= 14;
  page.drawText(copy.keepReceiptNote, {
    x: left,
    y,
    size: 9,
    font,
    color: colors.mutedForeground,
  });
  if (data.transactionId) {
    y -= 16;
    page.drawText(`${copy.transactionIdLabel}: ${data.transactionId}`, {
      x: left,
      y,
      size: 9,
      font,
      color: colors.mutedForeground,
    });
  }

  // Footer line + copyright
  page.drawLine({
    start: { x: left, y: 72 },
    end: { x: right, y: 72 },
    thickness: 1,
    color: colors.border,
  });
  page.drawText(`© ${new Date().getFullYear()} Maali Opportunity Hub. All rights reserved.`, {
    x: left,
    y: 56,
    size: 9,
    font,
    color: colors.mutedForeground,
  });
  page.drawText("support@maali.africa", {
    x: right - font.widthOfTextAtSize("support@maali.africa", 9),
    y: 56,
    size: 9,
    font,
    color: colors.mutedForeground,
  });

    const pdfBytes = await pdfDoc.save();
    
    // Verify PDF header (should start with %PDF)
    const pdfHeader = new TextDecoder().decode(pdfBytes.slice(0, 10));
    
    if (!pdfHeader.startsWith("%PDF")) {
      throw new Error(`Invalid PDF format. Header: ${pdfHeader}`);
    }
    
    return pdfBytes;
  } catch (error) {
    // Re-throw to see the actual error in logs
    throw error;
  }
}

/**
 * Store PDF receipt in Supabase Storage and return the public URL
 */
export async function storeReceiptPdf(
  transactionId: string,
  userId: string,
  pdfBytes: Uint8Array
): Promise<string> {
  const fileName = `receipt-${transactionId}.pdf`;
  const filePath = `${userId}/${fileName}`;

  // Upload to receipts bucket
  const { data, error } = await supabaseAdmin.storage
    .from("receipts")
    .upload(filePath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload receipt PDF: ${error.message}`);
  }

  // Get public URL (receipts bucket is private, so we'll use signed URL or public URL)
  // Since bucket is private, we need to generate a signed URL for access
  // For now, return the public URL structure - users will access via RLS policies
  const { data: urlData } = supabaseAdmin.storage
    .from("receipts")
    .getPublicUrl(filePath);

  // Note: Since bucket is private, this URL will only work if user has RLS access
  // For email attachments, we'll fetch it server-side with service role
  return urlData.publicUrl;
}
