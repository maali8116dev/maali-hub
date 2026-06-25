import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import i18n from "@/lib/i18n";
import {
  useApplicationFormStore,
  type ApplicationFormData,
} from "@/stores/applicationForm";
import { buildApplicantAutofillPatch } from "@/lib/applicantAutofill";
import type { UseFormReturn } from "react-hook-form";
import type { ApplicationFormValues } from "@/components/application/form/schemas";
import { getFormDefaults } from "@/components/application/form/getFormDefaults";

interface UseApplicantAutofillOptions {
  draftLoaded: boolean;
  form: UseFormReturn<ApplicationFormValues>;
}

/**
 * After draft restore, prefill empty applicant fields from the latest
 * submitted application and the user's profile.
 */
export function useApplicantAutofill({
  draftLoaded,
  form,
}: UseApplicantAutofillOptions) {
  const { user } = useAuth();
  const { data: profile, isPending: profilePending } = useProfile();
  const { toast } = useToast();
  const updateFormData = useApplicationFormStore((s) => s.updateFormData);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!draftLoaded || !user?.id || profilePending || doneRef.current) return;

    const run = async () => {
      doneRef.current = true;
      const current = useApplicationFormStore.getState().formData;
      const patch = await buildApplicantAutofillPatch(
        user.id,
        user.email,
        profile,
        current,
      );

      if (Object.keys(patch).length === 0) return;

      updateFormData(patch);
      const merged: ApplicationFormData = { ...current, ...patch };
      form.reset(getFormDefaults(merged) as ApplicationFormValues);

      toast({
        title: i18n.t("toasts.autofill.filled", { ns: "common" }),
        description: i18n.t("toasts.autofill.filledDesc", { ns: "common" }),
      });
    };

    void run();
  }, [draftLoaded, user, profile, profilePending, updateFormData, form, toast]);
}
