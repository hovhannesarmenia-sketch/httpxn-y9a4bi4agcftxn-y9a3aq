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
    if (lang === 'ARM') return language === 'ARM' ? '\u0540\u0561\u0575\u0565\u0580\u0565\u0576' : '\u0410\u0440\u043C\u044F\u043D\u0441\u043A\u0438\u0439';
    return language === 'ARM' ? '\u054C\u0578\u0582\u057D\u0565\u0580\u0565\u0576' : '\u0420\u0443\u0441\u0441\u043A\u0438\u0439';
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
              {language === 'ARM' ? '\u0540\u056B\u057E\u0561\u0576\u0564\u0568 \u0579\u0563\u057F\u0576\u057E\u0565\u0581' : '\u041F\u0430\u0446\u0438\u0435\u043D\u0442 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D'}
            </h2>
            <Button onClick={() => navigate('/')} variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {language === 'ARM' ? '\u054E\u0565\u0580\u0561\u0564\u0561\u057C\u0576\u0561\u056C' : '\u041D\u0430\u0437\u0430\u0434'}
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
              {language === 'ARM' ? '\u0540\u056B\u057E\u0561\u0576\u0564\u056B \u057A\u0580\u0578\u0586\u056B\u056C' : '\u041F\u0440\u043E\u0444\u0438\u043B\u044C \u043F\u0430\u0446\u0438\u0435\u043D\u0442\u0430'}
            </p>
          </div>
        </div>

        {/* Patient Info Card */}
        <Card className="medical-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              {language === 'ARM' ? '\u053F\u0578\u0576\u057F\u0561\u056F\u057F\u0561\u0575\u056B\u0576 \u057F\u057E\u0575\u0561\u056C\u0576\u0565\u0580' : '\u041A\u043E\u043D\u0442\u0430\u043A\u0442\u043D\u0430\u044F \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044F'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <div className="p-2 rounded-lg bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{language === 'ARM' ? '\u0531\u0576\u0578\u0582\u0576 \u0531\u0566\u0563\u0561\u0576\u0578\u0582\u0576' : '\u041F\u043E\u043B\u043D\u043E\u0435 \u0438\u043C\u044F'}</p>
                  <p className="font-medium">{patient.first_name} {patient.last_name || ''}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{language === 'ARM' ? '\u0540\u0565\u057C\u0561\u056D\u0578\u057D' : '\u0422\u0435\u043B\u0435\u0444\u043E\u043D'}</p>
                  <p className="font-medium">{patient.phone_number || '-'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{language === 'ARM' ? '\u053C\u0565\u0566\u0578\u0582' : '\u042F\u0437\u044B\u043A'}</p>
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
                    {patient.telegram_user_id > 0 ? patient.telegram_user_id : (language === 'ARM' ? '\u0541\u0565\u057C\u0584\u0578\u057E \u0563\u0580\u0561\u0576\u0581\u0578\u0582\u0574' : '\u0420\u0443\u0447\u043D\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{language === 'ARM' ? '\u0533\u0580\u0561\u0576\u0581\u0574\u0561\u0576 \u0561\u0574\u057D\u0561\u0569\u056B\u057E' : '\u0414\u0430\u0442\u0430 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438'}</p>
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
              <p className="text-sm text-muted-foreground">{language === 'ARM' ? '\u0538\u0576\u0564\u0561\u0574\u0565\u0576\u0568 \u0563\u0580\u0561\u0576\u0581\u0578\u0582\u0574\u0576\u0565\u0580' : '\u0412\u0441\u0435\u0433\u043E \u0437\u0430\u043F\u0438\u0441\u0435\u0439'}</p>
            </CardContent>
          </Card>
          <Card className="medical-card">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-success">{stats.confirmed}</p>
              <p className="text-sm text-muted-foreground">{language === 'ARM' ? '\u0540\u0561\u057D\u057F\u0561\u057F\u057E\u0561\u056E' : '\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E'}</p>
            </CardContent>
          </Card>
          <Card className="medical-card">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-pending">{stats.pending}</p>
              <p className="text-sm text-muted-foreground">{language === 'ARM' ? '\u054D\u057A\u0561\u057D\u0574\u0561\u0576 \u0574\u0565\u057B' : '\u041E\u0436\u0438\u0434\u0430\u0435\u0442'}</p>
            </CardContent>
          </Card>
          <Card className="medical-card">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-destructive">{stats.cancelled}</p>
              <p className="text-sm text-muted-foreground">{language === 'ARM' ? '\u0549\u0565\u0572\u0561\u0580\u056F\u057E\u0561\u056E' : '\u041E\u0442\u043C\u0435\u043D\u0435\u043D\u043E'}</p>
            </CardContent>
          </Card>
        </div>

        {/* Appointment History */}
        <Card className="medical-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {language === 'ARM' ? '\u0533\u0580\u0561\u0576\u0581\u0578\u0582\u0574\u0576\u0565\u0580\u056B \u057A\u0561\u057F\u0574\u0578\u0582\u0569\u0575\u0578\u0582\u0576' : '\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u0437\u0430\u043F\u0438\u0441\u0435\u0439'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {language === 'ARM' ? '\u0533\u0580\u0561\u0576\u0581\u0578\u0582\u0574\u0576\u0565\u0580 \u0564\u0565\u057C \u0579\u056F\u0561\u0576' : '\u0417\u0430\u043F\u0438\u0441\u0435\u0439 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442'}
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>{language === 'ARM' ? '\u0531\u0574\u057D\u0561\u0569\u056B\u057E' : '\u0414\u0430\u0442\u0430'}</TableHead>
                      <TableHead>{language === 'ARM' ? '\u054A\u0561\u0574' : '\u0412\u0440\u0435\u043C\u044F'}</TableHead>
                      <TableHead className="hidden md:table-cell">{language === 'ARM' ? '\u053E\u0561\u057C\u0561\u0575\u0578\u0582\u0569\u0575\u0578\u0582\u0576' : '\u0423\u0441\u043B\u0443\u0433\u0430'}</TableHead>
                      <TableHead>{language === 'ARM' ? '\u054F\u0587\u0578\u0572\u0578\u0582\u0569\u0575\u0578\u0582\u0576' : '\u0414\u043B\u0438\u0442.'}</TableHead>
                      <TableHead>{language === 'ARM' ? '\u053F\u0561\u0580\u0563\u0561\u057E\u056B\u0573\u0561\u056F' : '\u0421\u0442\u0430\u0442\u0443\u0441'}</TableHead>
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
                              {apt.duration_minutes} {language === 'ARM' ? '\u0580\u0578\u057A\u0565' : '\u043C\u0438\u043D'}
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
