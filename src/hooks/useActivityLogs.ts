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
  actionType?: string;
  entityType?: string;
  startDate?: Date;
  endDate?: Date;
}

export function useActivityLogs(options: UseActivityLogsOptions = {}) {
  const { limit = 50, actionType, entityType, startDate, endDate } = options;

  return useQuery({
    queryKey: ['activity-logs', { limit, actionType, entityType, startDate: startDate?.toISOString(), endDate: endDate?.toISOString() }],
    queryFn: async () => {
      // Use the safe view that excludes sensitive columns (ip_address, user_agent)
      let query = supabase
        .from('activity_logs_safe' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

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
        // Add one day to include the end date fully
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endOfDay.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return ((data as any[]) || []).map((log): ActivityLog => ({
        id: log.id,
        userId: log.user_id,
        actionType: log.action_type,
        entityType: log.entity_type,
        entityId: log.entity_id,
        description: log.description,
        metadata: log.metadata as Record<string, unknown> | null,
        createdAt: log.created_at,
      }));
    },
  });
}

export function useRecentActivity(limit: number = 10) {
  return useActivityLogs({ limit });
}
