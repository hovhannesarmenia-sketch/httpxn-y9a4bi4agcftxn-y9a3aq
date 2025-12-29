import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru, hy } from 'date-fns/locale';
import { CalendarOff, Unlock, XCircle, AlertTriangle } from 'lucide-react';

interface BlockedDaysManagerProps {
  selectedDates: Date[];
  onClearSelection: () => void;
  onBlockedDaysChange: () => void;
  blockedDates: Set<string>;
  onAppointmentsChange?: () => void;
}

type AppointmentToCancel = {
  id: string;
  start_date_time: string;
  patients: {
    first_name: string;
    last_name: string | null;
    telegram_user_id: number | null;
  } | null;
  services: {
    name_arm: string;
    name_ru: string;
  } | null;
};

export function BlockedDaysManager({
  selectedDates,
  onClearSelection,
  onBlockedDaysChange,
  blockedDates,
  onAppointmentsChange,
}: BlockedDaysManagerProps) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [isBlockWarningDialogOpen, setIsBlockWarningDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [appointmentsToCancel, setAppointmentsToCancel] = useState<AppointmentToCancel[]>([]);
  const [appointmentsOnBlockDays, setAppointmentsOnBlockDays] = useState<AppointmentToCancel[]>([]);
  const [isFetchingAppointments, setIsFetchingAppointments] = useState(false);
  const [blockAndCancel, setBlockAndCancel] = useState(false);

  const locale = language === 'ARM' ? hy : ru;

  useEffect(() => {
    fetchDoctor();
  }, [user?.id]);

  const fetchDoctor = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('doctor')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) setDoctorId(data.id);
  };

  const formatDateForDb = (date: Date) => format(date, 'yyyy-MM-dd');

  // Check for appointments before opening block dialog
  const handleBlockButtonClick = async () => {
    if (!doctorId || selectedDates.length === 0) return;

    setIsFetchingAppointments(true);
    try {
      const dateStrings = selectedDates.map(formatDateForDb);
      
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          start_date_time,
          patients (
            first_name,
            last_name,
            telegram_user_id
          ),
          services (
            name_arm,
            name_ru
          )
        `)
        .eq('doctor_id', doctorId)
        .in('status', ['PENDING', 'CONFIRMED']);

      if (error) throw error;

      const filtered = (data || []).filter(apt => {
        const aptDate = format(new Date(apt.start_date_time), 'yyyy-MM-dd');
        return dateStrings.includes(aptDate);
      }) as AppointmentToCancel[];

      setAppointmentsOnBlockDays(filtered);

      if (filtered.length > 0) {
        // Show warning dialog
        setIsBlockWarningDialogOpen(true);
      } else {
        // No appointments, go directly to block dialog
        setIsBlockDialogOpen(true);
      }
    } catch (error) {
      console.error('Error checking appointments:', error);
      // Still allow blocking on error
      setIsBlockDialogOpen(true);
    } finally {
      setIsFetchingAppointments(false);
    }
  };

  const handleBlockDays = async (cancelAppointments = false) => {
    if (!doctorId || selectedDates.length === 0) return;

    setIsLoading(true);
    try {
      // If we need to cancel appointments first
      if (cancelAppointments && appointmentsOnBlockDays.length > 0) {
        const appointmentIds = appointmentsOnBlockDays.map(apt => apt.id);

        const { error: updateError } = await supabase
          .from('appointments')
          .update({ 
            status: 'CANCELLED_BY_DOCTOR',
            rejection_reason: reason.trim() || null
          })
          .in('id', appointmentIds);

        if (updateError) throw updateError;

        // Send notifications
        const notificationPromises = appointmentsOnBlockDays
          .filter(apt => apt.patients?.telegram_user_id)
          .map(apt => 
            supabase.functions.invoke('notify-patient-cancellation', {
              body: { 
                appointmentId: apt.id, 
                reason: reason.trim() || undefined 
              }
            })
          );

        await Promise.allSettled(notificationPromises);
      }

      // Block the days
      const blockedDaysData = selectedDates.map(date => ({
        doctor_id: doctorId,
        blocked_date: formatDateForDb(date),
        reason: reason.trim() || null,
      }));

      const { error } = await supabase
        .from('blocked_days')
        .upsert(blockedDaysData, { onConflict: 'doctor_id,blocked_date' });

      if (error) throw error;

      const message = cancelAppointments && appointmentsOnBlockDays.length > 0
        ? (language === 'ARM' 
            ? `\u0555\u0580\u0565\u0580\u0568 \u0561\u0580\u0563\u0565\u056C\u0561\u0583\u0561\u056F\u057E\u0565\u0581, ${appointmentsOnBlockDays.length} \u0563\u0580\u0561\u0576\u0581\u0578\u0582\u0574 \u0579\u0565\u0572\u0561\u0580\u056F\u057E\u0565\u0581`
            : `Дни заблокированы, ${appointmentsOnBlockDays.length} записей отменено`)
        : (language === 'ARM' 
            ? '\u0555\u0580\u0565\u0580\u0568 \u0570\u0561\u057B\u0578\u0572\u0578\u0582\u0569\u0575\u0561\u0574\u0562 \u0561\u0580\u0563\u0565\u056C\u0561\u0583\u0561\u056F\u057E\u0565\u0581' 
            : 'Дни успешно заблокированы');

      toast.success(message);
      setIsBlockDialogOpen(false);
      setIsBlockWarningDialogOpen(false);
      setReason('');
      setAppointmentsOnBlockDays([]);
      onClearSelection();
      onBlockedDaysChange();
      if (cancelAppointments) {
        onAppointmentsChange?.();
      }
    } catch (error) {
      console.error('Error blocking days:', error);
      toast.error(
        language === 'ARM'
          ? '\u054D\u056D\u0561\u056C \u0561\u0580\u0563\u0565\u056C\u0561\u0583\u0561\u056F\u0574\u0561\u0576 \u056A\u0561\u0574\u0561\u0576\u0561\u056F'
          : 'Ошибка при блокировке дней'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnblockDays = async () => {
    if (!doctorId || selectedDates.length === 0) return;

    setIsLoading(true);
    try {
      const datesToUnblock = selectedDates.map(formatDateForDb);

      const { error } = await supabase
        .from('blocked_days')
        .delete()
        .eq('doctor_id', doctorId)
        .in('blocked_date', datesToUnblock);

      if (error) throw error;

      toast.success(
        language === 'ARM'
          ? '\u0555\u0580\u0565\u0580\u0568 \u0570\u0561\u057B\u0578\u0572\u0578\u0582\u0569\u0575\u0561\u0574\u0562 \u0561\u057A\u0561\u0580\u0563\u0565\u056C\u0561\u0583\u0561\u056F\u057E\u0565\u0581'
          : 'Дни успешно разблокированы'
      );
      onClearSelection();
      onBlockedDaysChange();
    } catch (error) {
      console.error('Error unblocking days:', error);
      toast.error(
        language === 'ARM'
          ? '\u054D\u056D\u0561\u056C \u0561\u057A\u0561\u0580\u0563\u0565\u056C\u0561\u0583\u0561\u056F\u0574\u0561\u0576 \u056A\u0561\u0574\u0561\u0576\u0561\u056F'
          : 'Ошибка при разблокировке дней'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch appointments for selected dates to show in cancel dialog
  const fetchAppointmentsForDates = async () => {
    if (!doctorId || selectedDates.length === 0) return;

    setIsFetchingAppointments(true);
    try {
      const dateStrings = selectedDates.map(formatDateForDb);
      
      // Get all PENDING or CONFIRMED appointments on selected dates
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          start_date_time,
          patients (
            first_name,
            last_name,
            telegram_user_id
          ),
          services (
            name_arm,
            name_ru
          )
        `)
        .eq('doctor_id', doctorId)
        .in('status', ['PENDING', 'CONFIRMED']);

      if (error) throw error;

      // Filter by selected dates
      const filtered = (data || []).filter(apt => {
        const aptDate = format(new Date(apt.start_date_time), 'yyyy-MM-dd');
        return dateStrings.includes(aptDate);
      }) as AppointmentToCancel[];

      setAppointmentsToCancel(filtered);
      setIsCancelDialogOpen(true);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast.error(
        language === 'ARM'
          ? '\u054D\u056D\u0561\u056C \u0563\u0580\u0561\u0576\u0581\u0578\u0582\u0574\u0576\u0565\u0580\u056B \u0562\u0565\u057C\u0576\u0574\u0561\u0576 \u056A\u0561\u0574\u0561\u0576\u0561\u056F'
          : 'Ошибка при загрузке записей'
      );
    } finally {
      setIsFetchingAppointments(false);
    }
  };

  const handleMassCancel = async () => {
    if (appointmentsToCancel.length === 0) {
      setIsCancelDialogOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const appointmentIds = appointmentsToCancel.map(apt => apt.id);

      // Update all appointments to CANCELLED_BY_DOCTOR
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ 
          status: 'CANCELLED_BY_DOCTOR',
          rejection_reason: cancelReason.trim() || null
        })
        .in('id', appointmentIds);

      if (updateError) throw updateError;

      // Send notifications to all patients with Telegram IDs
      const notificationPromises = appointmentsToCancel
        .filter(apt => apt.patients?.telegram_user_id)
        .map(apt => 
          supabase.functions.invoke('notify-patient-cancellation', {
            body: { 
              appointmentId: apt.id, 
              reason: cancelReason.trim() || undefined 
            }
          })
        );

      // Wait for all notifications (don't fail if some fail)
      const results = await Promise.allSettled(notificationPromises);
      const failedCount = results.filter(r => r.status === 'rejected').length;
      
      if (failedCount > 0) {
        console.warn(`${failedCount} notification(s) failed to send`);
      }

      const successCount = appointmentsToCancel.length;
      toast.success(
        language === 'ARM'
          ? `${successCount} \u0563\u0580\u0561\u0576\u0581\u0578\u0582\u0574 \u0579\u0565\u0572\u0561\u0580\u056F\u057E\u0565\u0581, \u0570\u056B\u057E\u0561\u0576\u0564\u0576\u0565\u0580\u0568 \u056E\u0561\u0576\u0578\u0582\u0581\u057E\u0565\u0581`
          : `${successCount} записей отменено, пациенты уведомлены`
      );

      setIsCancelDialogOpen(false);
      setCancelReason('');
      onClearSelection();
      onAppointmentsChange?.();
    } catch (error) {
      console.error('Error mass cancelling:', error);
      toast.error(
        language === 'ARM'
          ? '\u054D\u056D\u0561\u056C \u0563\u0580\u0561\u0576\u0581\u0578\u0582\u0574\u0576\u0565\u0580\u056B \u0579\u0565\u0572\u0561\u0580\u056F\u0574\u0561\u0576 \u056A\u0561\u0574\u0561\u0576\u0561\u056F'
          : 'Ошибка при отмене записей'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Check if any selected date is blocked
  const hasBlockedDates = selectedDates.some(date => blockedDates.has(formatDateForDb(date)));
  const hasUnblockedDates = selectedDates.some(date => !blockedDates.has(formatDateForDb(date)));

  if (selectedDates.length === 0) return null;

  return (
    <>
      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border flex-wrap">
        <span className="text-sm text-muted-foreground">
          {language === 'ARM' ? '\u0538\u0576\u057F\u0580\u057E\u0561\u056E \u0585\u0580\u0565\u0580\u056D' : 'Выбрано дней:'} {selectedDates.length}
        </span>
        <div className="flex-1" />
        
        {/* Mass Cancel Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={fetchAppointmentsForDates}
          disabled={isFetchingAppointments}
          className="gap-1 text-destructive border-destructive/50 hover:bg-destructive/10"
        >
          <XCircle className="h-4 w-4" />
          {language === 'ARM' ? '\u0549\u0565\u0572\u0561\u0580\u056F\u0565\u056C \u0563\u0580\u0561\u0576\u0581\u0578\u0582\u0574\u0576\u0565\u0580\u0568' : 'Отменить записи'}
        </Button>
        
        {hasUnblockedDates && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleBlockButtonClick}
            disabled={isFetchingAppointments}
            className="gap-1"
          >
            <CalendarOff className="h-4 w-4" />
            {language === 'ARM' ? '\u0531\u0580\u0563\u0565\u056C\u0561\u0583\u0561\u056F\u0565\u056C' : 'Заблокировать'}
          </Button>
        )}
        
        {hasBlockedDates && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleUnblockDays}
            disabled={isLoading}
            className="gap-1"
          >
            <Unlock className="h-4 w-4" />
            {language === 'ARM' ? '\u0531\u057A\u0561\u0580\u0563\u0565\u056C\u0561\u0583\u0561\u056F\u0565\u056C' : 'Разблокировать'}
          </Button>
        )}
        
        <Button variant="ghost" size="sm" onClick={onClearSelection}>
          {language === 'ARM' ? '\u0549\u0565\u0572\u0561\u0580\u056F\u0565\u056C' : 'Отмена'}
        </Button>
      </div>

      {/* Block Days Dialog */}
      <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'ARM' ? '\u0555\u0580\u0565\u0580\u056B \u0561\u0580\u0563\u0565\u056C\u0561\u0583\u0561\u056F\u0578\u0582\u0574' : 'Заблокировать дни'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">
                {language === 'ARM' ? '\u0538\u0576\u057F\u0580\u057E\u0561\u056E \u0585\u0580\u0565\u0580\u056D' : 'Выбранные даты:'}
              </Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedDates.slice(0, 10).map(date => (
                  <span 
                    key={date.toISOString()} 
                    className="px-2 py-1 bg-muted rounded text-xs"
                  >
                    {format(date, 'd MMM', { locale })}
                  </span>
                ))}
                {selectedDates.length > 10 && (
                  <span className="px-2 py-1 bg-muted rounded text-xs">
                    +{selectedDates.length - 10}
                  </span>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="reason">
                {language === 'ARM' ? 'Причина (ոչ обязательно)' : 'Причина (необязательно)'}
              </Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={language === 'ARM' ? '\u0555\u0580\u056B\u0576\u0561\u056F\u055D \u0561\u0580\u0571\u0561\u056F\u0578\u0582\u0580\u0564' : 'Например: Отпуск'}
                maxLength={100}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsBlockDialogOpen(false)}>
              {language === 'ARM' ? 'Չегhel' : 'Отмена'}
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => handleBlockDays(false)}
              disabled={isLoading}
            >
              {isLoading 
                ? (language === 'ARM' ? '\u0531\u0580\u0563\u0565\u056C\u0561\u0583\u0561\u056F\u0578\u0582\u0574...' : 'Блокировка...') 
                : (language === 'ARM' ? '\u0531\u0580\u0563\u0565\u056C\u0561\u0583\u0561\u056F\u0565\u056C' : 'Заблокировать')
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block Warning Dialog - shown when there are existing appointments */}
      <Dialog open={isBlockWarningDialogOpen} onOpenChange={setIsBlockWarningDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {language === 'ARM' ? '\u0548\u0582\u0577\u0561\u0564\u0580\u0578\u0582\u0569\u0575\u0578\u0582\u0576\u055D' : 'Внимание!'}
            </DialogTitle>
            <DialogDescription>
              {language === 'ARM' 
                ? '\u0538\u0576\u057F\u0580\u057E\u0561\u056E \u0585\u0580\u0565\u0580\u056B\u0576 \u056F\u0561\u0576 \u0561\u056F\u057F\u056B\u057E \u0563\u0580\u0561\u0576\u0581\u0578\u0582\u0574\u0576\u0565\u0580\u0589 \u0538\u0576\u057F\u0580\u0565\u0584 \u0563\u0578\u0580\u056E\u0578\u0572\u0578\u0582\u0569\u0575\u0578\u0582\u0576\u0568\u055D'
                : 'На выбранные дни есть активные записи. Выберите действие:'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Appointments list */}
            <div>
              <Label className="text-sm font-medium">
                {language === 'ARM' 
                  ? `\u0531\u056F\u057F\u056B\u057E \u0563\u0580\u0561\u0576\u0581\u0578\u0582\u0574\u0576\u0565\u0580\u055D ${appointmentsOnBlockDays.length}`
                  : `Активных записей: ${appointmentsOnBlockDays.length}`}
              </Label>
              <div className="mt-2 max-h-32 overflow-y-auto space-y-1 border rounded p-2 bg-muted/30">
                {appointmentsOnBlockDays.map(apt => (
                  <div key={apt.id} className="text-xs flex justify-between items-center">
                    <span>
                      {apt.patients?.first_name} {apt.patients?.last_name}
                    </span>
                    <span className="text-muted-foreground">
                      {format(new Date(apt.start_date_time), 'd MMM HH:mm', { locale })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Reason input */}
            <div className="space-y-2">
              <Label htmlFor="blockReason">
                {language === 'ARM' ? '\u054A\u0561\u057F\u0573\u0561\u057C' : 'Причина'}
              </Label>
              <Input
                id="blockReason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={language === 'ARM' ? '\u0555\u0580\u056B\u0576\u0561\u056F\u055D \u0561\u0580\u0571\u0561\u056F\u0578\u0582\u0580\u0564' : 'Например: Отпуск'}
                maxLength={100}
              />
            </div>
          </div>
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="ghost" 
              onClick={() => {
                setIsBlockWarningDialogOpen(false);
                setReason('');
                setAppointmentsOnBlockDays([]);
              }}
            >
              {language === 'ARM' ? '\u0549\u0565\u0572\u0561\u0580\u056F\u0565\u056C' : 'Отмена'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleBlockDays(false)}
              disabled={isLoading}
            >
              {language === 'ARM' 
                ? '\u0544\u056B\u0561\u0575\u0576 \u0561\u0580\u0563\u0565\u056C\u0561\u0583\u0561\u056F\u0565\u056C' 
                : 'Только заблокировать'}
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => handleBlockDays(true)}
              disabled={isLoading}
            >
              {isLoading 
                ? (language === 'ARM' ? '\u053F\u0561\u057F\u0561\u0580\u057E\u0578\u0582\u0574 \u0567...' : 'Выполнение...') 
                : (language === 'ARM' 
                    ? '\u0531\u0580\u0563\u0565\u056C\u0561\u0583\u0561\u056F\u0565\u056C \u0587 \u0579\u0565\u0572\u0561\u0580\u056F\u0565\u056C \u0563\u0580\u0561\u0576\u0581\u0578\u0582\u0574\u0576\u0565\u0580\u0568' 
                    : 'Заблокировать и отменить записи')
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mass Cancel Dialog */}
      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {language === 'ARM' ? '\u0544\u0561\u057D\u057D\u0561\u0575\u0561\u056F\u0561\u0576 \u0579\u0565\u0572\u0561\u0580\u056F\u0578\u0582\u0574' : 'Массовая отмена записей'}
            </DialogTitle>
            <DialogDescription>
              {language === 'ARM' 
                ? '\u0538\u0576\u057F\u0580\u057E\u0561\u056E \u0585\u0580\u0565\u0580\u056B \u0562\u0578\u056C\u0578\u0580 \u0563\u0580\u0561\u0576\u0581\u0578\u0582\u0574\u0576\u0565\u0580\u0568 \u056F\u0579\u0565\u0572\u0561\u0580\u056F\u057E\u0565\u0576, \u0587 \u0570\u056B\u057E\u0561\u0576\u0564\u0576\u0565\u0580\u0568 \u056F\u057D\u057F\u0561\u0576\u0561\u0576 \u056E\u0561\u0576\u0578\u0582\u0581\u0578\u0582\u0574 Telegram\u2013\u0578\u0582\u0574\u0589'
                : 'Все записи на выбранные дни будут отменены, пациенты получат уведомление в Telegram.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Selected dates */}
            <div>
              <Label className="text-sm text-muted-foreground">
                {language === 'ARM' ? '\u0538\u0576\u057F\u0580\u057E\u0561\u056E \u0585\u0580\u0565\u0580\u055D' : 'Выбранные даты:'}
              </Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedDates.slice(0, 7).map(date => (
                  <span 
                    key={date.toISOString()} 
                    className="px-2 py-1 bg-muted rounded text-xs"
                  >
                    {format(date, 'd MMM', { locale })}
                  </span>
                ))}
                {selectedDates.length > 7 && (
                  <span className="px-2 py-1 bg-muted rounded text-xs">
                    +{selectedDates.length - 7}
                  </span>
                )}
              </div>
            </div>

            {/* Appointments to cancel */}
            <div>
              <Label className="text-sm font-medium">
                {language === 'ARM' 
                  ? `\u0549\u0565\u0572\u0561\u0580\u056F\u057E\u0565\u056C\u056B\u0584 \u0563\u0580\u0561\u0576\u0581\u0578\u0582\u0574\u0576\u0565\u0580\u055D ${appointmentsToCancel.length}`
                  : `Записей к отмене: ${appointmentsToCancel.length}`}
              </Label>
              {appointmentsToCancel.length > 0 ? (
                <div className="mt-2 max-h-32 overflow-y-auto space-y-1 border rounded p-2 bg-muted/30">
                  {appointmentsToCancel.map(apt => (
                    <div key={apt.id} className="text-xs flex justify-between items-center">
                      <span>
                        {apt.patients?.first_name} {apt.patients?.last_name}
                      </span>
                      <span className="text-muted-foreground">
                        {format(new Date(apt.start_date_time), 'd MMM HH:mm', { locale })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">
                  {language === 'ARM' 
                    ? '\u0549\u0565\u0572\u0561\u0580\u056F\u0574\u0561\u0576 \u0570\u0561\u0574\u0561\u0580 \u0563\u0580\u0561\u0576\u0581\u0578\u0582\u0574\u0576\u0565\u0580 \u0579\u0565\u0576 \u0563\u057F\u0576\u057E\u0565\u056C'
                    : 'Записей для отмены не найдено'}
                </p>
              )}
            </div>
            
            {/* Cancellation reason */}
            {appointmentsToCancel.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="cancelReason">
                  {language === 'ARM' ? '\u0549\u0565\u0572\u0561\u0580\u056F\u0574\u0561\u0576 \u057A\u0561\u057F\u0573\u0561\u057C' : 'Причина отмены'}
                </Label>
                <Textarea
                  id="cancelReason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder={language === 'ARM' 
                    ? '\u0555\u0580\u056B\u0576\u0561\u056F\u055D \u0532\u056A\u056B\u0577\u056F\u0568 \u0561\u0580\u0571\u0561\u056F\u0578\u0582\u0580\u0564\u0578\u0582\u0574 \u0567' 
                    : 'Например: Врач в отпуске'}
                  rows={2}
                  maxLength={200}
                />
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCancelDialogOpen(false)}>
              {language === 'ARM' ? '\u0549\u0565\u0572\u0561\u0580\u056F\u0565\u056C' : 'Отмена'}
            </Button>
            {appointmentsToCancel.length > 0 && (
              <Button 
                variant="destructive" 
                onClick={handleMassCancel}
                disabled={isLoading}
              >
                {isLoading 
                  ? (language === 'ARM' ? '\u0549\u0565\u0572\u0561\u0580\u056F\u0578\u0582\u0574 \u0567...' : 'Отмена...') 
                  : (language === 'ARM' 
                      ? `\u0549\u0565\u0572\u0561\u0580\u056F\u0565\u056C ${appointmentsToCancel.length} \u0563\u0580\u0561\u0576\u0581\u0578\u0582\u0574` 
                      : `Отменить ${appointmentsToCancel.length} записей`)
                }
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
