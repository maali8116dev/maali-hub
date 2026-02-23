import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
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

    // Fetch transaction — user can only access their own, admin can access all
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
    const status = tx.status === "completed" ? "Paid" : tx.status.charAt(0).toUpperCase() + tx.status.slice(1);
    const statusColor = tx.status === "completed" ? "#166534" : tx.status === "refunded" ? "#92400e" : "#991b1b";
    const statusBg = tx.status === "completed" ? "#dcfce7" : tx.status === "refunded" ? "#fef3c7" : "#fee2e2";

    const siteUrl = Deno.env.get("SITE_URL") || "https://maali-opportunity-hub.lovable.app";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoiceNumber}</title>
  <style>
    @media print {
      body { margin: 0; padding: 0; }
      .no-print { display: none !important; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #1f2937; background: #f3f4f6; }
    .invoice-container { max-width: 800px; margin: 20px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #C85A2E 0%, #F5A623 100%); padding: 30px 40px; color: #fff; display: flex; justify-content: space-between; align-items: flex-start; }
    .header h1 { font-size: 28px; font-weight: 700; }
    .header .invoice-number { font-size: 14px; opacity: 0.9; margin-top: 4px; }
    .header .logo { font-size: 24px; font-weight: 800; letter-spacing: 1px; }
    .body { padding: 40px; }
    .meta-row { display: flex; justify-content: space-between; margin-bottom: 30px; flex-wrap: wrap; gap: 20px; }
    .meta-block h3 { font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; margin-bottom: 6px; }
    .meta-block p { font-size: 14px; line-height: 1.6; }
    .table-wrapper { margin: 30px 0; }
    table { width: 100%; border-collapse: collapse; }
    thead th { background: #f9fafb; padding: 12px 16px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb; }
    tbody td { padding: 16px; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
    .text-right { text-align: right; }
    .total-row { background: #f9fafb; }
    .total-row td { font-weight: 700; font-size: 16px; padding: 16px; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
    .footer { padding: 20px 40px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center; }
    .print-btn { display: inline-block; margin: 20px auto; padding: 10px 28px; background: linear-gradient(135deg, #C85A2E 0%, #F5A623 100%); color: #fff; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; text-decoration: none; }
    .print-btn:hover { opacity: 0.9; }
    .actions { text-align: center; padding: 10px 0 30px; }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div>
        <h1>INVOICE</h1>
        <div class="invoice-number">${invoiceNumber}</div>
      </div>
      <div class="logo">MAALI</div>
    </div>
    <div class="body">
      <div class="meta-row">
        <div class="meta-block">
          <h3>Billed To</h3>
          <p><strong>${userName}</strong></p>
          <p>${tx.billing_email || user.email || "N/A"}</p>
        </div>
        <div class="meta-block">
          <h3>Payment Date</h3>
          <p>${paymentDate}</p>
        </div>
        <div class="meta-block">
          <h3>Status</h3>
          <p><span class="status-badge" style="background:${statusBg};color:${statusColor};">${status}</span></p>
        </div>
      </div>

      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Project</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${tx.description || "Application Fee"}</td>
              <td>${projectTitle || "—"}</td>
              <td class="text-right">${currency} ${amount}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="2" class="text-right">Total</td>
              <td class="text-right">${currency} ${amount}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      ${tx.provider_transaction_id ? `<p style="font-size:12px;color:#9ca3af;margin-top:10px;">Transaction ID: ${tx.provider_transaction_id}</p>` : ""}
      ${tx.application_id ? `<p style="font-size:12px;color:#9ca3af;">Application ID: ${tx.application_id}</p>` : ""}
    </div>

    <div class="actions no-print">
      <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
    </div>

    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Maali Opportunity Hub. All rights reserved.</p>
      <p style="margin-top:4px;"><a href="${siteUrl}/privacy" style="color:#6b7280;">Privacy Policy</a> &middot; <a href="${siteUrl}/terms" style="color:#6b7280;">Terms of Service</a></p>
    </div>
  </div>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        ...getCorsHeaders(req),
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="invoice-${invoiceNumber}.html"`,
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
