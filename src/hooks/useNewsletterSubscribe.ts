import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export type NewsletterSource = "landing" | "footer";

export function useNewsletterSubscribe() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation("landing");
  const { user } = useAuth();

  const subscribe = useCallback(
    async (email: string, source: NewsletterSource): Promise<boolean> => {
      const normalized = email.trim().toLowerCase();
      if (!normalized) return false;

      setIsSubmitting(true);
      try {
        const { error } = await supabase.from("newsletter_subscribers").insert({
          email: normalized,
          source,
          user_id: user?.id ?? null,
        });

        if (error) {
          if (error.code === "23505") {
            toast({
              title: t("newsletter.thankYou"),
              description: t("newsletter.alreadySubscribed"),
            });
            return true;
          }
          toast({
            title: t("newsletter.errorTitle"),
            description: t("newsletter.errorGeneric"),
            variant: "destructive",
          });
          return false;
        }

        toast({
          title: t("newsletter.thankYou"),
          description: t("newsletter.subscribedMessage"),
        });
        return true;
      } finally {
        setIsSubmitting(false);
      }
    },
    [t, toast, user?.id]
  );

  return { subscribe, isSubmitting };
}
