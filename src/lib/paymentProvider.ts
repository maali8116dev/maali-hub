export type PaymentProviderId = "stripe" | "paystack";
export type PaystackCurrency = "NGN" | "GHS" | "KES" | "ZAR";

export type PaymentProviderChoice = {
  provider: PaymentProviderId;
  currency?: PaystackCurrency;
};

export const PAYMENT_PROVIDERS: {
  id: PaymentProviderId;
  labelKey: string;
  descriptionKey: string;
}[] = [
  {
    id: "stripe",
    labelKey: "payment.provider.stripe.label",
    descriptionKey: "payment.provider.stripe.description",
  },
  {
    id: "paystack",
    labelKey: "payment.provider.paystack.label",
    descriptionKey: "payment.provider.paystack.description",
  },
];

/** USD-equivalent monthly amounts — adjust in Paystack dashboard to match. */
export const PAYSTACK_CURRENCIES: Record<
  PaystackCurrency,
  { currency: PaystackCurrency; displayAmount: string; amountSubunits: number }
> = {
  NGN: { currency: "NGN", displayAmount: "₦3,200", amountSubunits: 320_000 },
  GHS: { currency: "GHS", displayAmount: "GH₵30", amountSubunits: 3_000 },
  KES: { currency: "KES", displayAmount: "KSh 260", amountSubunits: 26_000 },
  ZAR: { currency: "ZAR", displayAmount: "R 36", amountSubunits: 3_600 },
};

export const PAYSTACK_CURRENCY_OPTIONS = Object.values(PAYSTACK_CURRENCIES);

/** Hint only: map profile country label → default Paystack currency. */
const COUNTRY_CURRENCY_HINT: Record<string, PaystackCurrency> = {
  Nigeria: "NGN",
  Ghana: "GHS",
  Kenya: "KES",
  "South Africa": "ZAR",
};

export function getDefaultPaystackCurrency(country: string | null | undefined): PaystackCurrency {
  if (!country) return "GHS";
  return COUNTRY_CURRENCY_HINT[country] ?? "GHS";
}

export function getLockedProvider(membership: {
  payment_provider?: string | null;
  status?: string;
  tier?: string;
} | null | undefined): PaymentProviderId | null {
  if (!membership?.payment_provider) return null;
  if (membership.payment_provider === "paystack" || membership.payment_provider === "stripe") {
    return membership.payment_provider;
  }
  return null;
}

export function isCheckoutChoiceComplete(choice: PaymentProviderChoice): boolean {
  if (choice.provider === "stripe") return true;
  return !!choice.currency && choice.currency in PAYSTACK_CURRENCIES;
}
