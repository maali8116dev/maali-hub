import { useMemo } from "react";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const defaultRequirements: PasswordRequirement[] = [
  {
    label: "At least 8 characters",
    test: (pwd) => pwd.length >= 8,
  },
  {
    label: "Contains uppercase letter",
    test: (pwd) => /[A-Z]/.test(pwd),
  },
  {
    label: "Contains lowercase letter",
    test: (pwd) => /[a-z]/.test(pwd),
  },
  {
    label: "Contains number",
    test: (pwd) => /[0-9]/.test(pwd),
  },
  {
    label: "Contains special character (!@#$%^&*)",
    test: (pwd) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd),
  },
];

export type PasswordStrength = "weak" | "medium" | "strong" | "very-strong";

export function calculatePasswordStrength(password: string): PasswordStrength {
  if (!password) return "weak";
  
  let strength = 0;
  
  // Length checks
  if (password.length >= 8) strength += 1;
  if (password.length >= 12) strength += 1;
  if (password.length >= 16) strength += 1;
  
  // Character variety checks
  if (/[a-z]/.test(password)) strength += 1;
  if (/[A-Z]/.test(password)) strength += 1;
  if (/[0-9]/.test(password)) strength += 1;
  if (/[^a-zA-Z0-9]/.test(password)) strength += 1;
  
  // Bonus for complexity
  if (password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password)) {
    strength += 1;
  }
  
  if (strength <= 2) return "weak";
  if (strength <= 4) return "medium";
  if (strength <= 6) return "strong";
  return "very-strong";
}

interface PasswordStrengthIndicatorProps {
  password: string;
  requirements?: PasswordRequirement[];
  showStrengthBar?: boolean;
  className?: string;
}

export function PasswordStrengthIndicator({
  password,
  requirements = defaultRequirements,
  showStrengthBar = true,
  className,
}: PasswordStrengthIndicatorProps) {
  const strength = useMemo(() => calculatePasswordStrength(password), [password]);
  const metRequirements = useMemo(
    () => requirements.map((req) => ({ ...req, met: req.test(password) })),
    [password, requirements]
  );
  
  const allMet = metRequirements.every((req) => req.met);
  const strengthColors = {
    weak: "bg-destructive",
    medium: "bg-orange-500",
    strong: "bg-yellow-500",
    "very-strong": "bg-green-500",
  };
  
  const strengthLabels = {
    weak: "Weak",
    medium: "Medium",
    strong: "Strong",
    "very-strong": "Very Strong",
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
            <span className="text-muted-foreground">Password strength:</span>
            <span
              className={cn(
                "font-medium",
                strength === "weak" && "text-destructive",
                strength === "medium" && "text-orange-500",
                strength === "strong" && "text-yellow-600",
                strength === "very-strong" && "text-green-600"
              )}
            >
              {strengthLabels[strength]}
            </span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-300 ease-out",
                strengthColors[strength]
              )}
              style={{ width: strengthWidths[strength] }}
            />
          </div>
        </div>
      )}
      
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Requirements:</p>
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
                  req.met ? "text-green-700 dark:text-green-400" : "text-muted-foreground"
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
          <span className="font-medium">All requirements met!</span>
        </div>
      )}
    </div>
  );
}









