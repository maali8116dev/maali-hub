import { Elements } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";
import { ReactNode } from "react";

interface StripeElementsProviderProps {
  clientSecret: string;
  children: ReactNode;
}

export function StripeElementsProvider({
  clientSecret,
  children,
}: StripeElementsProviderProps) {
  const stripePromise = getStripe();

  if (!stripePromise) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Stripe is not configured. Please contact support.
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "hsl(var(--primary))",
            colorBackground: "hsl(var(--background))",
            colorText: "hsl(var(--foreground))",
            colorDanger: "hsl(var(--destructive))",
            fontFamily: "system-ui, sans-serif",
            spacingUnit: "4px",
            borderRadius: "calc(var(--radius) - 2px)",
          },
        },
      }}
    >
      {children}
    </Elements>
  );
}

