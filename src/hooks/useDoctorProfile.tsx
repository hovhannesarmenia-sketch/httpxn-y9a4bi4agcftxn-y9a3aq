import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Database } from '@/integrations/supabase/types';

type Doctor = Database['public']['Tables']['doctor']['Row'];
// Type for the doctor_safe view that excludes sensitive credentials
type DoctorSafe = Database['public']['Views']['doctor_safe']['Row'];

/**
 * Hook to manage the doctor profile linked to the authenticated user.
 * Handles fetching, creating, and linking doctor profiles to auth users.
 * Uses doctor_safe view for reading to avoid exposing sensitive credentials.
 */
export function useDoctorProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch the doctor profile for the current authenticated user
  // Uses doctor_safe view to avoid exposing sensitive credentials to browser
  const { 
    data: doctor, 
    isLoading, 
    error,
    refetch 
  } = useQuery<DoctorSafe | null>({
    queryKey: ['doctor_safe', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Use doctor_safe view - excludes sensitive columns like llm_api_key, telegram_bot_token
      const { data, error } = await supabase
        .from('doctor_safe')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as DoctorSafe | null;
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
