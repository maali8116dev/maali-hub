import { useEffect } from "react";
import { Control, UseFormWatch, UseFormSetValue, UseFormStateReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { ApplicationFormValues } from "../schemas";
import type { ApplicationFormData } from "@/stores/applicationForm";

interface Step7ComplianceProps {
  control: Control<ApplicationFormValues>;
  watch: UseFormWatch<ApplicationFormValues>;
  setValue: UseFormSetValue<ApplicationFormValues>;
  formState: UseFormStateReturn<ApplicationFormValues>;
  updateFormData: (data: Partial<ApplicationFormData>) => void;
  isGrantType?: boolean;
}

export function Step7Compliance({
  watch,
  setValue,
  formState,
  updateFormData,
  isGrantType = true,
}: Step7ComplianceProps) {
  const { t, i18n } = useTranslation("dashboard");
  const f = "applications.form.step7";

  useEffect(() => {
    if (!isGrantType && !watch("reportingRequirementsAgreed")) {
      setValue("reportingRequirementsAgreed", true);
      updateFormData({ reportingRequirementsAgreed: true });
    }
  }, [isGrantType, setValue, updateFormData, watch]);

  const declarationDate = new Date().toLocaleDateString(i18n.language, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">{t(`${f}.title`)}</h3>
        <p className="text-sm text-muted-foreground mb-4">{t(`${f}.description`)}</p>
      </div>

      <div className="space-y-4">
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="informationAccurate"
              checked={!!watch("informationAccurateConfirmed")}
              onCheckedChange={(checked) => {
                setValue("informationAccurateConfirmed", !!checked);
                updateFormData({ informationAccurateConfirmed: !!checked });
              }}
              className="mt-1"
            />
            <div className="flex-1">
              <label
                htmlFor="informationAccurate"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {t(`${f}.informationAccurateLabel`)}{" "}
                <span className="text-destructive">*</span>
              </label>
              <p className="text-sm text-muted-foreground mt-1">
                {t(`${f}.informationAccurateDesc`)}
              </p>
            </div>
          </div>
          {formState.errors.informationAccurateConfirmed && (
            <p className="text-sm text-destructive ml-7">
              {String(formState.errors.informationAccurateConfirmed.message)}
            </p>
          )}
        </div>

        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="conflictOfInterest"
              checked={!!watch("conflictOfInterestDeclared")}
              onCheckedChange={(checked) => {
                setValue("conflictOfInterestDeclared", !!checked);
                updateFormData({ conflictOfInterestDeclared: !!checked });
              }}
              className="mt-1"
            />
            <div className="flex-1">
              <label
                htmlFor="conflictOfInterest"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {t(`${f}.conflictLabel`)}{" "}
                <span className="text-destructive">*</span>
              </label>
              <p className="text-sm text-muted-foreground mt-1">{t(`${f}.conflictDesc`)}</p>
            </div>
          </div>
          {formState.errors.conflictOfInterestDeclared && (
            <p className="text-sm text-destructive ml-7">
              {String(formState.errors.conflictOfInterestDeclared.message)}
            </p>
          )}
        </div>

        {isGrantType && (
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="reportingRequirements"
                checked={!!watch("reportingRequirementsAgreed")}
                onCheckedChange={(checked) => {
                  setValue("reportingRequirementsAgreed", !!checked);
                  updateFormData({ reportingRequirementsAgreed: !!checked });
                }}
                className="mt-1"
              />
              <div className="flex-1">
                <label
                  htmlFor="reportingRequirements"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {t(`${f}.reportingLabel`)}{" "}
                  <span className="text-destructive">*</span>
                </label>
                <p className="text-sm text-muted-foreground mt-1">{t(`${f}.reportingDesc`)}</p>
              </div>
            </div>
            {formState.errors.reportingRequirementsAgreed && (
              <p className="text-sm text-destructive ml-7">
                {String(formState.errors.reportingRequirementsAgreed.message)}
              </p>
            )}
          </div>
        )}

        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="dataProcessing"
              checked={!!watch("dataProcessingConsented")}
              onCheckedChange={(checked) => {
                setValue("dataProcessingConsented", !!checked);
                updateFormData({ dataProcessingConsented: !!checked });
              }}
              className="mt-1"
            />
            <div className="flex-1">
              <label
                htmlFor="dataProcessing"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {t(`${f}.dataProcessingLabel`)}{" "}
                <span className="text-destructive">*</span>
              </label>
              <p className="text-sm text-muted-foreground mt-1">{t(`${f}.dataProcessingDesc`)}</p>
            </div>
          </div>
          {formState.errors.dataProcessingConsented && (
            <p className="text-sm text-destructive ml-7">
              {String(formState.errors.dataProcessingConsented.message)}
            </p>
          )}
        </div>

        <div className="bg-muted/50 border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">
            <strong>{t("applications.form.declarationDate")}</strong> {declarationDate}
          </p>
        </div>
      </div>
    </div>
  );
}
