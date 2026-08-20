import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ContactSubmission = Database["public"]["Tables"]["contact_submissions"]["Row"];
export type ContactSubmissionStatus = ContactSubmission["status"];

const QUERY_KEY = ["admin", "contact-submissions"] as const;

export function useContactSubmissions() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_submissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ContactSubmission[];
    },
  });
}

export function useUpdateContactSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      admin_notes,
    }: {
      id: string;
      status?: ContactSubmissionStatus;
      admin_notes?: string | null;
    }) => {
      const updates: Database["public"]["Tables"]["contact_submissions"]["Update"] = {};
      if (status !== undefined) updates.status = status;
      if (admin_notes !== undefined) updates.admin_notes = admin_notes;

      const { data, error } = await supabase
        .from("contact_submissions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as ContactSubmission;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
