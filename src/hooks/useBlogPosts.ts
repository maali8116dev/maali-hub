import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import i18n from "@/lib/i18n";
import { useActivityLogger } from "@/hooks/useActivityLogger";

export interface BlogPost {
  id: number;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  sector: string;
  read_time: string;
  image_url: string;
  featured: boolean;
  status: "draft" | "published" | "archived";
  tags: string | null;
  views: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface BlogPostFormData {
  title: string;
  excerpt: string;
  content: string;
  author: string;
  sector: string;
  readTime: string;
  image: string;
  featured: boolean;
  status: "draft" | "published" | "archived";
  tags?: string;
}

function normalizeBlogRow(row: Record<string, unknown>): BlogPost {
  return {
    id: row.id as number,
    title: row.title as string,
    excerpt: row.excerpt as string,
    content: row.content as string,
    author: row.author as string,
    sector: (row.Sector ?? row.sector ?? "") as string,
    read_time: row.read_time as string,
    image_url: row.image_url as string,
    featured: (row.featured as boolean) ?? false,
    status: row.status as BlogPost["status"],
    tags: (row.tags as string | null) ?? null,
    views: (row.views as number) ?? 0,
    published_at: (row.published_at as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    created_by: (row.created_by as string | null) ?? null,
  };
}

function formToDb(data: Partial<BlogPostFormData>) {
  const { sector, readTime, image, tags, ...rest } = data;
  return {
    ...rest,
    ...(sector !== undefined && { Sector: sector }),
    ...(readTime !== undefined && { read_time: readTime }),
    ...(image !== undefined && { image_url: image }),
    ...(tags !== undefined && { tags: tags || null }),
  };
}

export function usePublishedBlogPosts() {
  return useQuery({
    queryKey: ["blog_posts", "published"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("status", "published")
        .order("published_at", { ascending: false });

      if (error) throw error;
      return (data || []).map((row) => normalizeBlogRow(row as Record<string, unknown>));
    },
  });
}

export function useAdminBlogPosts() {
  return useQuery({
    queryKey: ["blog_posts", "admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map((row) => normalizeBlogRow(row as Record<string, unknown>));
    },
  });
}

export function useBlogPost(id: string | undefined) {
  return useQuery({
    queryKey: ["blog_posts", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("id", Number(id))
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return normalizeBlogRow(data as Record<string, unknown>);
    },
    enabled: !!id,
  });
}

export function useCreateBlogPost() {
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLogger();

  return useMutation({
    mutationFn: async (data: BlogPostFormData) => {
      const { data: user } = await supabase.auth.getUser();
      const { data: post, error } = await supabase
        .from("blog_posts")
        .insert({
          ...formToDb(data),
          created_by: user.user?.id,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return normalizeBlogRow((post || {}) as Record<string, unknown>);
    },
    onSuccess: (post) => {
      queryClient.invalidateQueries({ queryKey: ["blog_posts"] });
      logActivity({
        actionType: "create",
        entityType: "document",
        entityId: String(post.id),
        description: `Created blog post: ${post.title}`,
        metadata: { title: post.title, status: post.status },
      });
      toast.success(i18n.t("toasts.blog.created", { ns: "common" }));
    },
    onError: (error: Error) => {
      toast.error(
        i18n.t("toasts.blog.createError", { ns: "common" }) +
          (error.message ? `: ${error.message}` : "")
      );
    },
  });
}

export function useUpdateBlogPost() {
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLogger();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<BlogPostFormData> }) => {
      const { data: post, error } = await supabase
        .from("blog_posts")
        .update(formToDb(data) as any)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return normalizeBlogRow((post || {}) as Record<string, unknown>);
    },
    onSuccess: (post) => {
      queryClient.invalidateQueries({ queryKey: ["blog_posts"] });
      logActivity({
        actionType: "update",
        entityType: "document",
        entityId: String(post.id),
        description: `Updated blog post: ${post.title}`,
        metadata: { title: post.title },
      });
      toast.success(i18n.t("toasts.blog.updated", { ns: "common" }));
    },
    onError: (error: Error) => {
      toast.error(
        i18n.t("toasts.blog.updateError", { ns: "common" }) +
          (error.message ? `: ${error.message}` : "")
      );
    },
  });
}

export function useDeleteBlogPost() {
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLogger();

  return useMutation({
    mutationFn: async (id: number) => {
      const { data: existing } = await supabase
        .from("blog_posts")
        .select("title")
        .eq("id", id)
        .maybeSingle();

      const { error } = await supabase.from("blog_posts").delete().eq("id", id);
      if (error) throw error;
      return { id, title: existing?.title ?? String(id) };
    },
    onSuccess: ({ id, title }) => {
      queryClient.invalidateQueries({ queryKey: ["blog_posts"] });
      logActivity({
        actionType: "delete",
        entityType: "document",
        entityId: String(id),
        description: `Deleted blog post: ${title}`,
      });
      toast.success(i18n.t("toasts.blog.deleted", { ns: "common" }));
    },
    onError: (error: Error) => {
      toast.error(
        i18n.t("toasts.blog.deleteError", { ns: "common" }) +
          (error.message ? `: ${error.message}` : "")
      );
    },
  });
}
