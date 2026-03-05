import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
// Try importing pdf-lib with explicit target for Deno
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1?target=deno";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

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
}

type ReceiptLocale = "en" | "fr";

interface ReceiptCopy {
  paymentReceipt: string;
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
  notes: string;
  confirmationNote: string;
  keepReceiptNote: string;
  transactionIdLabel: string;
}

const RECEIPT_COPY: Record<ReceiptLocale, ReceiptCopy> = {
  en: {
    paymentReceipt: "PAYMENT RECEIPT",
    billedTo: "BILLED TO",
    receiptDetails: "RECEIPT DETAILS",
    dateLabel: "Date",
    statusLabel: "Status",
    paymentMethodPrefix: "Payment: Card ending in",
    description: "DESCRIPTION",
    qty: "QTY",
    unitPrice: "UNIT PRICE",
    amount: "AMOUNT",
    applicationFee: "Application fee",
    applicationLabel: "Application",
    subtotal: "Subtotal",
    totalPaid: "Total Paid",
    notes: "Notes",
    confirmationNote: "Your application fee has been confirmed and your application is under review.",
    keepReceiptNote: "Please keep this receipt for your records.",
    transactionIdLabel: "Transaction ID",
  },
  fr: {
    paymentReceipt: "RECU DE PAIEMENT",
    billedTo: "FACTURE A",
    receiptDetails: "DETAILS DU RECU",
    dateLabel: "Date",
    statusLabel: "Statut",
    paymentMethodPrefix: "Paiement : Carte se terminant par",
    description: "DESCRIPTION",
    qty: "QTE",
    unitPrice: "PRIX UNITAIRE",
    amount: "MONTANT",
    applicationFee: "Frais de candidature",
    applicationLabel: "Candidature",
    subtotal: "Sous-total",
    totalPaid: "Total paye",
    notes: "Remarques",
    confirmationNote: "Vos frais de candidature ont ete confirmes et votre dossier est en cours d'examen.",
    keepReceiptNote: "Veuillez conserver ce recu pour vos dossiers.",
    transactionIdLabel: "ID de transaction",
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
  };
}

