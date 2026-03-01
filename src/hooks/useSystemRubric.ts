/**
 * Hooks for managing system rubrics
 * Note: Rubric versioning has been removed for simplicity. 
 * If needed later, see migration: 20260229000000_add_rubric_versioning.sql
 */
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import type { SystemRubric } from '@/types/reviewer';

// Get system rubric (simplified - no versioning)
export const useSystemRubric = () => {
  return useQuery({
    queryKey: ['system-rubric'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_rubric')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;
      
      return {
        id: data.id,
        rubric: data.rubric as SystemRubric['rubric'],
        created_at: data.created_at,
        updated_at: data.updated_at,
      } as SystemRubric;
    },
  });
};

// Get all rubric versions (for admin history view)
export const useRubricVersions = () => {
  return useQuery({
    queryKey: ['rubric-versions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rubric_versions' as any)
        .select('*')
        .order('version', { ascending: false });
      
      if (error) throw error;
      return (data || []) as any[];
    },
  });
};

