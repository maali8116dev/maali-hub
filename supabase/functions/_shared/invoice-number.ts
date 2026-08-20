import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0?no-dts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/** Sequential INV-YYYYMM-0001 from DB; backfills row when missing. */
export async function resolveInvoiceNumber(
  transactionId: string,
  existing: string | null | undefined,
): Promise<string> {
  if (existing?.trim()) return existing.trim();

  const { data: generated, error: genError } = await supabaseAdmin.rpc("generate_invoice_number");
  if (genError || !generated) {
    throw new Error(genError?.message ?? "Failed to generate invoice number");
  }

  await supabaseAdmin
    .from("transactions")
    .update({ invoice_number: generated })
    .eq("id", transactionId);

  return generated;
}
