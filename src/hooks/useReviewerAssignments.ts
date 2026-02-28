/**
 * Hooks for managing reviewer assignments
 */
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import type {
  ApplicationAssignment,
  ReviewerCategory,
  ReviewerConflict,
  RpcAssignmentWithReviewerRow,
} from '@/types/reviewer';

// Assign reviewers to application (with workload balancing)
export const useAssignReviewers = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      applicationId, 
      numReviewers = 2 
    }: { 
      applicationId: string; 
      numReviewers?: number 
    }) => {
      const { data, error } = await supabase.rpc(
        'assign_reviewers_to_application',
        {
          p_application_id: applicationId,
          p_num_reviewers: numReviewers,
        }
      );
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['application-assignments', variables.applicationId] });
      queryClient.invalidateQueries({ queryKey: ['reviewer-workload'] });
    },
  });
};

// Get assignments for an application
export const useApplicationAssignments = (applicationId: string) => {
  const { user } = useAuth();
  const { data: userRole } = useUserRole();

  return useQuery({
    queryKey: ['application-assignments', applicationId, user?.id, userRole],
    queryFn: async () => {
      if (!applicationId) return [];

      // If user is a reviewer, query directly with RLS (reviewers can only see their own assignments)
      if (userRole === 'reviewer' && user?.id) {
        const { data, error } = await supabase
          .from('application_assignments')
          .select('*')
          .eq('application_id', applicationId)
          .eq('reviewer_id', user.id)
          .maybeSingle();
        
        if (error) throw error;
        if (!data) return [];
        
        return [{
          id: data.id,
          application_id: data.application_id,
          reviewer_id: data.reviewer_id,
          assigned_at: data.assigned_at,
          status: (data.status as ApplicationAssignment['status']) || 'pending',
        }] as ApplicationAssignment[];
      }

      // For admins, use the existing admin-only RPC to get all assignments with reviewer info
      const { data, error } = await supabase.rpc(
        'get_application_assignments_with_reviewers' as any,
        { p_application_id: applicationId }
      );
      
      if (error) throw error;
      const rows = (data || []) as RpcAssignmentWithReviewerRow[];

      return rows.map((row) => ({
        id: row.id,
        application_id: row.application_id,
        reviewer_id: row.reviewer_id,
        assigned_at: row.assigned_at,
        status: (row.status as ApplicationAssignment['status']) || 'pending',
        reviewer: row.reviewer_user_id
          ? {
              user_id: row.reviewer_user_id,
              first_name: row.reviewer_first_name || '',
              last_name: row.reviewer_last_name || '',
            }
          : undefined,
      })) as ApplicationAssignment[];
    },
    enabled: !!applicationId && !!user,
  });
};

// Get reviewer's assignments (only for submitted applications, excluding drafts)
export const useReviewerAssignments = (reviewerId?: string) => {
  return useQuery({
    queryKey: ['reviewer-assignments', reviewerId],
    queryFn: async () => {
      if (!reviewerId) return [];
      
      // Server-side join (assignment + application + category label) to avoid client joins
      const { data, error } = await supabase.rpc(
        'get_reviewer_assignments_with_application' as any,
        { p_reviewer_id: reviewerId }
      );
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!reviewerId,
  });
};

// Get reviewer workload (pending + in_progress count)
export const useReviewerWorkload = (reviewerId?: string) => {
  return useQuery({
    queryKey: ['reviewer-workload', reviewerId],
    queryFn: async () => {
      if (!reviewerId) return 0;
      
      const { data, error } = await supabase.rpc(
        'get_reviewer_workload',
        { p_reviewer_id: reviewerId }
      );
      
      if (error) throw error;
      return data as number;
    },
    enabled: !!reviewerId,
  });
};

// Get reviewer categories
export const useReviewerCategories = (reviewerId?: string) => {
  return useQuery({
    queryKey: ['reviewer-categories', reviewerId],
    queryFn: async () => {
      if (!reviewerId) return [];
      
      const { data, error } = await supabase
        .from('reviewer_categories')
        .select(`
          *,
          categories:category_id(name)
        `)
        .eq('reviewer_id', reviewerId);
      
      if (error) throw error;
      
      // Transform to include category name for backward compatibility and deduplicate
      const transformed = (data || []).map((item: any) => ({
        ...item,
        category: item.categories?.name || 'Unknown',
      })) as ReviewerCategory[];
      
      // Deduplicate by id to prevent duplicates
      const unique = Array.from(
        new Map(transformed.map(item => [item.id, item])).values()
      );
      
      // Sort by category name
      return unique.sort((a, b) => a.category.localeCompare(b.category));
    },
    enabled: !!reviewerId,
  });
};

// Update assignment status
export const useUpdateAssignmentStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      assignmentId,
      status,
    }: {
      assignmentId: string;
      status: 'pending' | 'in_progress' | 'completed' | 'declined';
    }) => {
      const { data, error } = await supabase
        .from('application_assignments')
        .update({ status })
        .eq('id', assignmentId)
        .select()
        .single();
      
      if (error) throw error;
      return data as ApplicationAssignment;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['application-assignments', data.application_id] });
      queryClient.invalidateQueries({ queryKey: ['reviewer-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['reviewer-workload'] });
    },
  });
};

// Add conflict of interest
export const useAddConflict = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      reviewerId,
      applicationId,
      conflictReason,
    }: {
      reviewerId: string;
      applicationId: string;
      conflictReason: string;
    }) => {
      const { data, error } = await supabase
        .from('reviewer_conflicts')
        .insert({
          reviewer_id: reviewerId,
          application_id: applicationId,
          conflict_reason: conflictReason,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as ReviewerConflict;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviewer-conflicts'] });
    },
  });
};

