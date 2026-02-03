import { loadStripe, Stripe } from "@stripe/stripe-js";

// Stripe publishable key - should be set in environment variables
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";

let stripePromise: Promise<Stripe | null> | null = null;

/**
 * Initialize Stripe instance
 * This is a singleton pattern to ensure we only create one Stripe instance
 */
export const getStripe = (): Promise<Stripe | null> => {
  if (!stripePromise) {
    if (!STRIPE_PUBLISHABLE_KEY) {
      console.warn("Stripe publishable key not found. Stripe functionality will be disabled.");
      stripePromise = Promise.resolve(null);
    } else {
      stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
    }
  }
  return stripePromise;
};

/**
 * Format amount for Stripe (convert to cents)
 */
export const formatAmountForStripe = (amount: number, currency: string = "usd"): number => {
  // Stripe amounts are in the smallest currency unit (cents for USD)
  const numberFormat = new Intl.NumberFormat(["en-US"], {
    style: "currency",
    currency: currency.toUpperCase(),
    currencyDisplay: "symbol",
  });
  const parts = numberFormat.formatToParts(amount);
  let zeroDecimalCurrency = true;
  for (const part of parts) {
    if (part.type === "decimal") {
      zeroDecimalCurrency = false;
    }
  }
  return zeroDecimalCurrency ? Math.round(amount) : Math.round(amount * 100);
};

/**
 * Format amount from Stripe (convert from cents)
 */
export const formatAmountFromStripe = (amount: number, currency: string = "usd"): number => {
  const numberFormat = new Intl.NumberFormat(["en-US"], {
    style: "currency",
    currency: currency.toUpperCase(),
    currencyDisplay: "symbol",
  });
  const parts = numberFormat.formatToParts(1);
  let zeroDecimalCurrency = true;
  for (const part of parts) {
    if (part.type === "decimal") {
      zeroDecimalCurrency = false;
    }
  }
  return zeroDecimalCurrency ? amount : amount / 100;
};

