import { Control } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "lucide-react";
import CustomFormField, { FormFieldType } from "@/components/form/CustomFormField";
import { ApplicationFormValues } from "../schemas";

interface Step4SocialLinksProps {
  control: Control<ApplicationFormValues>;
}

export function Step4SocialLinks({ control }: Step4SocialLinksProps) {
  const { t } = useTranslation("dashboard");

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">{t("applications.form.step4.title")}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t("applications.form.step4.description")}
        </p>
      </div>

      <CustomFormField
        control={control}
        name="linkedinUrl"
        fieldType={FormFieldType.INPUT}
        label={t("applications.form.step4.linkedin")}
        placeholder={t("applications.form.step4.linkedinPlaceholder")}
        icon={Link}
        iconPosition="left"
      />

      <CustomFormField
        control={control}
        name="githubUrl"
        fieldType={FormFieldType.INPUT}
        label={t("applications.form.step4.github")}
        placeholder={t("applications.form.step4.githubPlaceholder")}
        icon={Link}
        iconPosition="left"
      />

      <CustomFormField
        control={control}
        name="twitterUrl"
        fieldType={FormFieldType.INPUT}
        label={t("applications.form.step4.twitter")}
        placeholder={t("applications.form.step4.twitterPlaceholder")}
        icon={Link}
        iconPosition="left"
      />

      <CustomFormField
        control={control}
        name="websiteUrl"
        fieldType={FormFieldType.INPUT}
        label={t("applications.form.step4.website")}
        placeholder={t("applications.form.step4.websitePlaceholder")}
        icon={Link}
        iconPosition="left"
      />

      <CustomFormField
        control={control}
        name="otherSocialLinks"
        fieldType={FormFieldType.TEXTAREA}
        label={t("applications.form.step4.other")}
        placeholder={t("applications.form.step4.otherPlaceholder")}
        description={t("applications.form.step4.max100Words")}
        rows={3}
        maxLength={600}
      />
    </div>
  );
}
