import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { getCorsHeaders } from "../_shared/cors.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Minimal PDF builder (no external dependencies)
function buildPdf(lines: { label: string; value: string }[], title: string, subtitle: string): Uint8Array {
  const objects: string[] = [];
  let objectId = 0;

  const addObject = (content: string) => {
    objectId++;
    objects.push(content);
    return objectId;
  };

  // Build page content stream
  const contentLines: string[] = [];
  contentLines.push("BT");
  contentLines.push("/F1 20 Tf");
  contentLines.push("50 770 Td");
  contentLines.push(`(${escPdf(title)}) Tj`);
  contentLines.push("/F1 12 Tf");
  contentLines.push("0 -25 Td");
  contentLines.push(`(${escPdf(subtitle)}) Tj`);
  contentLines.push("0 -15 Td");
  contentLines.push("/F1 10 Tf");
  contentLines.push("0 -20 Td");

  for (const line of lines) {
    contentLines.push(`(${escPdf(line.label + ": " + line.value)}) Tj`);
    contentLines.push("0 -16 Td");
  }

  // Footer
  contentLines.push("0 -30 Td");
  contentLines.push("/F1 8 Tf");
  contentLines.push(`(© ${new Date().getFullYear()} Maali Opportunity Hub. All rights reserved.) Tj`);
  contentLines.push("ET");

  const stream = contentLines.join("\n");

  // PDF objects
  const catalogId = addObject("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  const pagesId = addObject("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj");
  const pageId = addObject(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 5 0 R /Resources << /Font << /F1 4 0 R >> >> >>\nendobj"
  );
  const fontId = addObject(
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj"
  );
  const streamId = addObject(
    `5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`
  );

  // Build PDF file
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += objects[i] + "\n";
  }

  const xrefOffset = pdf.length;
  pdf += "xref\n";
  pdf += `0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets) {
    pdf += offset.toString().padStart(10, "0") + " 00000 n \n";
  }

  pdf += "trailer\n";
  pdf += `<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += "startxref\n";
  pdf += `${xrefOffset}\n`;
  pdf += "%%EOF";

  return new TextEncoder().encode(pdf);
}

function escPdf(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
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

    // Get transaction ID
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

    let query = supabaseAdmin.from("transactions").select("*").eq("id", transactionId);
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

    // Get project title
    let projectTitle = "N/A";
    if (tx.project_id) {
      const { data: project } = await supabaseAdmin
        .from("projects")
        .select("title")
        .eq("id", tx.project_id)
        .maybeSingle();
      projectTitle = project?.title || "N/A";
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

    // Build PDF
    const lines = [
      { label: "Invoice Number", value: invoiceNumber },
      { label: "Billed To", value: userName },
      { label: "Email", value: billingEmail },
      { label: "Payment Date", value: paymentDate },
      { label: "Status", value: statusLabel },
      { label: "", value: "" },
      { label: "Description", value: tx.description || "Application Fee" },
      { label: "Project", value: projectTitle },
      { label: "Amount", value: `${currency} ${amount}` },
      { label: "", value: "" },
      { label: "Total", value: `${currency} ${amount}` },
    ];

    if (tx.provider_transaction_id) {
      lines.push({ label: "Transaction ID", value: tx.provider_transaction_id });
    }
    if (tx.application_id) {
      lines.push({ label: "Application ID", value: tx.application_id });
    }

    const pdfBytes = buildPdf(lines, "INVOICE", `MAALI  -  ${invoiceNumber}`);

    return new Response(pdfBytes, {
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