async function tryEmbedLogo(pdfDoc: PDFDocument) {
  const explicitLogoUrl = Deno.env.get("RECEIPT_LOGO_URL");
  const siteUrl = (Deno.env.get("SITE_URL") || "https://maali-opportunity-hub.lovable.app").replace(/\/+$/, "");
  const publicLogoPath = Deno.env.get("RECEIPT_LOGO_PATH") || "/maali-logo.png";
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
  const colors = {
    primary: rgb(ds.primary.r, ds.primary.g, ds.primary.b),
    primaryLight: rgb(ds.primaryLight.r, ds.primaryLight.g, ds.primaryLight.b),
    warning: rgb(ds.warning.r, ds.warning.g, ds.warning.b),
    background: rgb(ds.background.r, ds.background.g, ds.background.b),
    foreground: rgb(ds.foreground.r, ds.foreground.g, ds.foreground.b),
    card: rgb(ds.card.r, ds.card.g, ds.card.b),
    muted: rgb(ds.muted.r, ds.muted.g, ds.muted.b),
    mutedForeground: rgb(ds.mutedForeground.r, ds.mutedForeground.g, ds.mutedForeground.b),
    border: rgb(ds.border.r, ds.border.g, ds.border.b),
    success: rgb(ds.success.r, ds.success.g, ds.success.b),
    white: rgb(1, 1, 1),
  };

  // Header band with primary color (Terra Cotta)
  const headerHeight = 140;
  
  page.drawRectangle({
    x: 0,
    y: pageHeight - headerHeight,
    width: pageWidth,
    height: headerHeight,
    color: colors.primary,
  });

  // Accent stripe at top (Golden Orange warning color)
  page.drawRectangle({
    x: 0,
    y: pageHeight - headerHeight,
    width: pageWidth,
    height: 8,
    color: colors.warning,
  });

  // Logo (optional from RECEIPT_LOGO_URL)
  const logo = await tryEmbedLogo(pdfDoc);
  if (logo) {
    const maxLogoWidth = 120;
    const scale = Math.min(maxLogoWidth / logo.width, 40 / logo.height);
    page.drawImage(logo, {
      x: left,
      y: pageHeight - 100,
      width: logo.width * scale,
      height: logo.height * scale,
    });
  } else {
    page.drawText("MAALI", {
      x: left,
      y: pageHeight - 90,
      size: 20,
      font: boldFont,
      color: colors.white,
    });
  }

  page.drawText(copy.paymentReceipt, {
    x: left,
    y: pageHeight - 115,
    size: 11,
    font,
    color: colors.white,
  });

  page.drawText(data.invoiceNumber, {
    x: right - boldFont.widthOfTextAtSize(data.invoiceNumber, 13),
    y: pageHeight - 88,
    size: 13,
    font: boldFont,
    color: colors.white,
  });

  let y = pageHeight - 170;

  // Meta blocks with card styling (matching shadcn card component)
  const cardPadding = 16; // 16pt = 4 * 4pt (Tailwind spacing)
  // Adjust card height based on whether we have billing email and payment method
  const hasExtraInfo = data.billingEmail || data.paymentMethodLast4;
  const cardHeight = hasExtraInfo ? 100 : 80;
  const cardWidth = 260;
  
  // Left card - Billed To
  page.drawRectangle({
    x: left,
    y: y - cardHeight,
    width: cardWidth,
    height: cardHeight,
    color: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
  });

  // Right card - Receipt Details
  page.drawRectangle({
    x: right - cardWidth,
    y: y - cardHeight,
    width: cardWidth,
    height: cardHeight,
    color: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
  });

  // Billed To section
  page.drawText(copy.billedTo, { 
    x: left + cardPadding, 
    y: y - 20, 
    size: 9, 
    font: boldFont, 
    color: colors.mutedForeground 
  });
  page.drawText(data.userName || "Applicant", { 
    x: left + cardPadding, 
    y: y - 38, 
    size: 12, 
    font: boldFont, 
    color: colors.foreground 
  });

  // Track y position for application ID
  let applicationIdY = y - 56;
  
  // Add billing email if available
  if (data.billingEmail) {
    page.drawText(data.billingEmail, { 
      x: left + cardPadding, 
      y: y - 56, 
      size: 9, 
      font, 
      color: colors.mutedForeground 
    });
    applicationIdY = y - 74; // Adjust for email
  }

  if (data.applicationId) {
    page.drawText(`${copy.applicationLabel}: ${data.applicationId}`, { 
      x: left + cardPadding, 
      y: applicationIdY, 
      size: 9, 
      font, 
      color: colors.mutedForeground 
    });
  }

  // Receipt Details section
  page.drawText(copy.receiptDetails, { 
    x: right - cardWidth + cardPadding, 
    y: y - 20, 
    size: 9, 
    font: boldFont, 
    color: colors.mutedForeground 
  });
  page.drawText(`${copy.dateLabel}: ${data.paymentDate}`, { 
    x: right - cardWidth + cardPadding, 
    y: y - 38, 
    size: 10, 
    font, 
    color: colors.foreground 
  });
  page.drawText(`${copy.statusLabel}: ${data.statusLabel}`, { 
    x: right - cardWidth + cardPadding, 
    y: y - 56, 
    size: 10, 
    font, 
    color: colors.success 
  });

  // Add payment method if available
  if (data.paymentMethodLast4) {
    page.drawText(`${copy.paymentMethodPrefix} ${data.paymentMethodLast4}`, { 
      x: right - cardWidth + cardPadding, 
      y: y - 74, 
      size: 9, 
      font, 
      color: colors.mutedForeground 
    });
  }

  y -= cardHeight + 24; // Add spacing between cards and table

  // Table header with primary color
  const tableX = left;
  const tableWidth = right - left;
  const rowHeight = 32;

  page.drawRectangle({
    x: tableX,
    y: y - rowHeight,
    width: tableWidth,
    height: rowHeight,
    color: colors.primary,
  });

  const colDescription = tableX + cardPadding;
  const colQty = tableX + tableWidth - 200;
  const colUnit = tableX + tableWidth - 140;
  const colAmount = tableX + tableWidth - cardPadding;

  page.drawText(copy.description, { 
    x: colDescription, 
    y: y - 20, 
    size: 9, 
    font: boldFont, 
    color: colors.white 
  });
  page.drawText(copy.qty, { 
    x: colQty, 
    y: y - 20, 
    size: 9, 
    font: boldFont, 
    color: colors.white 
  });
  page.drawText(copy.unitPrice, { 
    x: colUnit, 
    y: y - 20, 
    size: 9, 
    font: boldFont, 
    color: colors.white 
  });
  page.drawText(copy.amount, {
    x: colAmount - boldFont.widthOfTextAtSize(copy.amount, 9),
    y: y - 20,
    size: 9,
    font: boldFont,
    color: colors.white,
  });

  y -= rowHeight;

  // Table body row with card background
  page.drawRectangle({
    x: tableX,
    y: y - rowHeight,
    width: tableWidth,
    height: rowHeight,
    color: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
  });

  const lineItemTitle = data.projectTitle && data.projectTitle !== "N/A"
    ? `${copy.applicationFee} - ${data.projectTitle}`
    : copy.applicationFee;
  const unitPrice = `${data.currency} ${data.amount}`;

  page.drawText(lineItemTitle, {
    x: colDescription,
    y: y - 20,
    size: 10,
    font,
    color: colors.foreground,
    maxWidth: colQty - colDescription - 8,
  });

  page.drawText("1", { 
    x: colQty, 
    y: y - 20, 
    size: 10, 
    font, 
    color: colors.foreground 
  });
  page.drawText(unitPrice, { 
    x: colUnit, 
    y: y - 20, 
    size: 10, 
    font, 
    color: colors.foreground 
  });
  page.drawText(unitPrice, {
    x: colAmount - font.widthOfTextAtSize(unitPrice, 10),
    y: y - 20,
    size: 10,
    font,
    color: colors.foreground,
  });

  y -= rowHeight + 20;

  // Totals box with muted background (matching Tailwind muted color)
  const totalsWidth = 220;
  const totalsX = right - totalsWidth;

  page.drawRectangle({
    x: totalsX,
    y: y - 70,
    width: totalsWidth,
    height: 70,
    color: colors.muted,
    borderColor: colors.border,
    borderWidth: 1,
  });

  page.drawText(copy.subtotal, { 
    x: totalsX + cardPadding, 
    y: y - 24, 
    size: 10, 
    font, 
    color: colors.mutedForeground 
  });
  page.drawText(unitPrice, {
    x: totalsX + totalsWidth - cardPadding - font.widthOfTextAtSize(unitPrice, 10),
    y: y - 24,
    size: 10,
    font,
    color: colors.foreground,
  });

  page.drawText(copy.totalPaid, { 
    x: totalsX + cardPadding, 
    y: y - 48, 
    size: 11, 
    font: boldFont, 
    color: colors.foreground 
  });
  page.drawText(unitPrice, {
    x: totalsX + totalsWidth - cardPadding - boldFont.widthOfTextAtSize(unitPrice, 11),
    y: y - 48,
    size: 11,
    font: boldFont,
    color: colors.primary,
  });

  y -= 90;

  // Notes section
  page.drawText(copy.notes, { 
    x: left, 
    y, 
    size: 11, 
    font: boldFont, 
    color: colors.foreground 
  });
  y -= 18;

  page.drawText(
    copy.confirmationNote,
    { 
      x: left, 
      y, 
      size: 10, 
      font, 
      color: colors.mutedForeground 
    }
  );

  y -= 16;
  page.drawText(copy.keepReceiptNote, {
    x: left,
    y,
    size: 10,
    font,
    color: colors.mutedForeground,
  });

  if (data.transactionId) {
    y -= 20;
    page.drawText(`${copy.transactionIdLabel}: ${data.transactionId}`, {
      x: left,
      y,
      size: 9,
      font,
      color: colors.mutedForeground,
    });
  }

  // Footer with border (matching Tailwind border color)
  page.drawLine({
    start: { x: left, y: 80 },
    end: { x: right, y: 80 },
    thickness: 1,
    color: colors.border,
  });

  page.drawText(`Copyright ${new Date().getFullYear()} Maali Opportunity Hub. All rights reserved.`, {
    x: left,
    y: 64,
    size: 9,
    font,
    color: colors.mutedForeground,
  });

  page.drawText("support@maali.africa", {
    x: right - font.widthOfTextAtSize("support@maali.africa", 9),
    y: 64,
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
