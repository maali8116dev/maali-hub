import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ActivityLog {
  id: string;
  userId: string | null;
  actionType: string;
  entityType: string;
  entityId: string | null;
  description: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  // Note: ipAddress and userAgent are excluded for privacy protection
}

interface UseActivityLogsOptions {
  limit?: number;
  page?: number;
  actionType?: string;
  entityType?: string;
  startDate?: Date;
  endDate?: Date;
}

interface ActivityLogsResult {
  logs: ActivityLog[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export function useActivityLogs(options: UseActivityLogsOptions = {}) {
  const { limit = 20, page = 1, actionType, entityType, startDate, endDate } = options;

  return useQuery({
    queryKey: ['activity-logs', { limit, page, actionType, entityType, startDate: startDate?.toISOString(), endDate: endDate?.toISOString() }],
    queryFn: async (): Promise<ActivityLogsResult> => {
      // First, get total count with filters
      let countQuery = supabase
        .from('activity_logs_safe' as any)
        .select('*', { count: 'exact', head: true });

      if (actionType) {
        countQuery = countQuery.eq('action_type', actionType);
      }

      if (entityType) {
        countQuery = countQuery.eq('entity_type', entityType);
      }

      if (startDate) {
        countQuery = countQuery.gte('created_at', startDate.toISOString());
      }

      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        countQuery = countQuery.lte('created_at', endOfDay.toISOString());
      }

      const { count, error: countError } = await countQuery;

      if (countError) {
        throw countError;
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / limit);
      const offset = (page - 1) * limit;

      // Use the safe view that excludes sensitive columns (ip_address, user_agent)
      let query = supabase
        .from('activity_logs_safe' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (actionType) {
        query = query.eq('action_type', actionType);
      }

      if (entityType) {
        query = query.eq('entity_type', entityType);
      }

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }

      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endOfDay.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const logs = ((data as any[]) || []).map((log): ActivityLog => ({
        id: log.id,
        userId: log.user_id,
        actionType: log.action_type,
        entityType: log.entity_type,
        entityId: log.entity_id,
        description: log.description,
        metadata: log.metadata as Record<string, unknown> | null,
        createdAt: log.created_at,
      }));

      return {
        logs,
        totalCount,
        totalPages,
        currentPage: page,
      };
    },
  });
}

export function useRecentActivity(limit: number = 10) {
  const result = useActivityLogs({ limit, page: 1 });
  return {
    ...result,
    data: result.data?.logs,
  };
}
