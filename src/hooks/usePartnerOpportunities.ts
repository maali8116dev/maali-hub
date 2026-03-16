import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { usePartnerOrg } from "@/hooks/usePartnerOrg";

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
  country: string | null;
  sectorId: number | null;
  createdAt: string;
};

export type PartnerOpportunityFormData = {
  title: string;
  description: string;
  status: string;
  deadline: string;
  fundingAmount?: string;
  location: string;
  imageUrl?: string;
  requirements?: string;
  eligibilityCriteria?: string;
  maxApplicants?: number;
  currency?: string;
  opportunityType?: string | null;
  country?: string;
  sectorId?: number;
  tags?: string[]; // Tag names (existing or new)
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
    country: data.country,
    sectorId: data.sector_id,
    createdAt: data.created_at,
  };
}

export function usePartnerOpportunities() {
  const { user } = useAuth();
  const { data: partnerOrg } = usePartnerOrg();

  return useQuery({
    queryKey: ["partner-opportunities", user?.id, partnerOrg?.id],
    queryFn: async () => {
      if (!partnerOrg?.id) return [];

      const { data, error } = await supabase
        .from("opportunities")
        .select("*")
        .eq("partner_id", partnerOrg.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map(transformOpportunity);
    },
    enabled: !!user,
  });
}

export function usePartnerOpportunity(id?: number) {
  const { user } = useAuth();
  const { data: partnerOrg } = usePartnerOrg();

  return useQuery({
    queryKey: ["partner-opportunity", id, partnerOrg?.id],
    queryFn: async () => {
      if (!id || !partnerOrg?.id) throw new Error("Partner organization not found");

      const { data, error } = await supabase
        .from("opportunities")
        .select("*")
        .eq("id", id!)
        .eq("partner_id", partnerOrg.id)
        .single();

      if (error) throw error;
      return transformOpportunity(data);
    },
    enabled: !!user && !!id,
  });
}

/** Upsert tags by name and link them to an opportunity */
export async function syncOpportunityTags(opportunityId: number, tagNames: string[]) {
  if (!tagNames.length) return;

  // For each tag name, insert if missing (avoid UPDATE RLS)
  const resolvedTagIds: number[] = [];
  for (const name of tagNames) {
    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const { data: inserted, error } = await (supabase
      .from("opportunity_tags" as any)
      .upsert({ name, slug }, { onConflict: "slug", ignoreDuplicates: true })
      .select("id")
      .single() as any);
    if (error && error.code !== "PGRST116") throw error;

    if (inserted?.id) {
      resolvedTagIds.push(inserted.id);
      continue;
    }

    const { data: existing, error: selectError } = await (supabase
      .from("opportunity_tags" as any)
      .select("id")
      .eq("slug", slug)
      .single() as any);
    if (selectError) throw selectError;
    resolvedTagIds.push(existing.id);
  }

  // Delete old mappings then insert new ones
  await (supabase.from("opportunity_tag_map" as any).delete().eq("opportunity_id", opportunityId) as any);
  if (resolvedTagIds.length) {
    const { error } = await (supabase.from("opportunity_tag_map" as any).insert(
      resolvedTagIds.map((tag_id) => ({ opportunity_id: opportunityId, tag_id }))
    ) as any);
    if (error) throw error;
  }
}

export function useCreatePartnerOpportunity() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: partnerOrg } = usePartnerOrg();

  return useMutation({
    mutationFn: async (formData: PartnerOpportunityFormData) => {
      const { data, error } = await supabase
        .from("opportunities")
        .insert({
          title: formData.title,
          description: formData.description,
          status: formData.status || "open",
          deadline: formData.deadline,
          funding_amount: formData.opportunityType === "grant" ? formData.fundingAmount || null : null,
          location: formData.location,
          image_url: formData.imageUrl || null,
          requirements: formData.requirements || null,
          eligibility_criteria: formData.eligibilityCriteria || null,
          application_fee: 0,
          max_applicants: formData.maxApplicants || null,
          currency: formData.currency || "USD",
          opportunity_type: (formData.opportunityType as any) || null,
          country: formData.country || null,
          sector_id: formData.sectorId || null,
          created_by: user!.id,
          // Link opportunity to the partner organization, if one is associated
          partner_id: partnerOrg?.id ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      if (formData.tags?.length) await syncOpportunityTags(data.id, formData.tags);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-tags"] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-tags-popular"] });
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
          funding_amount: formData.opportunityType === "grant" ? formData.fundingAmount || null : null,
          location: formData.location,
          image_url: formData.imageUrl || null,
          requirements: formData.requirements || null,
          eligibility_criteria: formData.eligibilityCriteria || null,
          application_fee: 0,
          max_applicants: formData.maxApplicants || null,
          currency: formData.currency || "USD",
          opportunity_type: (formData.opportunityType as any) || null,
          country: formData.country || null,
          sector_id: formData.sectorId || null,
        })
        .eq("id", id)
        .eq("created_by", user!.id)
        .select()
        .single();

      if (error) throw error;
      if (formData.tags !== undefined) await syncOpportunityTags(id, formData.tags);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["partner-opportunity"] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-tags"] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-tags-popular"] });
      toast({ title: "Opportunity updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error updating opportunity", description: error.message, variant: "destructive" });
    },
  });
}

/** Fetch existing tags for an opportunity */
export function usePartnerOpportunityTags(opportunityId?: number) {
  return useQuery({
    queryKey: ["partner-opportunity-tags", opportunityId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("opportunity_tag_map" as any)
        .select("opportunity_tags(id, name, slug)")
        .eq("opportunity_id", opportunityId!) as any);
      if (error) throw error;
      return ((data || []) as any[])
        .map((row: any) => row.opportunity_tags?.name as string)
        .filter(Boolean);
    },
    enabled: !!opportunityId,
  });
}








