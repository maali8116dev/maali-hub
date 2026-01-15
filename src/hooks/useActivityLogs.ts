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
}

export function useActivityLogs(options: UseActivityLogsOptions = {}) {
  const { limit = 50, actionType, entityType } = options;

  return useQuery({
    queryKey: ['activity-logs', { limit, actionType, entityType }],
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
