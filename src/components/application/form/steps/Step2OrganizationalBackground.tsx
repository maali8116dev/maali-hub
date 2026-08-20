import { Control, UseFormWatch, UseFormSetValue, UseFormStateReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Users, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import CustomFormField, { FormFieldType } from "@/components/form/CustomFormField";
import { ApplicationFormValues } from "../schemas";
import { getPrimarySectorOptions } from "../constants";
import type { ApplicationFormData } from "@/stores/applicationForm";

interface Step2OrganizationalBackgroundProps {
  control: Control<ApplicationFormValues>;
  watch: UseFormWatch<ApplicationFormValues>;
  setValue: UseFormSetValue<ApplicationFormValues>;
  formState: UseFormStateReturn<ApplicationFormValues>;
  formData: ApplicationFormData;
  updateFormData: (data: Partial<ApplicationFormData>) => void;
  isGrantType?: boolean;
}

export function Step2OrganizationalBackground({
  control,
  watch,
  setValue,
  formState,
  formData,
  updateFormData,
  isGrantType = true,
}: Step2OrganizationalBackgroundProps) {
  const { t } = useTranslation("dashboard");
  const sectors = getPrimarySectorOptions(t);

  return (
    <div className="space-y-4">
      {formData.applicantType === "Individual" ? (
        <Alert className="mb-4 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-500" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            {t("applications.form.step2.individualSkip")}
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div>
            <h3 className="text-lg font-semibold mb-2">{t("applications.form.step2.title")}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t("applications.form.step2.description")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CustomFormField
              control={control}
              name="yearEstablished"
              fieldType={FormFieldType.NUMBER}
              label={t("applications.form.step2.yearEstablished")}
              placeholder={t("applications.form.step2.yearEstablishedPlaceholder")}
              min={1900}
              max={new Date().getFullYear()}
            />
            <CustomFormField
              control={control}
              name="numberOfTeamMembers"
              fieldType={FormFieldType.NUMBER}
              label={t("applications.form.step2.teamMembers")}
              placeholder={t("applications.form.step2.teamMembersPlaceholder")}
              icon={Users}
              iconPosition="left"
              min={1}
            />
          </div>

          <CustomFormField
            control={control}
            name="coreMissionPurpose"
            fieldType={FormFieldType.TEXTAREA}
            label={t("applications.form.step2.coreMission")}
            placeholder={t("applications.form.step2.coreMissionPlaceholder")}
            description={t("applications.form.step2.max200Words")}
            rows={4}
            maxLength={1200}
          />

          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              {t("applications.form.step2.primarySectors")}
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {sectors.map((sector) => (
                <div key={sector.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`sector-${sector.value}`}
                    checked={watch("primarysectors")?.includes(sector.value) || false}
                    onCheckedChange={(checked) => {
                      const current = watch("primarysectors") || [];
                      const updated = checked
                        ? [...current, sector.value]
                        : current.filter((s) => s !== sector.value);
                      setValue("primarysectors", updated);
                      updateFormData({ primarysectors: updated });
                    }}
                  />
                  <label
                    htmlFor={`sector-${sector.value}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {sector.label}
                  </label>
                </div>
              ))}
            </div>
            {watch("primarysectors")?.includes("Other") && (
              <CustomFormField
                control={control}
                name="primarysectorOther"
                fieldType={FormFieldType.INPUT}
                label={t("applications.form.step2.otherSector")}
                placeholder={t("applications.form.step2.otherSectorPlaceholder")}
                className="mt-2"
              />
            )}
            {formState.errors.primarysectors && (
              <p className="text-sm text-destructive mt-1">
                {String(formState.errors.primarysectors.message)}
              </p>
            )}
          </div>

          <CustomFormField
            control={control}
            name="keyTeamMembersRoles"
            fieldType={FormFieldType.TEXTAREA}
            label={t("applications.form.step2.keyTeam")}
            placeholder={t("applications.form.step2.keyTeamPlaceholder")}
            description={t("applications.form.step2.max200Words")}
            rows={4}
            maxLength={1200}
          />

          {isGrantType && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="previousGrants"
                  checked={watch("previousGrantsFundingReceived") || false}
                  onCheckedChange={(checked) => {
                    setValue("previousGrantsFundingReceived", checked as boolean);
                    updateFormData({ previousGrantsFundingReceived: checked as boolean });
                  }}
                />
                <label
                  htmlFor="previousGrants"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {t("applications.form.step2.previousGrants")}
                </label>
              </div>
              {watch("previousGrantsFundingReceived") && (
                <CustomFormField
                  control={control}
                  name="previousGrantsFundingDetails"
                  fieldType={FormFieldType.TEXTAREA}
                  label={t("applications.form.step2.previousGrantsDetails")}
                  placeholder={t("applications.form.step2.previousGrantsPlaceholder")}
                  description={t("applications.form.step2.max400Words")}
                  rows={4}
                  maxLength={2400}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
