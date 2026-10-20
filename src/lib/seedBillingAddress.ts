import { supabase } from "@/integrations/supabase/client";

/** Create default billing row from onboarding profile if none exists. */
export async function seedDefaultBillingAddress(params: {
  userId: string;
  billingEmail?: string | null;
  country?: string | null;
  city?: string | null;
  fullName?: string | null;
  companyName?: string | null;
}): Promise<void> {
  if (!params.country?.trim()) return;

  const { data: existing } = await supabase
    .from("billing_addresses")
    .select("id")
    .eq("user_id", params.userId)
    .eq("is_default", true)
    .maybeSingle();

  if (existing) return;

  const city = params.city?.trim() || params.country.trim();
  const { error } = await supabase.from("billing_addresses").insert({
    user_id: params.userId,
    billing_email: params.billingEmail?.trim() || null,
    full_name: params.fullName?.trim() || null,
    company_name: params.companyName?.trim() || null,
    address_line1: city,
    city,
    country: params.country.trim(),
    postal_code: "—",
    is_default: true,
  });

  if (error) console.warn("[seedDefaultBillingAddress]", error.message);
}
