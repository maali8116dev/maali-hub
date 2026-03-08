import { Control, useWatch } from "react-hook-form";
import { Building2, Mail, Phone, MapPin } from "lucide-react";
import CustomFormField, {
  FormFieldType,
} from "@/components/form/CustomFormField";
import { ApplicationFormValues } from "../schemas";
import { APPLICANT_TYPES } from "../constants";
import { COUNTRIES, getCountryCode } from "../countries";

interface Step1ApplicantInfoProps {
  control: Control<ApplicationFormValues>;
  applicantType?: string;
}

export function Step1ApplicantInfo({
  control,
  applicantType,
}: Step1ApplicantInfoProps) {
  const selectedCountry = useWatch({ control, name: "countryOfResidence" });
  const phoneCountryCode = getCountryCode(selectedCountry) || "US";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">
          Applicant Information{" "}
          <span className="text-destructive">*</span>
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Tell us about yourself or your organization. All fields marked with{" "}
          <span className="text-destructive">*</span> are required.
        </p>
      </div>

      <CustomFormField
        control={control}
        name="applicantType"
        fieldType={FormFieldType.SELECT}
        label="Applicant Type"
        placeholder="Select applicant type"
        required
        options={APPLICANT_TYPES.map((type) => ({
          value: type.value,
          label: type.label,
        }))}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CustomFormField
          control={control}
          name="fullLegalName"
          fieldType={FormFieldType.INPUT}
          label="Full Legal Name"
          placeholder="Enter full legal name"
          required
        />
        {applicantType &&
          (applicantType === "Organization" ||
            applicantType === "Startup / SME" ||
            applicantType === "NGO / Non-profit" ||
            applicantType === "Research / Academic") && (
            <CustomFormField
              control={control}
              name="organizationName"
              fieldType={FormFieldType.INPUT}
              label="Organization Name"
              placeholder="Enter organization name"
              icon={Building2}
              iconPosition="left"
            />
          )}
        <CustomFormField
          control={control}
          name="countryOfResidence"
          fieldType={FormFieldType.SELECT}
          label="Country of Residence / Registration"
          placeholder="Select country"
          required
          options={COUNTRIES}
        />
        <CustomFormField
          control={control}
          name="cityRegion"
          fieldType={FormFieldType.INPUT}
          label="City / Region"
          placeholder="Enter city or region"
          required
        />
        <CustomFormField
          control={control}
          name="emailAddress"
          fieldType={FormFieldType.EMAIL}
          label="Email Address"
          placeholder="your.email@example.com"
          icon={Mail}
          iconPosition="left"
          required
        />
        <CustomFormField
          key={phoneCountryCode}
          control={control}
          name="phoneNumber"
          fieldType={FormFieldType.PHONE_INTERNATIONAL}
          label="Phone Number"
          placeholder="Enter phone number"
          icon={Phone}
          iconPosition="left"
          defaultCountry={phoneCountryCode}
          required
        />
      </div>
    </div>
  );
}
