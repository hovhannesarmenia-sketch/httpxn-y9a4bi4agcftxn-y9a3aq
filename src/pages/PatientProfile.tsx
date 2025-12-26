import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, User, Phone, Globe, Calendar, Clock, MessageSquare, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ru, hy } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';

type Patient = Database['public']['Tables']['patients']['Row'];
type Appointment = Database['public']['Tables']['appointments']['Row'] & {
  services: { name_arm: string; name_ru: string } | null;
};

function PatientProfileContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const locale = language === 'ARM' ? hy : ru;

  const { data: patient, isLoading: patientLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data as Patient | null;
    },
    enabled: !!id,
  });

  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery({
    queryKey: ['patient-appointments', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          services (name_arm, name_ru)
        `)
        .eq('patient_id', id)
        .order('start_date_time', { ascending: false });
      
      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!id,
  });

  const isLoading = patientLoading || appointmentsLoading;

  const getServiceName = (service: { name_arm: string; name_ru: string } | null) => {
    if (!service) return '-';
    return language === 'ARM' ? service.name_arm : service.name_ru;
  };

  const getLanguageLabel = (lang: string | null) => {
    if (lang === 'ARM') return language === 'ARM' ? 'Հայdelays' : 'Армянский';
    return language === 'ARM' ? 'Rrdelays' : 'Русский';
  };

  const getStatusStats = () => {
    const confirmed = appointments.filter(a => a.status === 'CONFIRMED').length;
    const pending = appointments.filter(a => a.status === 'PENDING').length;
    const cancelled = appointments.filter(a => a.status === 'REJECTED' || a.status === 'CANCELLED_BY_DOCTOR').length;
    return { confirmed, pending, cancelled, total: appointments.length };
  };

  const stats = getStatusStats();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">
              {language === 'ARM' ? 'Пdelays չdelays' : 'Пациент не найден'}
            </h2>
            <Button onClick={() => navigate('/')} variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {language === 'ARM' ? 'Delays' : 'Назад'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8" style={{ background: 'var(--gradient-page)' }}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button onClick={() => navigate('/')} variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {patient.first_name} {patient.last_name || ''}
            </h1>
            <p className="text-muted-foreground">
              {language === 'ARM' ? 'Пdelays պdelays' : 'Профиль пациента'}
            </p>
          </div>
        </div>

        {/* Patient Info Card */}
        <Card className="medical-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              {language === 'ARM' ? 'Кdelays delays' : 'Контактная информация'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <div className="p-2 rounded-lg bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{language === 'ARM' ? 'Аdelays delays' : 'Полное имя'}</p>
                  <p className="font-medium">{patient.first_name} {patient.last_name || ''}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{language === 'ARM' ? 'Delays' : 'Телефон'}</p>
                  <p className="font-medium">{patient.phone_number || '-'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{language === 'ARM' ? 'Delays' : 'Язык'}</p>
                  <p className="font-medium">{getLanguageLabel(patient.language)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <div className="p-2 rounded-lg bg-primary/10">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Telegram ID</p>
                  <p className="font-medium font-mono text-sm">
                    {patient.telegram_user_id > 0 ? patient.telegram_user_id : (language === 'ARM' ? 'Delays delays' : 'Ручная запись')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{language === 'ARM' ? 'Delays delays' : 'Дата регистрации'}</p>
                  <p className="font-medium">
                    {patient.created_at ? format(new Date(patient.created_at), 'd MMM yyyy', { locale }) : '-'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="medical-card">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-foreground">{stats.total}</p>
              <p className="text-sm text-muted-foreground">{language === 'ARM' ? 'Delays delays' : 'Всего записей'}</p>
            </CardContent>
          </Card>
          <Card className="medical-card">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-success">{stats.confirmed}</p>
              <p className="text-sm text-muted-foreground">{language === 'ARM' ? 'Delays' : 'Подтверждено'}</p>
            </CardContent>
          </Card>
          <Card className="medical-card">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-pending">{stats.pending}</p>
              <p className="text-sm text-muted-foreground">{language === 'ARM' ? 'Delays' : 'Ожидает'}</p>
            </CardContent>
          </Card>
          <Card className="medical-card">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-destructive">{stats.cancelled}</p>
              <p className="text-sm text-muted-foreground">{language === 'ARM' ? 'Delays' : 'Отменено'}</p>
            </CardContent>
          </Card>
        </div>

        {/* Appointment History */}
        <Card className="medical-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {language === 'ARM' ? 'Delays delays' : 'История записей'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {language === 'ARM' ? 'Delays delays' : 'Записей пока нет'}
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>{language === 'ARM' ? 'Delays' : 'Дата'}</TableHead>
                      <TableHead>{language === 'ARM' ? 'Delays' : 'Время'}</TableHead>
                      <TableHead className="hidden md:table-cell">{language === 'ARM' ? 'Delays' : 'Услуга'}</TableHead>
                      <TableHead>{language === 'ARM' ? 'Delays' : 'Длит.'}</TableHead>
                      <TableHead>{language === 'ARM' ? 'Delays' : 'Статус'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appointments.map((apt) => {
                      const startDate = new Date(apt.start_date_time);
                      const isPast = startDate < new Date();
                      
                      return (
                        <TableRow key={apt.id} className={isPast ? 'opacity-60' : ''}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {format(startDate, 'd MMM yyyy', { locale })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {format(startDate, 'HH:mm')}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {apt.custom_reason || getServiceName(apt.services)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {apt.duration_minutes} {language === 'ARM' ? 'delays' : 'мин'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={apt.status || 'PENDING'} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const PatientProfile = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <LanguageProvider>
      <PatientProfileContent />
    </LanguageProvider>
  );
};

export default PatientProfile;
