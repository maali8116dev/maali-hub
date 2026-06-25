export type PaymentProviderId = "stripe" | "paystack";
export type PaystackCurrency = "NGN" | "GHS" | "KES" | "ZAR";

const PAYSTACK_PLAN_ENV: Record<PaystackCurrency, string> = {
  NGN: "PAYSTACK_PLAN_CODE_NGN",
  GHS: "PAYSTACK_PLAN_CODE_GHS",
  KES: "PAYSTACK_PLAN_CODE_KES",
  ZAR: "PAYSTACK_PLAN_CODE_ZAR",
};

export const PAYSTACK_CURRENCIES: Record<
  PaystackCurrency,
  { currency: PaystackCurrency; amountSubunits: number; displayAmount: string }
> = {
  NGN: { currency: "NGN", amountSubunits: 320_000, displayAmount: "₦3,200" },
  GHS: { currency: "GHS", amountSubunits: 3_000, displayAmount: "GH₵30" },
  KES: { currency: "KES", amountSubunits: 26_000, displayAmount: "KSh 260" },
  ZAR: { currency: "ZAR", amountSubunits: 3_600, displayAmount: "R 36" },
};

export function getPaystackPlanCode(currency: PaystackCurrency): string | null {
  const key = PAYSTACK_PLAN_ENV[currency];
  return Deno.env.get(key) ?? null;
}

export function parsePaystackCurrency(value: unknown): PaystackCurrency | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase() as PaystackCurrency;
  return upper in PAYSTACK_CURRENCIES ? upper : null;
}

export function parsePaymentProvider(value: unknown): PaymentProviderId | null {
  if (value === "stripe" || value === "paystack") return value;
  return null;
}
