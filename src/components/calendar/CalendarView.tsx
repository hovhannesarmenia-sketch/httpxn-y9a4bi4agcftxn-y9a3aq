import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Clock, User, Plus, CalendarOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { ru, hy } from 'date-fns/locale';
import { AppointmentDialog } from './AppointmentDialog';
import { ManualBookingDialog } from './ManualBookingDialog';
import { BlockedDaysManager } from './BlockedDaysManager';

type Appointment = {
  id: string;
  startDateTime: string;
  durationMinutes: number;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED_BY_DOCTOR';
  customReason: string | null;
  patient?: {
    firstName: string;
    lastName: string | null;
    phoneNumber: string | null;
  } | null;
  service?: {
    nameArm: string;
    nameRu: string;
  } | null;
};

type BlockedDay = {
  id: string;
  blockedDate: string;
  reason: string | null;
};

export function CalendarView() {
  const { t, language } = useLanguage();
  const { doctor } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blockedDays, setBlockedDays] = useState<BlockedDay[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [selectedDatesForBlocking, setSelectedDatesForBlocking] = useState<Date[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  const locale = language === 'ARM' ? hy : ru;

  const blockedDatesSet = new Set(blockedDays.map(bd => bd.blockedDate));

  const fetchAppointments = useCallback(async () => {
    try {
      const res = await fetch('/api/appointments', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAppointments(data);
      }
    } catch (error) {
      console.error('Failed to fetch appointments:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBlockedDays = useCallback(async () => {
    try {
      const res = await fetch('/api/blocked-days', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setBlockedDays(data);
      }
    } catch (error) {
      console.error('Failed to fetch blocked days:', error);
    }
  }, []);

  useEffect(() => {
    if (doctor) {
      fetchAppointments();
      fetchBlockedDays();
    }
  }, [doctor, fetchAppointments, fetchBlockedDays]);

  const getDaysInMonth = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  };

  const getAppointmentsForDay = (date: Date) => {
    return appointments.filter((apt) =>
      isSameDay(new Date(apt.startDateTime), date)
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
    return blockedDays.find(bd => bd.blockedDate === dateStr);
  };

  const handleDateClick = (date: Date, event: React.MouseEvent) => {
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
      setSelectedDatesForBlocking(prev => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const isAlreadySelected = prev.some(d => format(d, 'yyyy-MM-dd') === dateStr);
        if (isAlreadySelected) {
          return prev.filter(d => format(d, 'yyyy-MM-dd') !== dateStr);
        }
        return [...prev, date];
      });
    } else {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BlockedDaysManager
        selectedDates={selectedDatesForBlocking}
        onClearSelection={clearBlockingSelection}
        onBlockedDaysChange={fetchBlockedDays}
        blockedDates={blockedDatesSet}
        onAppointmentsChange={fetchAppointments}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
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
                data-testid="button-prev-month"
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
                data-testid="button-today"
              >
                {t('calendar.today')}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                data-testid="button-next-month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              {language === 'ARM' 
                ? 'Ctrl + սdelays կdelays այdelays օdelays' 
                : 'Ctrl + клик для выбора нескольких дней для блокировки'}
            </p>

            <div className="grid grid-cols-7 mb-2">
              {(language === 'ARM' 
                ? ['Երdelays', 'Delays', 'Delays', 'Delays', 'Delays', 'Delays', 'Delays']
                : ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
              ).map((day, i) => (
                <div
                  key={i}
                  className="text-center text-sm font-medium text-muted-foreground py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
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
                    data-testid={`calendar-day-${format(date, 'yyyy-MM-dd')}`}
                  >
                    <span className={cn(
                      'text-sm',
                      isToday(date) && 'text-primary',
                      blocked && 'text-destructive'
                    )}>
                      {format(date, 'd')}
                    </span>
                    
                    {blocked && (
                      <CalendarOff className="absolute top-0.5 right-0.5 h-3 w-3 text-destructive" />
                    )}
                    
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
                      {language === 'ARM' ? 'Օdelays աdelays' : 'День заблокирован'}
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
                data-testid="button-new-appointment"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">{language === 'ARM' ? 'Նdelays' : 'Новая'}</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[500px] overflow-y-auto scrollbar-thin">
            {selectedDateBlockedInfo ? (
              <div className="text-center py-8">
                <CalendarOff className="h-12 w-12 text-destructive/50 mx-auto mb-2" />
                <p className="text-muted-foreground">
                  {language === 'ARM' 
                    ? 'Aйdelays оdelays гdelays delays' 
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
                  data-testid={`appointment-${apt.id}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Clock className="h-4 w-4 text-primary" />
                      {format(new Date(apt.startDateTime), 'HH:mm')}
                      <span className="text-muted-foreground">
                        ({apt.durationMinutes} {t('appointment.minutes')})
                      </span>
                    </div>
                    <StatusBadge status={apt.status} />
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {apt.patient?.firstName} {apt.patient?.lastName}
                    </span>
                  </div>
                  {apt.service && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {language === 'ARM' ? apt.service.nameArm : apt.service.nameRu}
                    </p>
                  )}
                  {apt.customReason && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      {apt.customReason}
                    </p>
                  )}
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <AppointmentDialog
          appointment={selectedAppointment}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onUpdate={fetchAppointments}
        />

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
