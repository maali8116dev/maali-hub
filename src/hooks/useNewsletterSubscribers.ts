import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type NewsletterSubscriber = Database["public"]["Tables"]["newsletter_subscribers"]["Row"];

export function useNewsletterSubscribers() {
  return useQuery({
    queryKey: ["admin", "newsletter-subscribers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("newsletter_subscribers")
        .select("*")
        .order("subscribed_at", { ascending: false });
      if (error) throw error;
      return data as NewsletterSubscriber[];
    },
  });
}
