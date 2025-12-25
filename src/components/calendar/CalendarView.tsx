import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { ru, hy } from 'date-fns/locale';
import { AppointmentDialog } from './AppointmentDialog';

type Appointment = {
  id: string;
  start_date_time: string;
  duration_minutes: number;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED_BY_DOCTOR';
  custom_reason: string | null;
  patients: {
    first_name: string;
    last_name: string | null;
    phone_number: string | null;
  } | null;
  services: {
    name_arm: string;
    name_ru: string;
  } | null;
};

export function CalendarView() {
  const { t, language } = useLanguage();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const locale = language === 'ARM' ? hy : ru;

  useEffect(() => {
    fetchAppointments();

    const channel = supabase
      .channel('appointments-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => fetchAppointments()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentMonth]);

  const fetchAppointments = async () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);

    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id,
        start_date_time,
        duration_minutes,
        status,
        custom_reason,
        patients (
          first_name,
          last_name,
          phone_number
        ),
        services (
          name_arm,
          name_ru
        )
      `)
      .gte('start_date_time', start.toISOString())
      .lte('start_date_time', end.toISOString())
      .order('start_date_time', { ascending: true });

    if (!error && data) {
      setAppointments(data as Appointment[]);
    }
  };

  const getDaysInMonth = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  };

  const getAppointmentsForDay = (date: Date) => {
    return appointments.filter((apt) =>
      isSameDay(new Date(apt.start_date_time), date)
    );
  };

  const getAppointmentCountClass = (count: number) => {
    if (count === 0) return '';
    if (count <= 2) return 'calendar-day-busy-1';
    if (count <= 4) return 'calendar-day-busy-2';
    return 'calendar-day-busy-3';
  };

  const dayAppointments = selectedDate ? getAppointmentsForDay(selectedDate) : [];

  const handleAppointmentClick = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setDialogOpen(true);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Calendar */}
      <Card className="xl:col-span-2 medical-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xl font-semibold">
            {format(currentMonth, 'LLLL yyyy', { locale })}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCurrentMonth(new Date());
                setSelectedDate(new Date());
              }}
            >
              {t('calendar.today')}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 mb-2">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day, i) => (
              <div
                key={i}
                className="text-center text-sm font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for days before start of month */}
            {Array.from({ length: (startOfMonth(currentMonth).getDay() + 6) % 7 }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {getDaysInMonth().map((date) => {
              const dayAppointments = getAppointmentsForDay(date);
              const confirmedCount = dayAppointments.filter(
                (a) => a.status === 'CONFIRMED'
              ).length;
              const pendingCount = dayAppointments.filter(
                (a) => a.status === 'PENDING'
              ).length;

              return (
                <button
                  key={date.toISOString()}
                  onClick={() => setSelectedDate(date)}
                  className={cn(
                    'aspect-square p-1 rounded-lg transition-all relative group',
                    'hover:ring-2 hover:ring-primary/50',
                    getAppointmentCountClass(confirmedCount),
                    selectedDate && isSameDay(date, selectedDate) && 'ring-2 ring-primary',
                    isToday(date) && 'font-bold',
                    !isSameMonth(date, currentMonth) && 'opacity-50'
                  )}
                >
                  <span className={cn(
                    'text-sm',
                    isToday(date) && 'text-primary'
                  )}>
                    {format(date, 'd')}
                  </span>
                  {(confirmedCount > 0 || pendingCount > 0) && (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                      {confirmedCount > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-success" />
                      )}
                      {pendingCount > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-pending animate-pulse-gentle" />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Day Appointments */}
      <Card className="medical-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">
            {selectedDate ? format(selectedDate, 'd MMMM', { locale }) : t('calendar.title')}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {dayAppointments.length} {t('calendar.appointments')}
          </p>
        </CardHeader>
        <CardContent className="space-y-3 max-h-[500px] overflow-y-auto scrollbar-thin">
          {dayAppointments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {t('calendar.noAppointments')}
            </p>
          ) : (
            dayAppointments.map((apt) => (
              <button
                key={apt.id}
                onClick={() => handleAppointmentClick(apt)}
                className="w-full text-left p-3 rounded-lg border bg-card hover:shadow-md transition-all animate-fade-in"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="h-4 w-4 text-primary" />
                    {format(new Date(apt.start_date_time), 'HH:mm')}
                    <span className="text-muted-foreground">
                      ({apt.duration_minutes} {t('appointment.minutes')})
                    </span>
                  </div>
                  <StatusBadge status={apt.status} />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {apt.patients?.first_name} {apt.patients?.last_name}
                  </span>
                </div>
                {apt.services && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === 'ARM' ? apt.services.name_arm : apt.services.name_ru}
                  </p>
                )}
                {apt.custom_reason && (
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    {apt.custom_reason}
                  </p>
                )}
              </button>
            ))
          )}
        </CardContent>
      </Card>

      {/* Appointment Dialog */}
      <AppointmentDialog
        appointment={selectedAppointment}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onUpdate={fetchAppointments}
      />
    </div>
  );
}
