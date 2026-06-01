import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OpportunityType = 
  | 'grant'
  | 'fellowship'
  | 'scholarship'
  | 'internship'
  | 'training'
  | 'competition'
  | 'accelerator'
  | 'incubator'
  | 'job';

export type ProgramFormat = 'online' | 'in_person' | 'hybrid';
export type FundingType = 
  | 'fully_funded'
  | 'partially_funded'
  | 'stipend'
  | 'no_funding'
  | 'equity'
  | 'paid'
  | 'unpaid';
export type ExperienceLevel = 
  | 'student'
  | 'undergraduate'
  | 'graduate'
  | 'early_career'
  | 'mid_career'
  | 'startup_founder'
  | 'researcher'
  | 'professional';

export type OpportunityTag = {
  id: number;
  name: string;
  slug: string;
};

export type Opportunity = {
  id: number;
  title: string;
  description: string;
  opportunityType: OpportunityType;
  programFormat?: ProgramFormat | null;
  fundingType?: FundingType | null;
  experienceLevel?: ExperienceLevel | null;
  status: "open" | "closed" | "archived";
  deadline: string;
  startDate?: string | null;
  endDate?: string | null;
  fundingAmount: string;
  currency: string;
  location: string;
  country?: string | null;
  sector?: string | null;
  imageUrl: string | null;
  requirements: string | null;
  eligibilityCriteria: string | null;
  applicationFee: number | null;
  maxApplicants: number | null;
  currentApplicants: number;
  organizationName?: string | null;
  partnerLogoUrl?: string | null;
  partnerId?: number | null;
  featured: boolean;
  tags: OpportunityTag[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

// Transform Supabase snake_case to camelCase
export function transformOpportunity(data: any): Opportunity {
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    opportunityType: data.opportunity_type || 'grant',
    programFormat: data.program_format || null,
    fundingType: data.funding_type || null,
    experienceLevel: data.experience_level || null,
    status: data.status,
    deadline: data.deadline,
    startDate: data.start_date || null,
    endDate: data.end_date || null,
    fundingAmount: data.funding_amount || data.fundingAmount,
    currency: data.currency || 'USD',
    location: data.location,
    country: data.country || null,
    sector: data.sector_name || null,
    imageUrl: data.image_url || data.imageUrl,
    requirements: data.requirements,
    eligibilityCriteria: data.eligibility_criteria || data.eligibilityCriteria,
    applicationFee: data.application_fee || data.applicationFee,
    maxApplicants: data.max_applicants || data.maxApplicants,
    currentApplicants: data.current_applicants || data.currentApplicants || 0,
    organizationName: data.partner_name || null,
    partnerLogoUrl: data.partner_logo_url || null,
    partnerId: data.partner_id || null,
    featured: data.featured ?? false,
    tags: (data.tags || []).map((tag: any) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
    })),
    createdBy: data.created_by || data.createdBy,
    createdAt: data.created_at || data.createdAt,
    updatedAt: data.updated_at || data.updatedAt,
  };
}

/**
 * RPC-based query for opportunities with filters (optimized: single query with server-side filtering)
 */
async function fetchOpportunitiesDirect(filters?: {
  opportunityType?: OpportunityType | null;
  programFormat?: ProgramFormat | null;
  fundingType?: FundingType | null;
  experienceLevel?: ExperienceLevel | null;
  country?: string | null;
  status?: string | null;
  location?: string | null;
  tags?: string[] | null;
  search?: string;
  page?: number;
  itemsPerPage?: number;
}) {
  const page = filters?.page || 1;
  const itemsPerPage = filters?.itemsPerPage || 9;

  const { data: rpcData, error } = await supabase.rpc(
    'get_opportunities_with_filters' as any,
    {
      p_opportunity_type: filters?.opportunityType || null,
      p_program_format: filters?.programFormat || null,
      p_funding_type: filters?.fundingType || null,
      p_experience_level: filters?.experienceLevel || null,
      p_country: filters?.country || null,
      p_status: filters?.status || null,
      p_location: filters?.location || null,
      p_tags: filters?.tags || null,
      p_search: filters?.search?.trim() || null,
      p_page: page,
      p_page_size: itemsPerPage,
    }
  );

  if (error) throw error;

  // RPC now returns a single JSON object (not an array)
  const result = rpcData as any;
  if (!result || !result.opportunities) {
    return {
      opportunities: [],
      total: 0,
      page,
      itemsPerPage,
      totalPages: 0,
    };
  }

  const opportunities = (result.opportunities || []) as any[];

  return {
    opportunities: opportunities.map(transformOpportunity),
    total: Number(result.total_count || 0),
    page: Number(result.page || page),
    itemsPerPage,
    totalPages: Number(result.total_pages || 0),
  };
}

