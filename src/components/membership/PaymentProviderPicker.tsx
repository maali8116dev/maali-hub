import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PAYMENT_PROVIDERS,
  PAYSTACK_CURRENCY_OPTIONS,
  type PaymentProviderChoice,
  type PaystackCurrency,
} from "@/lib/paymentProvider";
import { CreditCard, Wallet } from "lucide-react";

type Props = {
  value: PaymentProviderChoice;
  onChange: (choice: PaymentProviderChoice) => void;
  disabled?: boolean;
  /** Hint only — pre-selects Paystack currency when user picks Paystack */
  defaultPaystackCurrency?: PaystackCurrency;
};

export function PaymentProviderPicker({
  value,
  onChange,
  disabled = false,
  defaultPaystackCurrency = "GHS",
}: Props) {
  const { t } = useTranslation("common");

  const selectProvider = (provider: PaymentProviderChoice["provider"]) => {
    if (provider === "stripe") {
      onChange({ provider: "stripe" });
      return;
    }
    onChange({
      provider: "paystack",
      currency: value.currency ?? defaultPaystackCurrency,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">{t("payment.provider.chooseLabel")}</Label>
        <p className="text-xs text-muted-foreground mt-1">{t("payment.provider.chooseHint")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {PAYMENT_PROVIDERS.map((p) => {
          const selected = value.provider === p.id;
          const Icon = p.id === "stripe" ? CreditCard : Wallet;
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => selectProvider(p.id)}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors",
                selected
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:border-primary/40",
                disabled && "opacity-60 cursor-not-allowed",
              )}
            >
              <div className="flex items-start gap-3">
                <Icon className="h-5 w-5 mt-0.5 text-primary shrink-0" />
                <div>
                  <p className="font-medium text-sm">{t(p.labelKey)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t(p.descriptionKey)}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {value.provider === "paystack" && (
        <div className="space-y-2">
          <Label htmlFor="paystack-currency">{t("payment.provider.currencyLabel")}</Label>
          <Select
            value={value.currency ?? defaultPaystackCurrency}
            onValueChange={(c) => onChange({ provider: "paystack", currency: c as PaystackCurrency })}
            disabled={disabled}
          >
            <SelectTrigger id="paystack-currency" className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYSTACK_CURRENCY_OPTIONS.map((opt) => (
                <SelectItem key={opt.currency} value={opt.currency}>
                  {opt.currency} — {opt.displayAmount}/mo
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t("payment.provider.paystackFooter")}</p>
        </div>
      )}

      {value.provider === "stripe" && (
        <p className="text-xs text-muted-foreground">{t("payment.provider.stripeFooter")}</p>
      )}
    </div>
  );
}
