import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import i18n from "@/lib/i18n";

export interface Sector {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SectorFormData {
  name: string;
  slug?: string;
  description?: string;
  is_active?: boolean;
}

/**
 * Hook to fetch all active sectors (for public use)
 */
export function useSectors() {
  return useQuery({
    queryKey: ["sectors", "active"],
    queryFn: async (): Promise<Sector[]> => {
      const { data, error } = await supabase
        .from("sectors")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

/**
 * Hook to fetch all sectors including inactive ones (admin only)
 */
export function useAllSectors() {
  return useQuery({
    queryKey: ["sectors", "all"],
    queryFn: async (): Promise<Sector[]> => {
      const { data, error } = await supabase
        .from("sectors")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

/**
 * Hook to fetch a single sector by ID
 */
export function useSector(sectorId: number | null) {
  return useQuery({
    queryKey: ["sectors", sectorId],
    queryFn: async (): Promise<Sector | null> => {
      if (!sectorId) return null;

      const { data, error } = await supabase
        .from("sectors")
        .select("*")
        .eq("id", sectorId)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }
      return data;
    },
    enabled: !!sectorId,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

/**
 * Hook to fetch a single sector by slug
 */
export function useSectorBySlug(slug: string | null) {
  return useQuery({
    queryKey: ["sectors", "slug", slug],
    queryFn: async (): Promise<Sector | null> => {
      if (!slug) return null;

      const { data, error } = await supabase
        .from("sectors")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }
      return data;
    },
    enabled: !!slug,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

/**
 * Hook to create a new sector (admin only)
 */
export function useCreateSector() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: SectorFormData): Promise<Sector> => {
      const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

      const { data: sector, error } = await supabase
        .from("sectors")
        .insert({
          name: data.name,
          slug,
          description: data.description || null,
          is_active: data.is_active ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      return sector;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sectors"] });
      toast({
        title: i18n.t("toasts.sector.created", { ns: "common" }),
        description: i18n.t("toasts.sector.createdDesc", { ns: "common" }),
      });
    },
    onError: (error: Error) => {
      toast({
        title: i18n.t("toasts.sector.error", { ns: "common" }),
        description: error.message || i18n.t("toasts.sector.createError", { ns: "common" }),
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook to update a sector (admin only)
 */
export function useUpdateSector() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Partial<SectorFormData>;
    }): Promise<Sector> => {
      const updateData: SectorFormData = { ...data };
      if (data.name && !data.slug) {
        updateData.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      }

      const { data: sector, error } = await supabase
        .from("sectors")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return sector;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sectors"] });
      toast({
        title: i18n.t("toasts.sector.updated", { ns: "common" }),
        description: i18n.t("toasts.sector.updatedDesc", { ns: "common" }),
      });
    },
    onError: (error: Error) => {
      toast({
        title: i18n.t("toasts.sector.error", { ns: "common" }),
        description: error.message || i18n.t("toasts.sector.updateError", { ns: "common" }),
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook to delete a sector (admin only)
 */
export function useDeleteSector() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      const { error } = await supabase.from("sectors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sectors"] });
      toast({
        title: i18n.t("toasts.sector.deleted", { ns: "common" }),
        description: i18n.t("toasts.sector.deletedDesc", { ns: "common" }),
      });
    },
    onError: (error: Error) => {
      toast({
        title: i18n.t("toasts.sector.error", { ns: "common" }),
        description: error.message || i18n.t("toasts.sector.deleteError", { ns: "common" }),
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook to toggle sector active status (admin only)
 */
export function useToggleSectorStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      isActive,
    }: {
      id: number;
      isActive: boolean;
    }): Promise<Sector> => {
      const { data: sector, error } = await supabase
        .from("sectors")
        .update({ is_active: isActive })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return sector;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sectors"] });
      toast({
        title: i18n.t(variables.isActive ? "toasts.sector.enabled" : "toasts.sector.disabled", { ns: "common" }),
        description: i18n.t(variables.isActive ? "toasts.sector.enabledDesc" : "toasts.sector.disabledDesc", { ns: "common" }),
      });
    },
    onError: (error: Error) => {
      toast({
        title: i18n.t("toasts.sector.error", { ns: "common" }),
        description: error.message || i18n.t("toasts.sector.statusError", { ns: "common" }),
        variant: "destructive",
      });
    },
  });
}

/**
 * Helper function to get sector names as array
 */
export function useSectorNames(): string[] {
  const { data: sectors = [] } = useSectors();
  return sectors.map((c) => c.name);
}

