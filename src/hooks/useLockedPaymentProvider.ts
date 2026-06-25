import { useMembership } from "@/hooks/useMembership";
import { getLockedProvider } from "@/lib/paymentProvider";

/** Returns locked checkout provider from membership row, or null to show picker. */
export function useLockedPaymentProvider() {
  const { membership, loading } = useMembership();
  return {
    loading,
    lockedProvider: getLockedProvider(membership),
    billingCurrency: membership?.billing_currency ?? null,
  };
}
