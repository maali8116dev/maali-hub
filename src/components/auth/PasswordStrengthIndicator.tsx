import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { createPasswordRequirements } from "@/lib/schemas/authForm.schema";

export type { PasswordRequirement } from "@/lib/schemas/authForm.schema";

export type PasswordStrength = "weak" | "medium" | "strong" | "very-strong";

export function calculatePasswordStrength(password: string): PasswordStrength {
  if (!password) return "weak";

  let strength = 0;

  if (password.length >= 8) strength += 1;
  if (password.length >= 12) strength += 1;
  if (password.length >= 16) strength += 1;
  if (/[a-z]/.test(password)) strength += 1;
  if (/[A-Z]/.test(password)) strength += 1;
  if (/[0-9]/.test(password)) strength += 1;
  if (/[^a-zA-Z0-9]/.test(password)) strength += 1;

  if (
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^a-zA-Z0-9]/.test(password)
  ) {
    strength += 1;
  }

  if (strength <= 2) return "weak";
  if (strength <= 4) return "medium";
  if (strength <= 6) return "strong";
  return "very-strong";
}

interface PasswordStrengthIndicatorProps {
  password: string;
  showStrengthBar?: boolean;
  className?: string;
}

export function PasswordStrengthIndicator({
  password,
  showStrengthBar = true,
  className,
}: PasswordStrengthIndicatorProps) {
  const { t } = useTranslation("common");
  const requirements = useMemo(() => createPasswordRequirements(t), [t]);
  const strength = useMemo(() => calculatePasswordStrength(password), [password]);
  const metRequirements = useMemo(
    () => requirements.map((req) => ({ ...req, met: req.test(password) })),
    [password, requirements],
  );

  const allMet = metRequirements.every((req) => req.met);
  const strengthColors = {
    weak: "bg-destructive",
    medium: "bg-orange-500",
    strong: "bg-yellow-500",
    "very-strong": "bg-green-500",
  };

  const strengthLabels = {
    weak: t("auth.passwordStrength.levels.weak"),
    medium: t("auth.passwordStrength.levels.medium"),
    strong: t("auth.passwordStrength.levels.strong"),
    "very-strong": t("auth.passwordStrength.levels.veryStrong"),
  };

  const strengthWidths = {
    weak: "25%",
    medium: "50%",
    strong: "75%",
    "very-strong": "100%",
  };

  if (!password) return null;

  return (
    <div className={cn("space-y-2 mt-2", className)}>
      {showStrengthBar && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{t("auth.passwordStrength.label")}</span>
            <span
              className={cn(
                "font-medium",
                strength === "weak" && "text-destructive",
                strength === "medium" && "text-orange-500",
                strength === "strong" && "text-yellow-600",
                strength === "very-strong" && "text-green-600",
              )}
            >
              {strengthLabels[strength]}
            </span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-300 ease-out",
                strengthColors[strength],
              )}
              style={{ width: strengthWidths[strength] }}
            />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">
          {t("auth.passwordStrength.requirementsTitle")}
        </p>
        <ul className="space-y-1">
          {metRequirements.map((req, index) => (
            <li key={index} className="flex items-center gap-2 text-xs">
              {req.met ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              )}
              <span
                className={cn(
                  req.met ? "text-green-700 dark:text-green-400" : "text-muted-foreground",
                )}
              >
                {req.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {allMet && (
        <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 pt-1">
          <AlertCircle className="h-3.5 w-3.5" />
          <span className="font-medium">{t("auth.passwordStrength.allMet")}</span>
        </div>
      )}
    </div>
  );
}
