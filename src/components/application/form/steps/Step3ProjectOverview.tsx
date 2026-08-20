import { Control } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { MapPin } from "lucide-react";
import CustomFormField, { FormFieldType } from "@/components/form/CustomFormField";
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
  const { t } = useTranslation("dashboard");
  const {
    sectionTitle,
    sectionHint,
    titleLabel,
    titlePlaceholder,
    summaryLabel,
    summaryPlaceholder,
    locationLabel,
    locationPlaceholder,
  } = getProjectOverviewCopy(t, isGrantType);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">
          {sectionTitle} <span className="text-destructive">*</span>
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {sectionHint} {t("applications.form.requiredMark")}
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
        description={t("applications.form.step3.summaryWordLimit")}
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
