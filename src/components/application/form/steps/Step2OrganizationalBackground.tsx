import { Control, UseFormWatch, UseFormSetValue, UseFormStateReturn } from "react-hook-form";
import { Users, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import CustomFormField, {
  FormFieldType,
} from "@/components/form/CustomFormField";
import { ApplicationFormValues } from "../schemas";
import { PRIMARY_sectorS } from "../constants";
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
  return (
    <div className="space-y-4">
      {formData.applicantType === "Individual" ? (
        <Alert className="mb-4 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-500" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            These organization details are optional and usually not needed for
            individual applicants. You can proceed to the next step.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div>
            <h3 className="text-lg font-semibold mb-2">
              Organization Details (Optional)
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Share additional context about your organization's credibility and
              capacity. You can also provide this information in supporting
              documents.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CustomFormField
              control={control}
              name="yearEstablished"
              fieldType={FormFieldType.NUMBER}
              label="Year Established"
              placeholder="2020"
              min={1900}
              max={new Date().getFullYear()}
            />
            <CustomFormField
              control={control}
              name="numberOfTeamMembers"
              fieldType={FormFieldType.NUMBER}
              label="Number of Team Members"
              placeholder="10"
              icon={Users}
              iconPosition="left"
              min={1}
            />
          </div>

          <CustomFormField
            control={control}
            name="coreMissionPurpose"
            fieldType={FormFieldType.TEXTAREA}
            label="Core Mission / Purpose"
            placeholder="Briefly describe your organization's core mission and purpose..."
            description="Maximum 200 words"
            rows={4}
            maxLength={1200}
          />

          {/* Primary sectors - Checkbox Group */}
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Primary sector(s)
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {PRIMARY_sectorS.map((sector) => (
                <div
                  key={sector.value}
                  className="flex items-center space-x-2"
                >
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
                label="Other sector (Please specify)"
                placeholder="Enter other sector"
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
            label="Key Team Members & Roles"
            placeholder="List key team members and their roles..."
            description="Maximum 200 words"
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
                    updateFormData({
                      previousGrantsFundingReceived: checked as boolean,
                    });
                  }}
                />
                <label
                  htmlFor="previousGrants"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Previous grants or funding received
                </label>
              </div>
              {watch("previousGrantsFundingReceived") && (
                <CustomFormField
                  control={control}
                  name="previousGrantsFundingDetails"
                  fieldType={FormFieldType.TEXTAREA}
                  label="Previous Grants / Funding Details"
                  placeholder="Provide details about previous grants or funding received..."
                  description="Maximum 400 words"
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









