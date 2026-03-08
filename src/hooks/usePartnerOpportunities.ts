import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export type PartnerOpportunity = {
  id: number;
  title: string;
  description: string;
  status: string;
  deadline: string;
  fundingAmount: string;
  location: string;
  imageUrl: string | null;
  requirements: string | null;
  eligibilityCriteria: string | null;
  applicationFee: number | null;
  maxApplicants: number | null;
  currentApplicants: number;
  featured: boolean;
  currency: string;
  opportunityType: string;
  organizationName: string | null;
  country: string | null;
  categoryId: number | null;
  createdAt: string;
};

export type PartnerOpportunityFormData = {
  title: string;
  description: string;
  status: string;
  deadline: string;
  fundingAmount: string;
  location: string;
  imageUrl?: string;
  requirements?: string;
  eligibilityCriteria?: string;
  maxApplicants?: number;
  currency?: string;
  opportunityType?: string;
  organizationName?: string;
  country?: string;
  categoryId?: number;
};

function transformOpportunity(data: any): PartnerOpportunity {
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    status: data.status,
    deadline: data.deadline,
    fundingAmount: data.funding_amount,
    location: data.location,
    imageUrl: data.image_url,
    requirements: data.requirements,
    eligibilityCriteria: data.eligibility_criteria,
    applicationFee: data.application_fee,
    maxApplicants: data.max_applicants,
    currentApplicants: data.current_applicants || 0,
    featured: data.featured,
    currency: data.currency,
    opportunityType: data.opportunity_type,
    organizationName: data.organization_name,
    country: data.country,
    categoryId: data.category_id,
    createdAt: data.created_at,
  };
}

export function usePartnerOpportunities() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["partner-opportunities", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select("*")
        .eq("created_by", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map(transformOpportunity);
    },
    enabled: !!user,
  });
}

export function usePartnerOpportunity(id?: number) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["partner-opportunity", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select("*")
        .eq("id", id!)
        .eq("created_by", user!.id)
        .single();

      if (error) throw error;
      return transformOpportunity(data);
    },
    enabled: !!user && !!id,
  });
}

export function useCreatePartnerOpportunity() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (formData: PartnerOpportunityFormData) => {
      const { data, error } = await supabase
        .from("opportunities")
        .insert({
          title: formData.title,
          description: formData.description,
          status: formData.status || "open",
          deadline: formData.deadline,
          funding_amount: formData.fundingAmount,
          location: formData.location,
          image_url: formData.imageUrl || null,
          requirements: formData.requirements || null,
          eligibility_criteria: formData.eligibilityCriteria || null,
          application_fee: 0,
          max_applicants: formData.maxApplicants || null,
          currency: formData.currency || "USD",
          opportunity_type: (formData.opportunityType as any) || "grant",
          organization_name: formData.organizationName || null,
          country: formData.country || null,
          category_id: formData.categoryId || null,
          created_by: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-opportunities"] });
      toast({ title: "Opportunity created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error creating opportunity", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdatePartnerOpportunity() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data: formData }: { id: number; data: PartnerOpportunityFormData }) => {
      const { data, error } = await supabase
        .from("opportunities")
        .update({
          title: formData.title,
          description: formData.description,
          status: formData.status,
          deadline: formData.deadline,
          funding_amount: formData.fundingAmount,
          location: formData.location,
          image_url: formData.imageUrl || null,
          requirements: formData.requirements || null,
          eligibility_criteria: formData.eligibilityCriteria || null,
          application_fee: 0,
          max_applicants: formData.maxApplicants || null,
          currency: formData.currency || "USD",
          opportunity_type: (formData.opportunityType as any) || "grant",
          organization_name: formData.organizationName || null,
          country: formData.country || null,
          category_id: formData.categoryId || null,
        })
        .eq("id", id)
        .eq("created_by", user!.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["partner-opportunity"] });
      toast({ title: "Opportunity updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error updating opportunity", description: error.message, variant: "destructive" });
    },
  });
}
