import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useActivityLogger } from '@/hooks/useActivityLogger';

export interface Mentor {
  id: number;
  name: string;
  bio: string | null;
  expertise_areas: string[];
  sector: string | null;
  country: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  website_url: string | null;
  avatar_url: string | null;
  is_published: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export type NewMentor = Omit<Mentor, 'id' | 'created_at' | 'updated_at'>;

// Fetch published mentors for public page
export function useMentors() {
  return useQuery({
    queryKey: ['mentors', 'published'],
    queryFn: async () => {
      console.log('Fetching mentors...');
      const { data, error } = await (supabase
        .from('mentors')
        .select('*')
        .eq('is_published', true)
        .order('display_order', { ascending: true }) as any);

      console.log('Mentors response:', { data, error });
      if (error) {
        console.error('Mentors fetch error:', error);
        throw error;
      }
      return data as Mentor[];
    },
  });
}

// Fetch all mentors for admin
export function useAdminMentors() {
  return useQuery({
    queryKey: ['mentors', 'admin'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('mentors')
        .select('*')
        .order('display_order', { ascending: true }) as any);

      if (error) throw error;
      return data as Mentor[];
    },
  });
}

// Fetch single mentor
export function useMentor(id: number | undefined) {
  return useQuery({
    queryKey: ['mentors', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await (supabase
        .from('mentors')
        .select('*')
        .eq('id', id)
        .single() as any);

      if (error) throw error;
      return data as Mentor;
    },
    enabled: !!id,
  });
}

// Create mentor
export function useCreateMentor() {
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLogger();

  return useMutation({
    mutationFn: async (mentor: Partial<NewMentor>) => {
      const { data: user } = await supabase.auth.getUser();
      const mentorData = {
        name: mentor.name!,
        bio: mentor.bio,
        expertise_areas: mentor.expertise_areas,
        sector: mentor.sector,
        country: mentor.country,
        linkedin_url: mentor.linkedin_url,
        twitter_url: mentor.twitter_url,
        website_url: mentor.website_url,
        avatar_url: mentor.avatar_url,
        is_published: mentor.is_published,
        display_order: mentor.display_order,
        created_by: user.user?.id,
      };
      const { data, error } = await (supabase
        .from('mentors')
        .insert(mentorData)
        .select()
        .single() as any);

      if (error) throw error;
      return data as Mentor;
    },
    onSuccess: (mentor) => {
      queryClient.invalidateQueries({ queryKey: ['mentors'] });
      logActivity({
        actionType: 'create',
        entityType: 'profile',
        entityId: String(mentor.id),
        description: `Created mentor: ${mentor.name}`,
        metadata: { name: mentor.name, sector: mentor.sector },
      });
      toast.success('Mentor created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create mentor: ' + error.message);
    },
  });
}

// Update mentor
export function useUpdateMentor() {
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLogger();

  return useMutation({
    mutationFn: async ({ id, ...mentor }: Partial<Mentor> & { id: number }) => {
      const { data, error } = await (supabase
        .from('mentors')
        .update(mentor)
        .eq('id', id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as Mentor;
    },
    onSuccess: (mentor) => {
      queryClient.invalidateQueries({ queryKey: ['mentors'] });
      logActivity({
        actionType: 'update',
        entityType: 'profile',
        entityId: String(mentor.id),
        description: `Updated mentor: ${mentor.name}`,
        metadata: { name: mentor.name },
      });
      toast.success('Mentor updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update mentor: ' + error.message);
    },
  });
}

// Delete mentor
export function useDeleteMentor() {
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLogger();

  return useMutation({
    mutationFn: async (id: number) => {
      // Fetch mentor name before deleting for logging
      const { data: mentor } = await (supabase
        .from('mentors')
        .select('name')
        .eq('id', id)
        .single() as any);
      
      const { error } = await (supabase.from('mentors').delete().eq('id', id) as any);
      if (error) throw error;
      return { id, name: mentor?.name || 'Unknown' };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['mentors'] });
      logActivity({
        actionType: 'delete',
        entityType: 'profile',
        entityId: String(data.id),
        description: `Deleted mentor: ${data.name}`,
        metadata: { name: data.name },
      });
      toast.success('Mentor deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete mentor: ' + error.message);
    },
  });
}

// Toggle mentor published status
export function useToggleMentorPublished() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_published }: { id: number; is_published: boolean }) => {
      const { data, error } = await (supabase
        .from('mentors')
        .update({ is_published })
        .eq('id', id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as Mentor;
    },
    onSuccess: (data: Mentor) => {
      queryClient.invalidateQueries({ queryKey: ['mentors'] });
      toast.success(data.is_published ? 'Mentor published' : 'Mentor unpublished');
    },
    onError: (error: any) => {
      toast.error('Failed to update mentor: ' + error.message);
    },
  });
}
