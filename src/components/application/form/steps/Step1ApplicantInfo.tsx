import { Control, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Building2, Mail, Phone } from "lucide-react";
import CustomFormField, { FormFieldType } from "@/components/form/CustomFormField";
import { ApplicationFormValues } from "../schemas";
import { getApplicantTypeOptions } from "../constants";
import { COUNTRIES, getCountryCode } from "../countries";

interface Step1ApplicantInfoProps {
  control: Control<ApplicationFormValues>;
  applicantType?: string;
}

const ORG_TYPES = new Set([
  "Organization",
  "Startup / SME",
  "NGO / Non-profit",
  "Research / Academic",
]);

export function Step1ApplicantInfo({ control, applicantType }: Step1ApplicantInfoProps) {
  const { t } = useTranslation("dashboard");
  const selectedCountry = useWatch({ control, name: "countryOfResidence" });
  const phoneCountryCode = getCountryCode(selectedCountry) || "US";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">
          {t("applications.form.step1.title")}{" "}
          <span className="text-destructive">*</span>
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t("applications.form.step1.description")} {t("applications.form.requiredMark")}
        </p>
      </div>

      <CustomFormField
        control={control}
        name="applicantType"
        fieldType={FormFieldType.SELECT}
        label={t("applications.form.step1.applicantType")}
        placeholder={t("applications.form.step1.applicantTypePlaceholder")}
        required
        options={getApplicantTypeOptions(t)}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CustomFormField
          control={control}
          name="fullLegalName"
          fieldType={FormFieldType.INPUT}
          label={t("applications.form.step1.fullLegalName")}
          placeholder={t("applications.form.step1.fullLegalNamePlaceholder")}
          required
        />
        {applicantType && ORG_TYPES.has(applicantType) && (
          <CustomFormField
            control={control}
            name="organizationName"
            fieldType={FormFieldType.INPUT}
            label={t("applications.form.step1.organizationName")}
            placeholder={t("applications.form.step1.organizationNamePlaceholder")}
            icon={Building2}
            iconPosition="left"
          />
        )}
        <CustomFormField
          control={control}
          name="countryOfResidence"
          fieldType={FormFieldType.SELECT}
          label={t("applications.form.step1.country")}
          placeholder={t("applications.form.step1.countryPlaceholder")}
          required
          options={COUNTRIES}
        />
        <CustomFormField
          control={control}
          name="cityRegion"
          fieldType={FormFieldType.INPUT}
          label={t("applications.form.step1.cityRegion")}
          placeholder={t("applications.form.step1.cityRegionPlaceholder")}
          required
        />
        <CustomFormField
          control={control}
          name="emailAddress"
          fieldType={FormFieldType.EMAIL}
          label={t("applications.form.step1.email")}
          placeholder={t("applications.form.step1.emailPlaceholder")}
          icon={Mail}
          iconPosition="left"
          required
        />
        <CustomFormField
          key={phoneCountryCode}
          control={control}
          name="phoneNumber"
          fieldType={FormFieldType.PHONE_INTERNATIONAL}
          label={t("applications.form.step1.phone")}
          placeholder={t("applications.form.step1.phonePlaceholder")}
          icon={Phone}
          iconPosition="left"
          country={phoneCountryCode}
          defaultCountry={phoneCountryCode}
          required
        />
      </div>
    </div>
  );
}
