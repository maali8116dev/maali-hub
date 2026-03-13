import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useActivityLogger } from "@/hooks/useActivityLogger";

export interface FAQ {
  id: number;
  question: string;
  answer: string;
  sector: string;
  display_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface FAQFormData {
  question: string;
  answer: string;
  sector: string;
  display_order: number;
  is_published: boolean;
}

// Fetch all published FAQs for public page
// FAQs are static content that rarely changes
export const useFAQs = () => {
  return useQuery({
    queryKey: ["faqs", "published"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("faqs")
        .select("*")
        .eq("is_published", true)
        .order("sector", { ascending: true })
        .order("display_order", { ascending: true }) as any);

      if (error) throw error;
      return data as FAQ[];
    },
    staleTime: Infinity, // Never consider stale - FAQs rarely change
    gcTime: 24 * 60 * 60 * 1000, // Keep in cache for 24 hours
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
};

// Fetch all FAQs for admin (including unpublished)
export const useAdminFAQs = () => {
  return useQuery({
    queryKey: ["faqs", "admin"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("faqs")
        .select("*")
        .order("sector", { ascending: true })
        .order("display_order", { ascending: true }) as any);

      if (error) throw error;
      return data as FAQ[];
    },
  });
};

// Fetch single FAQ by ID
export const useFAQ = (id: number | undefined) => {
  return useQuery({
    queryKey: ["faqs", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await (supabase
        .from("faqs")
        .select("*")
        .eq("id", id)
        .maybeSingle() as any);

      if (error) throw error;
      return data as FAQ | null;
    },
    enabled: !!id,
  });
};

// Create FAQ mutation
export const useCreateFAQ = () => {
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLogger();

  return useMutation({
    mutationFn: async (faq: FAQFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await (supabase
        .from("faqs")
        .insert({
          ...faq,
          created_by: user?.id,
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as FAQ;
    },
    onSuccess: (faq) => {
      queryClient.invalidateQueries({ queryKey: ["faqs"] });
      logActivity({
        actionType: "create",
        entityType: "document",
        entityId: String(faq.id),
        description: `Created FAQ: ${faq.question.substring(0, 50)}...`,
        metadata: { sector: faq.sector },
      });
      toast.success("FAQ created successfully");
    },
    onError: (error) => {
      console.error("Error creating FAQ:", error);
      toast.error("Failed to create FAQ");
    },
  });
};

// Update FAQ mutation
export const useUpdateFAQ = () => {
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLogger();

  return useMutation({
    mutationFn: async ({ id, faq }: { id: number; faq: Partial<FAQFormData> }) => {
      const { data, error } = await (supabase
        .from("faqs")
        .update(faq)
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as FAQ;
    },
    onSuccess: (faq) => {
      queryClient.invalidateQueries({ queryKey: ["faqs"] });
      logActivity({
        actionType: "update",
        entityType: "document",
        entityId: String(faq.id),
        description: `Updated FAQ: ${faq.question.substring(0, 50)}...`,
        metadata: { sector: faq.sector },
      });
      toast.success("FAQ updated successfully");
    },
    onError: (error) => {
      console.error("Error updating FAQ:", error);
      toast.error("Failed to update FAQ");
    },
  });
};

// Delete FAQ mutation
export const useDeleteFAQ = () => {
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLogger();

  return useMutation({
    mutationFn: async (id: number) => {
      // Fetch FAQ before deleting for logging
      const { data: faq } = await (supabase
        .from("faqs")
        .select("question")
        .eq("id", id)
        .single() as any);
      
      const { error } = await (supabase.from("faqs").delete().eq("id", id) as any);

      if (error) throw error;
      return { id, question: faq?.question || "Unknown" };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["faqs"] });
      logActivity({
        actionType: "delete",
        entityType: "document",
        entityId: String(data.id),
        description: `Deleted FAQ: ${data.question.substring(0, 50)}...`,
      });
      toast.success("FAQ deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting FAQ:", error);
      toast.error("Failed to delete FAQ");
    },
  });
};

// Toggle FAQ published status
export const useToggleFAQPublished = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_published }: { id: number; is_published: boolean }) => {
      const { data, error } = await (supabase
        .from("faqs")
        .update({ is_published })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as FAQ;
    },
    onSuccess: (data: FAQ) => {
      queryClient.invalidateQueries({ queryKey: ["faqs"] });
      toast.success(data.is_published ? "FAQ published" : "FAQ unpublished");
    },
    onError: (error) => {
      console.error("Error toggling FAQ status:", error);
      toast.error("Failed to update FAQ status");
    },
  });
};








