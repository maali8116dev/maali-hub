import { type LucideIcon } from "lucide-react";

interface InfoFieldProps {
  icon: LucideIcon;
  label: string;
  value: string | number | React.ReactNode;
  breakWords?: boolean;
  breakAll?: boolean;
}

/**
 * Reusable info field displayed as icon + label + value in a muted card.
 * Used across applicant, project, and organizational sections.
 */
const InfoField = ({ icon: Icon, label, value, breakWords, breakAll }: InfoFieldProps) => (
  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
    <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
    <div className="min-w-0">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={`font-medium ${breakAll ? "break-all" : ""} ${breakWords ? "break-words" : ""}`}
      >
        {value}
      </p>
    </div>
  </div>
);

export default InfoField;

