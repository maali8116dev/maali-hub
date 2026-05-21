import { Control } from "react-hook-form";
import { MapPin } from "lucide-react";
import CustomFormField, {
  FormFieldType,
} from "@/components/form/CustomFormField";
import { ApplicationFormValues } from "../schemas";
import { getProjectOverviewCopy } from "../constants";

interface Step3ProjectOverviewProps {
  control: Control<ApplicationFormValues>;
  isGrantType?: boolean;
}

export function Step3ProjectOverview({
  control,
  isGrantType = true,
}: Step3ProjectOverviewProps) {
  const {
    sectionTitle,
    sectionHint,
    titleLabel,
    titlePlaceholder,
    summaryLabel,
    summaryPlaceholder,
    locationLabel,
    locationPlaceholder,
  } = getProjectOverviewCopy(isGrantType);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">
          {sectionTitle}{" "}
          <span className="text-destructive">*</span>
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {sectionHint}{" "}
          <span className="text-destructive">*</span> are required.
        </p>
      </div>

      <CustomFormField
        control={control}
        name="projectTitle"
        fieldType={FormFieldType.INPUT}
        label={titleLabel}
        placeholder={titlePlaceholder}
        required
      />

      <CustomFormField
        control={control}
        name="projectSummary"
        fieldType={FormFieldType.TEXTAREA}
        label={summaryLabel}
        placeholder={summaryPlaceholder}
        description="Must be between 30 and 400 words"
        rows={6}
        required
      />

      {isGrantType && (
        <CustomFormField
          control={control}
          name="geographicFocus"
          fieldType={FormFieldType.INPUT}
          label={locationLabel}
          placeholder={locationPlaceholder}
          icon={MapPin}
          iconPosition="left"
        />
      )}
    </div>
  );
}









