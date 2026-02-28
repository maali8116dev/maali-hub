/**
 * Hooks for managing system rubrics and rubric versions
 */
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import type { SystemRubric } from '@/types/reviewer';

// Get active rubric version (for current reviews)
export const useSystemRubric = () => {
  return useQuery({
    queryKey: ['system-rubric', 'active'],
    queryFn: async () => {
      // Get active rubric version
      const { data: activeVersion, error: versionError } = await supabase
        .from('rubric_versions' as any)
        .select('*')
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (versionError) throw versionError;
      if (!activeVersion) {
        // Fallback to system_rubric for backward compatibility
        const { data, error } = await supabase
          .from('system_rubric')
          .select('*')
          .eq('id', '00000000-0000-0000-0000-000000000001')
          .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        if (!data) return null;
        
        return {
          id: data.id,
          version: 1,
          rubric: data.rubric as SystemRubric['rubric'],
          is_active: true,
          created_at: data.created_at,
          updated_at: data.updated_at,
        } as SystemRubric & { version: number };
      }
      
      const version = activeVersion as any;
      return {
        id: version.id,
        version: version.version,
        rubric: version.rubric as SystemRubric['rubric'],
        is_active: version.is_active,
        created_at: version.created_at,
        updated_at: version.created_at, // Use created_at as updated_at for versions
      } as SystemRubric & { version: number };
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

