import { Control } from "react-hook-form";
import { MapPin } from "lucide-react";
import CustomFormField, {
  FormFieldType,
} from "@/components/form/CustomFormField";
import { ApplicationFormValues } from "../schemas";

interface Step3ProjectOverviewProps {
  control: Control<ApplicationFormValues>;
}

export function Step3ProjectOverview({
  control,
}: Step3ProjectOverviewProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">
          Project Overview{" "}
          <span className="text-destructive">*</span>
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Tell us what you want funding for. All fields marked with{" "}
          <span className="text-destructive">*</span> are required.
        </p>
      </div>

      <CustomFormField
        control={control}
        name="projectTitle"
        fieldType={FormFieldType.INPUT}
        label="Project Title"
        placeholder="Enter project title"
        required
      />

      <CustomFormField
        control={control}
        name="projectSummary"
        fieldType={FormFieldType.TEXTAREA}
        label="Project Summary"
        placeholder="Provide a summary of your project (minimum 30 words)..."
        description="Project summary must be between 30 and 400 words"
        rows={6}
        maxLength={2400}
        required
      />

      <CustomFormField
        control={control}
        name="geographicFocus"
        fieldType={FormFieldType.INPUT}
        label="Geographic Focus"
        placeholder="Where will the project run?"
        icon={MapPin}
        iconPosition="left"
        required
      />
    </div>
  );
}

