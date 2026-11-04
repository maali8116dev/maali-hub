import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { deleteFileByUrl, uploadFileToBucket } from "@/lib/storageUploads";
import { toast } from "sonner";
import i18n from "@/lib/i18n";
import { useActivityLogger } from "@/hooks/useActivityLogger";

export interface Resource {
  id: string;
  title: string;
  description: string | null;
  sector: string;
  file_type: string;
  file_url: string | null;
  file_size: number | null;
  duration: string | null;
  is_featured: boolean;
  is_published: boolean;
  download_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResourceFormData {
  title: string;
  description?: string;
  sector: string;
  file_type: string;
  file_url?: string;
  file_size?: number;
  duration?: string;
  is_featured?: boolean;
  is_published?: boolean;
}

const RESOURCE_sectors = [
  "Application Guides",
  "Video Tutorials",
  "Templates",
  "Mentorship",
  "Case Studies",
  "Webinars",
  "Tools",
  "Other"
] as const;

const FILE_TYPES = [
  "pdf",
  "excel",
  "powerpoint",
  "word",
  "video",
  "webinar",
  "link",
  "directory",
  "event"
] as const;

export { RESOURCE_sectors, FILE_TYPES };

function normalizeResourceRow(row: Record<string, unknown>): Resource {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    title: r.title as string,
    description: (r.description as string | null) ?? null,
    sector: (r.Sector ?? r.sector ?? "") as string,
    file_type: r.file_type as string,
    file_url: (r.file_url as string | null) ?? null,
    file_size: (r.file_size as number | null) ?? null,
    duration: (r.duration as string | null) ?? null,
    is_featured: (r.is_featured as boolean) ?? false,
    is_published: (r.is_published as boolean) ?? true,
    download_count: (r.download_count as number) ?? 0,
    created_by: (r.created_by as string | null) ?? null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

function resourceFormToDb(data: Partial<ResourceFormData>) {
  const { sector, ...rest } = data as Partial<ResourceFormData> & { sector?: string };
  return { ...rest, ...(sector !== undefined && { Sector: sector }) };
}

// Fetch published resources (public)
// Resources are static content that rarely changes (download_count updated via mutation)
export const useResources = (filters?: { sector?: string; fileType?: string }) => {
  return useQuery({
    queryKey: ["resources", "published", filters],
    queryFn: async () => {
      let query = supabase
        .from("resources")
        .select("*")
        .eq("is_published", true)
        .order("Sector")
        .order("title", { ascending: true });

      if (filters?.sector) {
        query = query.eq("Sector", filters.sector);
      }
      if (filters?.fileType) {
        query = query.eq("file_type", filters.fileType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []).map((row) => normalizeResourceRow(row as Record<string, unknown>));
    },
    staleTime: Infinity, // Never consider stale - resources rarely change
    gcTime: 24 * 60 * 60 * 1000, // Keep in cache for 24 hours
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
};

// Fetch all resources (admin)
export const useAdminResources = () => {
  return useQuery({
    queryKey: ["resources", "admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("*")
        .order("Sector")
        .order("title", { ascending: true });

      if (error) throw error;
      return (data || []).map((row) => normalizeResourceRow(row as Record<string, unknown>));
    },
  });
};

// Fetch single resource
export const useResource = (id: string | undefined) => {
  return useQuery({
    queryKey: ["resources", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("resources")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return normalizeResourceRow((data || {}) as Record<string, unknown>);
    },
    enabled: !!id,
  });
};

// Fetch unique sectors from resources
// sectors are static content that rarely changes
export const useResourcesectors = () => {
  return useQuery({
    queryKey: ["resources", "sectors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("Sector")
        .eq("is_published", true);

      if (error) throw error;
      
      const uniquesectors = [...new Set((data || []).map((r: any) => r.Sector).filter(Boolean))].sort();
      return uniquesectors;
    },
    staleTime: Infinity, // Never consider stale - sectors rarely change
    gcTime: 24 * 60 * 60 * 1000, // Keep in cache for 24 hours
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
};

// Create resource
export const useCreateResource = () => {
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLogger();

  return useMutation({
    mutationFn: async (data: ResourceFormData) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data: resource, error } = await supabase
        .from("resources")
        .insert({
          ...resourceFormToDb(data),
          created_by: user.user?.id,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return normalizeResourceRow((resource || {}) as Record<string, unknown>);
    },
    onSuccess: (resource) => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      logActivity({
        actionType: "create",
        entityType: "document",
        entityId: resource.id,
        description: `Created resource: ${resource.title}`,
        metadata: { title: resource.title, sector: resource.sector },
      });
      toast.success(i18n.t("toasts.resource.created", { ns: "common" }));
    },
    onError: (error) => {
      toast.error(i18n.t("toasts.resource.createError", { ns: "common" }) + (error.message ? `: ${error.message}` : ""));
    },
  });
};

// Update resource
export const useUpdateResource = () => {
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLogger();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ResourceFormData> }) => {
      const { data: resource, error } = await supabase
        .from("resources")
        .update(resourceFormToDb(data))
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return normalizeResourceRow((resource || {}) as Record<string, unknown>);
    },
    onSuccess: (resource) => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      logActivity({
        actionType: "update",
        entityType: "document",
        entityId: resource.id,
        description: `Updated resource: ${resource.title}`,
        metadata: { title: resource.title },
      });
      toast.success(i18n.t("toasts.resource.updated", { ns: "common" }));
    },
    onError: (error) => {
      toast.error(i18n.t("toasts.resource.updateError", { ns: "common" }) + (error.message ? `: ${error.message}` : ""));
    },
  });
};

// Delete resource
export const useDeleteResource = () => {
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLogger();

  return useMutation({
    mutationFn: async (id: string) => {
      // Fetch resource title before deleting for logging
      const { data: resource } = await supabase
        .from("resources")
        .select("title")
        .eq("id", id)
        .single();
      
      const { error } = await supabase
        .from("resources")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { id, title: resource?.title || "Unknown" };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      logActivity({
        actionType: "delete",
        entityType: "document",
        entityId: data.id,
        description: `Deleted resource: ${data.title}`,
        metadata: { title: data.title },
      });
      toast.success(i18n.t("toasts.resource.deleted", { ns: "common" }));
    },
    onError: (error) => {
      toast.error(i18n.t("toasts.resource.deleteError", { ns: "common" }) + (error.message ? `: ${error.message}` : ""));
    },
  });
};

// Toggle published status
export const useToggleResourcePublished = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_published }: { id: string; is_published: boolean }) => {
      const { error } = await supabase
        .from("resources")
        .update({ is_published })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      toast.success(variables.is_published ? i18n.t("toasts.resource.published", { ns: "common" }) : i18n.t("toasts.resource.unpublished", { ns: "common" }));
    },
    onError: (error) => {
      toast.error(i18n.t("toasts.resource.updateError", { ns: "common" }) + (error.message ? `: ${error.message}` : ""));
    },
  });
};

// Increment download count
export const useIncrementDownload = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: resource, error: fetchError } = await supabase
        .from("resources")
        .select("download_count")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from("resources")
        .update({ download_count: (resource.download_count || 0) + 1 })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
    },
  });
};

// Upload resource file
export const uploadResourceFile = async (file: File): Promise<{ url: string; size: number }> => {
  const { publicUrl } = await uploadFileToBucket(file, {
    bucket: "resource-files",
    isPublic: true,
  });

  return { url: publicUrl ?? "", size: file.size };
};

// Delete resource file
export const deleteResourceFile = async (fileUrl: string): Promise<void> => {
  await deleteFileByUrl("resource-files", fileUrl);
};








