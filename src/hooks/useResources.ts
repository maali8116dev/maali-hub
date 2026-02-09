import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useActivityLogger } from "@/hooks/useActivityLogger";

export interface Resource {
  id: string;
  title: string;
  description: string | null;
  category: string;
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
  category: string;
  file_type: string;
  file_url?: string;
  file_size?: number;
  duration?: string;
  is_featured?: boolean;
  is_published?: boolean;
}

const RESOURCE_CATEGORIES = [
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

export { RESOURCE_CATEGORIES, FILE_TYPES };

// Fetch published resources (public)
export const useResources = (filters?: { category?: string; fileType?: string }) => {
  return useQuery({
    queryKey: ["resources", "published", filters],
    queryFn: async () => {
      let query = supabase
        .from("resources")
        .select("*")
        .eq("is_published", true)
        .order("category")
        .order("title", { ascending: true });

      if (filters?.category) {
        query = query.eq("category", filters.category);
      }
      if (filters?.fileType) {
        query = query.eq("file_type", filters.fileType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Resource[];
    },
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
        .order("category")
        .order("title", { ascending: true });

      if (error) throw error;
      return data as Resource[];
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
      return data as Resource;
    },
    enabled: !!id,
  });
};

// Fetch unique categories from resources
export const useResourceCategories = () => {
  return useQuery({
    queryKey: ["resources", "categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("category")
        .eq("is_published", true);

      if (error) throw error;
      
      const uniqueCategories = [...new Set(data.map(r => r.category))].sort();
      return uniqueCategories;
    },
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
          ...data,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return resource as Resource;
    },
    onSuccess: (resource) => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      logActivity({
        actionType: "create",
        entityType: "document",
        entityId: resource.id,
        description: `Created resource: ${resource.title}`,
        metadata: { title: resource.title, category: resource.category },
      });
      toast.success("Resource created successfully");
    },
    onError: (error) => {
      toast.error("Failed to create resource: " + error.message);
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
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return resource as Resource;
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
      toast.success("Resource updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update resource: " + error.message);
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
      toast.success("Resource deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete resource: " + error.message);
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
      toast.success(variables.is_published ? "Resource published" : "Resource unpublished");
    },
    onError: (error) => {
      toast.error("Failed to update resource: " + error.message);
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
  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("resource-files")
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from("resource-files")
    .getPublicUrl(filePath);

  return { url: data.publicUrl, size: file.size };
};

// Delete resource file
export const deleteResourceFile = async (fileUrl: string): Promise<void> => {
  const urlParts = fileUrl.split("/");
  const fileName = urlParts[urlParts.length - 1];

  const { error } = await supabase.storage
    .from("resource-files")
    .remove([fileName]);

  if (error) throw error;
};
