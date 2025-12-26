import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { t, formatDate, formatTime } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Users, Phone, Globe, Calendar as CalendarIcon, ExternalLink } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Patient = Database['public']['Tables']['patients']['Row'];
type Appointment = Database['public']['Tables']['appointments']['Row'] & {
  patients: Patient | null;
  services: { name_arm: string; name_ru: string } | null;
};

export function PatientsView() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments-with-patients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          patients (*),
          services (name_arm, name_ru)
        `)
        .order('start_date_time', { ascending: false });
      
      if (error) throw error;
      return data as Appointment[];
    },
  });

  const { data: patients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Patient[];
    },
  });

  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      const patient = apt.patients;
      if (!patient) return false;

      const matchesSearch = search === '' || 
        patient.first_name.toLowerCase().includes(search.toLowerCase()) ||
        (patient.last_name?.toLowerCase().includes(search.toLowerCase())) ||
        (patient.phone_number?.includes(search));

      const matchesStatus = statusFilter === 'all' || apt.status === statusFilter;

      const matchesDate = !dateFilter || 
        apt.start_date_time.startsWith(dateFilter);

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [appointments, search, statusFilter, dateFilter]);

  const getServiceName = (service: { name_arm: string; name_ru: string } | null) => {
    if (!service) return '-';
    return language === 'ARM' ? service.name_arm : service.name_ru;
  };

  const getPatientLanguage = (lang: string | null) => {
    if (lang === 'ARM') return language === 'ARM' ? 'Հdelays' : 'Армянский';
    return language === 'ARM' ? 'Rrdelays' : 'Русский';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="medical-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t(language, 'patients.total')}</p>
                <p className="text-2xl font-bold">{patients.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="medical-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-medical-success/10">
                <CalendarIcon className="h-6 w-6 text-medical-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t(language, 'appointment.confirmed')}</p>
                <p className="text-2xl font-bold">
                  {appointments.filter(a => a.status === 'CONFIRMED').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="medical-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-medical-warning/10">
                <CalendarIcon className="h-6 w-6 text-medical-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t(language, 'appointment.pending')}</p>
                <p className="text-2xl font-bold">
                  {appointments.filter(a => a.status === 'PENDING').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="medical-card">
        <CardHeader>
          <CardTitle className="text-lg">{t(language, 'patients.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t(language, 'common.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder={t(language, 'common.filter')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t(language, 'common.filter')}</SelectItem>
                <SelectItem value="PENDING">{t(language, 'appointment.pending')}</SelectItem>
                <SelectItem value="CONFIRMED">{t(language, 'appointment.confirmed')}</SelectItem>
                <SelectItem value="REJECTED">{t(language, 'appointment.rejected')}</SelectItem>
                <SelectItem value="CANCELLED_BY_DOCTOR">{t(language, 'appointment.cancelled')}</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full md:w-[180px]"
            />
          </div>

          {/* Table */}
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>{t(language, 'patients.name')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t(language, 'patients.phone')}</TableHead>
                  <TableHead>{t(language, 'appointment.service')}</TableHead>
                  <TableHead>{t(language, 'appointment.date')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t(language, 'appointment.time')}</TableHead>
                  <TableHead>{t(language, 'appointment.duration')}</TableHead>
                  <TableHead>{t(language, 'common.filter')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAppointments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {t(language, 'patients.noPatients')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAppointments.map((apt) => {
                    const patient = apt.patients;
                    const startDate = new Date(apt.start_date_time);
                    
                    return (
                      <TableRow 
                        key={apt.id} 
                        className="hover:bg-muted/30 cursor-pointer"
                        onClick={() => patient && navigate(`/patient/${patient.id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-xs font-medium text-primary">
                                {patient?.first_name?.[0]}{patient?.last_name?.[0] || ''}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium flex items-center gap-1">
                                {patient?.first_name} {patient?.last_name || ''}
                                <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                              </p>
                              <div className="flex items-center gap-1 md:hidden">
                                <Phone className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {patient?.phone_number || '-'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            {patient?.phone_number || '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {apt.custom_reason || getServiceName(apt.services)}
                        </TableCell>
                        <TableCell>
                          {formatDate(startDate, language)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {formatTime(startDate, language)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {apt.duration_minutes} {t(language, 'appointment.minutes')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={apt.status || 'PENDING'} />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
