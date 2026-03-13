import { Control, UseFormWatch, UseFormSetValue, UseFormStateReturn } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { ApplicationFormValues } from "../schemas";
import type { ApplicationFormData } from "@/stores/applicationForm";

interface Step7ComplianceProps {
  control: Control<ApplicationFormValues>;
  watch: UseFormWatch<ApplicationFormValues>;
  setValue: UseFormSetValue<ApplicationFormValues>;
  formState: UseFormStateReturn<ApplicationFormValues>;
  updateFormData: (data: Partial<ApplicationFormData>) => void;
}

export function Step7Compliance({
  control,
  watch,
  setValue,
  formState,
  updateFormData,
}: Step7ComplianceProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">
          Compliance & Declarations
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Please read and confirm the following declarations. All fields are
          required for governance purposes.
        </p>
      </div>

      <div className="space-y-4">
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="informationAccurate"
              checked={!!watch("informationAccurateConfirmed")}
              onCheckedChange={(checked) => {
                setValue("informationAccurateConfirmed", !!checked);
                updateFormData({
                  informationAccurateConfirmed: !!checked,
                });
              }}
              className="mt-1"
            />
            <div className="flex-1">
              <label
                htmlFor="informationAccurate"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Confirmation that information is accurate{" "}
                <span className="text-destructive">*</span>
              </label>
              <p className="text-sm text-muted-foreground mt-1">
                I confirm that all information provided in this application is
                accurate, complete, and truthful to the best of my knowledge.
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
                updateFormData({
                  conflictOfInterestDeclared: !!checked,
                });
              }}
              className="mt-1"
            />
            <div className="flex-1">
              <label
                htmlFor="conflictOfInterest"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Conflict of interest declaration{" "}
                <span className="text-destructive">*</span>
              </label>
              <p className="text-sm text-muted-foreground mt-1">
                I declare that I have disclosed any potential conflicts of
                interest that may affect this application or its evaluation.
              </p>
            </div>
          </div>
          {formState.errors.conflictOfInterestDeclared && (
            <p className="text-sm text-destructive ml-7">
              {String(formState.errors.conflictOfInterestDeclared.message)}
            </p>
          )}
        </div>

        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="reportingRequirements"
              checked={!!watch("reportingRequirementsAgreed")}
              onCheckedChange={(checked) => {
                setValue("reportingRequirementsAgreed", !!checked);
                updateFormData({
                  reportingRequirementsAgreed: !!checked,
                });
              }}
              className="mt-1"
            />
            <div className="flex-1">
              <label
                htmlFor="reportingRequirements"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Agreement to reporting requirements{" "}
                <span className="text-destructive">*</span>
              </label>
              <p className="text-sm text-muted-foreground mt-1">
                I agree to provide regular progress reports, financial
                statements, and other documentation as required by the funding
                organization.
              </p>
            </div>
          </div>
          {formState.errors.reportingRequirementsAgreed && (
            <p className="text-sm text-destructive ml-7">
              {String(formState.errors.reportingRequirementsAgreed.message)}
            </p>
          )}
        </div>

        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="dataProcessing"
              checked={!!watch("dataProcessingConsented")}
              onCheckedChange={(checked) => {
                setValue("dataProcessingConsented", !!checked);
                updateFormData({
                  dataProcessingConsented: !!checked,
                });
              }}
              className="mt-1"
            />
            <div className="flex-1">
              <label
                htmlFor="dataProcessing"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Consent to data processing{" "}
                <span className="text-destructive">*</span>
              </label>
              <p className="text-sm text-muted-foreground mt-1">
                I consent to the processing of my personal data and application
                information for the purposes of evaluation, administration, and
                communication related to this application.
              </p>
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
            <strong>Declaration Date:</strong>{" "}
            {new Date().toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}









