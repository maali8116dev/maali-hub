import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";
import { getCorsHeaders } from "../_shared/cors.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    // Authenticate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Get transaction ID from query params
    const url = new URL(req.url);
    const transactionId = url.searchParams.get("transactionId");

    if (!transactionId) {
      return new Response(JSON.stringify({ error: "transactionId required" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Fetch transaction
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    const isAdmin = profile?.role === "admin";

    let query = supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("id", transactionId);

    if (!isAdmin) {
      query = query.eq("user_id", user.id);
    }

    const { data: tx, error: txError } = await query.maybeSingle();

    if (txError || !tx) {
      return new Response(JSON.stringify({ error: "Transaction not found" }), {
        status: 404,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Get user profile
    const { data: userProfile } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name")
      .eq("user_id", tx.user_id)
      .maybeSingle();

    const userName = userProfile
      ? `${userProfile.first_name || ""} ${userProfile.last_name || ""}`.trim() || "N/A"
      : "N/A";

    // Get project title if available
    let projectTitle = "";
    if (tx.project_id) {
      const { data: project } = await supabaseAdmin
        .from("projects")
        .select("title")
        .eq("id", tx.project_id)
        .maybeSingle();
      projectTitle = project?.title || "";
    }

    // Format values
    const amount = parseFloat(tx.amount).toFixed(2);
    const currency = (tx.currency || "USD").toUpperCase();
    const invoiceNumber = tx.invoice_number || `TXN-${tx.id.substring(0, 8).toUpperCase()}`;
    const paymentDate = new Date(tx.completed_at || tx.created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const statusLabel = tx.status === "completed" ? "Paid" : tx.status.charAt(0).toUpperCase() + tx.status.slice(1);
    const billingEmail = tx.billing_email || user.email || "N/A";

    // ─── Build PDF ───────────────────────────────────────────────────
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;

    // ── Header bar ──
    doc.setFillColor(200, 90, 46); // #C85A2E
    doc.rect(0, 0, pageWidth, 38, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("INVOICE", margin, 18);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(invoiceNumber, margin, 28);

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("MAALI", pageWidth - margin, 18, { align: "right" });

    // ── Meta section ──
    let y = 52;
    doc.setTextColor(107, 114, 128); // #6b7280
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("BILLED TO", margin, y);
    doc.text("PAYMENT DATE", margin + 70, y);
    doc.text("STATUS", margin + 130, y);

    y += 6;
    doc.setTextColor(31, 41, 55); // #1f2937
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(userName, margin, y);

    doc.setFont("helvetica", "normal");
    doc.text(paymentDate, margin + 70, y);

    // Status badge
    const statusBadgeX = margin + 130;
    if (tx.status === "completed") {
      doc.setFillColor(220, 252, 231); // green bg
      doc.setTextColor(22, 101, 52);   // green text
    } else if (tx.status === "refunded") {
      doc.setFillColor(254, 243, 199);
      doc.setTextColor(146, 64, 14);
    } else {
      doc.setFillColor(254, 226, 226);
      doc.setTextColor(153, 27, 27);
    }
    const badgeWidth = doc.getTextWidth(statusLabel) + 8;
    doc.roundedRect(statusBadgeX, y - 4, badgeWidth, 6, 2, 2, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(statusLabel, statusBadgeX + 4, y);

    // Billing email
    y += 6;
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(billingEmail, margin, y);

    // ── Line items table ──
    y += 14;
    // Table header
    doc.setFillColor(249, 250, 251); // #f9fafb
    doc.rect(margin, y - 5, contentWidth, 10, "F");
    doc.setDrawColor(229, 231, 235); // #e5e7eb
    doc.line(margin, y + 5, margin + contentWidth, y + 5);

    doc.setTextColor(107, 114, 128);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("DESCRIPTION", margin + 4, y + 1);
    doc.text("PROJECT", margin + 90, y + 1);
    doc.text("AMOUNT", margin + contentWidth - 4, y + 1, { align: "right" });

    // Table row
    y += 14;
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(tx.description || "Application Fee", margin + 4, y);
    doc.text(projectTitle || "—", margin + 90, y);
    doc.text(`${currency} ${amount}`, margin + contentWidth - 4, y, { align: "right" });

    // Separator
    y += 6;
    doc.setDrawColor(243, 244, 246);
    doc.line(margin, y, margin + contentWidth, y);

    // Total row
    y += 10;
    doc.setFillColor(249, 250, 251);
    doc.rect(margin, y - 5, contentWidth, 12, "F");
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Total", margin + 90, y + 1);
    doc.text(`${currency} ${amount}`, margin + contentWidth - 4, y + 1, { align: "right" });

    // ── Transaction details ──
    y += 18;
    doc.setTextColor(156, 163, 175); // #9ca3af
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    if (tx.provider_transaction_id) {
      doc.text(`Transaction ID: ${tx.provider_transaction_id}`, margin, y);
      y += 5;
    }
    if (tx.application_id) {
      doc.text(`Application ID: ${tx.application_id}`, margin, y);
      y += 5;
    }

    // ── Footer ──
    const footerY = doc.internal.pageSize.getHeight() - 20;
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, footerY - 6, margin + contentWidth, footerY - 6);
    doc.setTextColor(156, 163, 175);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      `© ${new Date().getFullYear()} Maali Opportunity Hub. All rights reserved.`,
      pageWidth / 2,
      footerY,
      { align: "center" }
    );

    // ── Output ──
    const pdfBuffer = doc.output("arraybuffer");

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        ...getCorsHeaders(req),
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${invoiceNumber}.pdf"`,
      },
    });
  } catch (error: unknown) {
    console.error("Error generating invoice:", error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ error: "Failed to generate invoice" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
