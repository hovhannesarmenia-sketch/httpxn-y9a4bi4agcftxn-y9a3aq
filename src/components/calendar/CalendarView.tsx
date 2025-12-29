import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Clock, User, Plus, CalendarOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { ru, hy } from 'date-fns/locale';
import { AppointmentDialog } from './AppointmentDialog';
import { ManualBookingDialog } from './ManualBookingDialog';
import { BlockedDaysManager } from './BlockedDaysManager';

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

type BlockedDay = {
  id: string;
  blocked_date: string;
  reason: string | null;
};

export function CalendarView() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blockedDays, setBlockedDays] = useState<BlockedDay[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  
  // Multi-select for blocking days
  const [selectedDatesForBlocking, setSelectedDatesForBlocking] = useState<Date[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  const locale = language === 'ARM' ? hy : ru;

  // Create a set of blocked date strings for quick lookup
  const blockedDatesSet = new Set(blockedDays.map(bd => bd.blocked_date));

  // Fetch doctor linked to current user
  const fetchDoctor = useCallback(async () => {
    if (!user?.id) return null;
    const { data } = await supabase
      .from('doctor')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      setDoctorId(data.id);
    }
    return data;
  }, [user?.id]);

  const fetchAppointments = useCallback(async () => {
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
  }, [currentMonth]);

  const fetchBlockedDays = useCallback(async () => {
    if (!doctorId) return;

    const { data, error } = await supabase
      .from('blocked_days')
      .select('id, blocked_date, reason')
      .eq('doctor_id', doctorId);

    if (!error && data) {
      setBlockedDays(data);
    }
  }, [doctorId]);

  useEffect(() => {
    fetchDoctor();
  }, [fetchDoctor]);

  useEffect(() => {
    if (doctorId) {
      fetchAppointments();
      fetchBlockedDays();
    }

    const appointmentsChannel = supabase
      .channel('appointments-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => fetchAppointments()
      )
      .subscribe();

    const blockedDaysChannel = supabase
      .channel('blocked-days-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'blocked_days' },
        () => fetchBlockedDays()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(appointmentsChannel);
      supabase.removeChannel(blockedDaysChannel);
    };
  }, [doctorId, currentMonth, fetchAppointments, fetchBlockedDays, fetchDoctor]);

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

  const isDateBlocked = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return blockedDatesSet.has(dateStr);
  };

  const getBlockedDayInfo = (date: Date): BlockedDay | undefined => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return blockedDays.find(bd => bd.blocked_date === dateStr);
  };

  const handleDateClick = (date: Date, event: React.MouseEvent) => {
    // Check for Ctrl/Cmd key for multi-select
    if (event.ctrlKey || event.metaKey) {
      setIsMultiSelectMode(true);
      setSelectedDatesForBlocking(prev => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const isAlreadySelected = prev.some(d => format(d, 'yyyy-MM-dd') === dateStr);
        if (isAlreadySelected) {
          return prev.filter(d => format(d, 'yyyy-MM-dd') !== dateStr);
        }
        return [...prev, date];
      });
    } else if (isMultiSelectMode) {
      // If in multi-select mode but no ctrl, add to selection
      setSelectedDatesForBlocking(prev => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const isAlreadySelected = prev.some(d => format(d, 'yyyy-MM-dd') === dateStr);
        if (isAlreadySelected) {
          return prev.filter(d => format(d, 'yyyy-MM-dd') !== dateStr);
        }
        return [...prev, date];
      });
    } else {
      // Normal click - select single date
      setSelectedDate(date);
    }
  };

  const clearBlockingSelection = () => {
    setSelectedDatesForBlocking([]);
    setIsMultiSelectMode(false);
  };

  const isDateSelectedForBlocking = (date: Date) => {
    return selectedDatesForBlocking.some(d => isSameDay(d, date));
  };

  const dayAppointments = selectedDate ? getAppointmentsForDay(selectedDate) : [];
  const selectedDateBlockedInfo = selectedDate ? getBlockedDayInfo(selectedDate) : undefined;

  const handleAppointmentClick = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Blocked Days Manager - shows when dates are selected for blocking */}
      <BlockedDaysManager
        selectedDates={selectedDatesForBlocking}
        onClearSelection={clearBlockingSelection}
        onBlockedDaysChange={fetchBlockedDays}
        blockedDates={blockedDatesSet}
        onAppointmentsChange={fetchAppointments}
      />

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
            {/* Multi-select hint */}
            <p className="text-xs text-muted-foreground mb-3">
              {language === 'ARM' 
                ? 'Ctrl + \u057D\u0565\u0572\u0574\u0565\u056C\u0578\u057E \u056F\u0561\u0580\u0578\u0572 \u0565\u0584 \u0568\u0576\u057F\u0580\u0565\u056C \u0574\u056B \u0584\u0561\u0576\u056B \u0585\u0580' 
                : 'Ctrl + клик для выбора нескольких дней для блокировки'}
            </p>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 mb-2">
              {(language === 'ARM' 
                ? ['\u0535\u0580\u056F', '\u0535\u0580\u0584', '\u0549\u0580\u0584', '\u0540\u0576\u0563', '\u0548\u0582\u0580', '\u0547\u0562\u0569', '\u053F\u056B\u0580']
                : ['\u041F\u043D', '\u0412\u0442', '\u0421\u0440', '\u0427\u0442', '\u041F\u0442', '\u0421\u0431', '\u0412\u0441']
              ).map((day, i) => (
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
                const blocked = isDateBlocked(date);
                const selectedForBlocking = isDateSelectedForBlocking(date);

                return (
                  <button
                    key={date.toISOString()}
                    onClick={(e) => handleDateClick(date, e)}
                    className={cn(
                      'aspect-square p-1 rounded-lg transition-all relative group',
                      'hover:ring-2 hover:ring-primary/50',
                      !blocked && getAppointmentCountClass(confirmedCount),
                      selectedDate && isSameDay(date, selectedDate) && !selectedForBlocking && 'ring-2 ring-primary',
                      isToday(date) && 'font-bold',
                      !isSameMonth(date, currentMonth) && 'opacity-50',
                      blocked && 'bg-destructive/20 hover:bg-destructive/30',
                      selectedForBlocking && 'ring-2 ring-destructive bg-destructive/10'
                    )}
                  >
                    <span className={cn(
                      'text-sm',
                      isToday(date) && 'text-primary',
                      blocked && 'text-destructive'
                    )}>
                      {format(date, 'd')}
                    </span>
                    
                    {/* Blocked indicator */}
                    {blocked && (
                      <CalendarOff className="absolute top-0.5 right-0.5 h-3 w-3 text-destructive" />
                    )}
                    
                    {/* Appointment indicators */}
                    {!blocked && (confirmedCount > 0 || pendingCount > 0) && (
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">
                  {selectedDate ? format(selectedDate, 'd MMMM', { locale }) : t('calendar.title')}
                </CardTitle>
                {selectedDateBlockedInfo ? (
                  <div className="flex items-center gap-1 text-sm text-destructive mt-1">
                    <CalendarOff className="h-4 w-4" />
                    <span>
                      {language === 'ARM' ? '\u0555\u0580\u0568 \u0561\u0580\u0563\u0565\u056C\u0561\u0583\u0561\u056F\u057E\u0561\u056E \u0567' : 'День заблокирован'}
                      {selectedDateBlockedInfo.reason && `: ${selectedDateBlockedInfo.reason}`}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {dayAppointments.length} {t('calendar.appointments')}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => setBookingDialogOpen(true)}
                className="gap-1"
                disabled={selectedDateBlockedInfo !== undefined}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">{language === 'ARM' ? '\u0546\u0578\u0580' : 'Новая'}</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[500px] overflow-y-auto scrollbar-thin">
            {selectedDateBlockedInfo ? (
              <div className="text-center py-8">
                <CalendarOff className="h-12 w-12 text-destructive/50 mx-auto mb-2" />
                <p className="text-muted-foreground">
                  {language === 'ARM' 
                    ? '\u0531\u0575\u057D \u0585\u0580\u0568 \u0563\u0580\u0561\u0576\u0581\u0578\u0582\u0574 \u0570\u0576\u0561\u0580\u0561\u057E\u0578\u0580 \u0579\u0567' 
                    : 'В этот день запись недоступна'}
                </p>
              </div>
            ) : dayAppointments.length === 0 ? (
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

        {/* Manual Booking Dialog */}
        <ManualBookingDialog
          open={bookingDialogOpen}
          onOpenChange={setBookingDialogOpen}
          selectedDate={selectedDate}
          onSuccess={fetchAppointments}
        />
      </div>
    </div>
  );
}