/**
 * Hook to fetch opportunities with optional filters
 */
export function useOpportunities(filters?: {
  opportunityType?: OpportunityType | null;
  programFormat?: ProgramFormat | null;
  fundingType?: FundingType | null;
  experienceLevel?: ExperienceLevel | null;
  country?: string | null;
  status?: string | null;
  location?: string | null;
  tags?: string[] | null;
  search?: string;
  page?: number;
  itemsPerPage?: number;
}) {
  return useQuery({
    queryKey: ["opportunities", filters],
    queryFn: async () => {
      return fetchOpportunitiesDirect(filters);
    },
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Hook to fetch opportunity tags
 */
export function useOpportunityTags() {
  return useQuery({
    queryKey: ["opportunity-tags"],
    queryFn: async (): Promise<OpportunityTag[]> => {
      const { data, error } = await (supabase
        .from("opportunity_tags" as any)
        .select("id, name, slug")
        .order("name", { ascending: true }) as any);

      if (error) throw error;

      return (data || []).map((tag) => ({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
      }));
    },
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

export type OpportunityTagWithCount = OpportunityTag & { count: number };

/**
 * Hook to fetch top N most-used opportunity tags by usage count
 */
export function usePopularTags(limit = 15) {
  return useQuery({
    queryKey: ["opportunity-tags-popular", limit],
    queryFn: async (): Promise<OpportunityTagWithCount[]> => {
      // Fetch all tag mappings with tag info
      const { data: tagMaps, error: mapError } = await (supabase
        .from("opportunity_tag_map" as any)
        .select("tag_id, opportunity_tags(id, name, slug)") as any);

      if (mapError) throw mapError;

      // Count usage per tag
      const countMap = new Map<number, { tag: OpportunityTag; count: number }>();
      for (const row of tagMaps || []) {
        const tag = (row as any).opportunity_tags;
        if (!tag) continue;
        const existing = countMap.get(tag.id);
        if (existing) {
          existing.count++;
        } else {
          countMap.set(tag.id, {
            tag: { id: tag.id, name: tag.name, slug: tag.slug },
            count: 1,
          });
        }
      }

      // Sort by count desc, take top N
      return Array.from(countMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
        .map(({ tag, count }) => ({ ...tag, count }));
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Direct Supabase query for locations (regions)
 */
async function fetchLocationsDirect(): Promise<string[]> {
  const { data, error } = await (supabase
    .from("opportunities")
    .select("location") as any);

  if (error) throw error;

  return Array.from(
    new Set((data || []).map((o) => o.location).filter(Boolean))
  ).sort() as string[];
}

/**
 * Hook to fetch opportunity locations/regions
 */
export function useOpportunityLocations() {
  return useQuery({
    queryKey: ["opportunity-locations"],
    queryFn: async () => {
      return fetchLocationsDirect();
    },
    staleTime: Infinity, // Never consider stale - locations rarely change
    gcTime: 24 * 60 * 60 * 1000, // Keep in cache for 24 hours
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

/**
 * Direct Supabase query for countries
 */
async function fetchCountriesDirect(): Promise<string[]> {
  const { data, error } = await (supabase
    .from("opportunities")
    .select("country")
    .not("country", "is", null) as any);

  if (error) throw error;

  return Array.from(
    new Set((data || []).map((o) => o.country).filter(Boolean))
  ).sort() as string[];
}

/**
 * Hook to fetch opportunity countries
 */
export function useOpportunityCountries() {
  return useQuery({
    queryKey: ["opportunity-countries"],
    queryFn: async () => {
      return fetchCountriesDirect();
    },
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

/**
 * Direct Supabase query for featured opportunities
 */
async function fetchFeaturedOpportunitiesDirect(): Promise<Opportunity[]> {
  const { data, error } = await (supabase
    .from("opportunities")
    .select(`
      *,
      partner:partners(name),
      tags:opportunity_tag_map(
        tag:opportunity_tags(id, name, slug)
      )
    `)
    .eq("featured", true)
    .neq("status", "closed")
    .order("created_at", { ascending: false })
    .limit(6) as any);

  if (error) throw error;

  // Transform the nested structure
  return (data || []).map((item: any) => {
    const tags = (item.tags || []).map((t: any) => t.tag).filter(Boolean);
    return transformOpportunity({ ...item, tags, partner_name: item.partner?.name || null });
  });
}

/**
 * Hook to fetch featured opportunities for homepage
 */
export function useFeaturedOpportunities() {
  return useQuery({
    queryKey: ["featured-opportunities"],
    queryFn: async () => {
      return fetchFeaturedOpportunitiesDirect();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - reasonable for landing page
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });
}









