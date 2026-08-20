import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ContentTranslations } from "@/lib/localizedContent";

export type SuccessStory = {
  id: number;
  name: string;
  company: string;
  sector: string;
  location: string;
  funding_amount: string;
  funding_date: string;
  image_url: string | null;
  description: string;
  impact_metrics: string | null;
  featured: boolean;
  display_order: number;
  status: string;
  translations?: ContentTranslations | null;
};

/**
 * Direct Supabase query for featured success stories
 */
async function fetchFeaturedSuccessStoriesDirect(): Promise<SuccessStory[]> {
  const { data, error } = await (supabase as any)
    .from("success_stories")
    .select("*")
    .eq("status", "published")
    .eq("featured", true)
    .order("display_order", { ascending: true })
    .order("funding_date", { ascending: false })
    .limit(6);

  if (error) throw error;

  return (data || []) as SuccessStory[];
}

/**
 * Hook to fetch featured success stories for homepage
 * Success stories are static content that rarely changes, so we use aggressive caching
 */
export function useFeaturedSuccessStories() {
  return useQuery({
    queryKey: ["featured-success-stories"],
    queryFn: async () => {
      return fetchFeaturedSuccessStoriesDirect();
    },
    staleTime: Infinity, // Never consider stale - only refetch manually
    gcTime: 24 * 60 * 60 * 1000, // Keep in cache for 24 hours
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on reconnect
    refetchOnMount: false, // Don't refetch on component mount if data exists
    retry: 1,
  });
}

/**
 * Direct Supabase query for all success stories
 */
async function fetchAllSuccessStoriesDirect(): Promise<SuccessStory[]> {
  const { data, error } = await (supabase as any)
    .from("success_stories")
    .select("*")
    .eq("status", "published")
    .order("display_order", { ascending: true })
    .order("funding_date", { ascending: false });

  if (error) throw error;

  return (data || []) as SuccessStory[];
}

/**
 * Hook to fetch all published success stories
 * Success stories are static content that rarely changes, so we use aggressive caching
 */
export function useSuccessStories() {
  return useQuery({
    queryKey: ["success-stories"],
    queryFn: async () => {
      return fetchAllSuccessStoriesDirect();
    },
    staleTime: Infinity, // Never consider stale - only refetch manually
    gcTime: 24 * 60 * 60 * 1000, // Keep in cache for 24 hours
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on reconnect
    refetchOnMount: false, // Don't refetch on component mount if data exists
    retry: 1,
  });
}









