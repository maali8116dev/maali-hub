import { Control } from "react-hook-form";
import { Link } from "lucide-react";
import CustomFormField, {
  FormFieldType,
} from "@/components/form/CustomFormField";
import { ApplicationFormValues } from "../schemas";

interface Step4SocialLinksProps {
  control: Control<ApplicationFormValues>;
}

export function Step4SocialLinks({ control }: Step4SocialLinksProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Social Links</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Share your professional and social media profiles (optional). This
          helps us learn more about you and your work.
        </p>
      </div>

      <CustomFormField
        control={control}
        name="linkedinUrl"
        fieldType={FormFieldType.INPUT}
        label="LinkedIn Profile URL"
        placeholder="https://linkedin.com/in/yourprofile"
        icon={Link}
        iconPosition="left"
      />

      <CustomFormField
        control={control}
        name="githubUrl"
        fieldType={FormFieldType.INPUT}
        label="GitHub Profile URL"
        placeholder="https://github.com/yourusername"
        icon={Link}
        iconPosition="left"
      />

      <CustomFormField
        control={control}
        name="twitterUrl"
        fieldType={FormFieldType.INPUT}
        label="Twitter/X Profile URL"
        placeholder="https://twitter.com/yourusername"
        icon={Link}
        iconPosition="left"
      />

      <CustomFormField
        control={control}
        name="websiteUrl"
        fieldType={FormFieldType.INPUT}
        label="Website URL"
        placeholder="https://yourwebsite.com"
        icon={Link}
        iconPosition="left"
      />

      <CustomFormField
        control={control}
        name="otherSocialLinks"
        fieldType={FormFieldType.TEXTAREA}
        label="Other Social Links"
        placeholder="List any other relevant social media profiles or links (e.g., Instagram, Facebook, portfolio, etc.)"
        description="Maximum 100 words"
        rows={3}
        maxLength={600}
      />
    </div>
  );
}









