import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export type PartnerProject = {
  id: number;
  title: string;
  description: string;
  category: string | null;
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
  createdAt: string;
};

export type PartnerProjectFormData = {
  title: string;
  description: string;
  category: string;
  status: string;
  deadline: string;
  fundingAmount: string;
  location: string;
  imageUrl?: string;
  requirements?: string;
  eligibilityCriteria?: string;
  applicationFee?: number;
  maxApplicants?: number;
};

function transformProject(data: any): PartnerProject {
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    category: data.category,
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
    createdAt: data.created_at,
  };
}

export function usePartnerProjects() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["partner-projects", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("created_by", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map(transformProject);
    },
    enabled: !!user,
  });
}

export function usePartnerProject(id?: number) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["partner-project", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id!)
        .eq("created_by", user!.id)
        .single();

      if (error) throw error;
      return transformProject(data);
    },
    enabled: !!user && !!id,
  });
}

export function useCreatePartnerProject() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (formData: PartnerProjectFormData) => {
      const { data, error } = await supabase
        .from("projects")
        .insert({
          title: formData.title,
          description: formData.description,
          category: formData.category,
          status: formData.status,
          deadline: formData.deadline,
          funding_amount: formData.fundingAmount,
          location: formData.location,
          image_url: formData.imageUrl || null,
          requirements: formData.requirements || null,
          eligibility_criteria: formData.eligibilityCriteria || null,
          application_fee: formData.applicationFee || 0,
          max_applicants: formData.maxApplicants || null,
          created_by: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-projects"] });
      toast({ title: "Project created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error creating project", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdatePartnerProject() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data: formData }: { id: number; data: PartnerProjectFormData }) => {
      const { data, error } = await supabase
        .from("projects")
        .update({
          title: formData.title,
          description: formData.description,
          category: formData.category,
          status: formData.status,
          deadline: formData.deadline,
          funding_amount: formData.fundingAmount,
          location: formData.location,
          image_url: formData.imageUrl || null,
          requirements: formData.requirements || null,
          eligibility_criteria: formData.eligibilityCriteria || null,
          application_fee: formData.applicationFee || 0,
          max_applicants: formData.maxApplicants || null,
        })
        .eq("id", id)
        .eq("created_by", user!.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-projects"] });
      queryClient.invalidateQueries({ queryKey: ["partner-project"] });
      toast({ title: "Project updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error updating project", description: error.message, variant: "destructive" });
    },
  });
}
