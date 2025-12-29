import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Database } from '@/integrations/supabase/types';

type Doctor = Database['public']['Tables']['doctor']['Row'];

/**
 * Hook to manage the doctor profile linked to the authenticated user.
 * Handles fetching, creating, and linking doctor profiles to auth users.
 */
export function useDoctorProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch the doctor profile for the current authenticated user
  const { 
    data: doctor, 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['doctor', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('doctor')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Mutation to create a new doctor profile linked to the current user
  const createDoctorProfile = useMutation({
    mutationFn: async (data: Partial<Omit<Doctor, 'id' | 'user_id'>>) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data: newDoctor, error } = await supabase
        .from('doctor')
        .insert([{
          first_name: data.first_name || 'Doctor',
          last_name: data.last_name || '',
          user_id: user.id,
          ...data,
        }])
        .select()
        .single();

      if (error) throw error;
      return newDoctor;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor', user?.id] });
    },
  });

  // Mutation to update an existing doctor profile
  const updateDoctorProfile = useMutation({
    mutationFn: async (data: Partial<Doctor>) => {
      if (!doctor?.id) throw new Error('Doctor profile not found');

      const { error } = await supabase
        .from('doctor')
        .update(data)
        .eq('id', doctor.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor', user?.id] });
    },
  });

  return {
    doctor,
    isLoading,
    error,
    refetch,
    createDoctorProfile,
    updateDoctorProfile,
    hasProfile: !!doctor,
    userId: user?.id,
  };
}
