import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';

interface Doctor {
  id: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  interfaceLanguage: 'ARM' | 'RU' | null;
  workDays: string[] | null;
  workDayStartTime: string | null;
  workDayEndTime: string | null;
  slotStepMinutes: number | null;
  telegramBotToken: string | null;
  telegramChatId: string | null;
  googleCalendarId: string | null;
  googleSheetId: string | null;
  aiEnabled: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export function useDoctorProfile() {
  const { user, doctor: authDoctor } = useAuth();
  const qc = useQueryClient();

  const { 
    data: doctor, 
    isLoading, 
    error,
    refetch 
  } = useQuery<Doctor | null>({
    queryKey: ['/api/doctor'],
    enabled: !!user?.id,
  });

  const updateDoctorProfile = useMutation({
    mutationFn: async (data: Partial<Doctor>) => {
      const doc = doctor || authDoctor;
      if (!doc?.id) throw new Error('Doctor profile not found');
      
      const res = await apiRequest('PATCH', `/api/doctor/${doc.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/doctor'] });
    },
  });

  return {
    doctor: doctor || authDoctor,
    isLoading,
    error,
    refetch,
    updateDoctorProfile,
    hasProfile: !!(doctor || authDoctor),
    userId: user?.id,
  };
}
