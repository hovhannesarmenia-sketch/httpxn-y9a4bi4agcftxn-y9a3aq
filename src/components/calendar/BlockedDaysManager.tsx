import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
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
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [appointmentsToCancel, setAppointmentsToCancel] = useState<AppointmentToCancel[]>([]);
  const [isFetchingAppointments, setIsFetchingAppointments] = useState(false);

  const locale = language === 'ARM' ? hy : ru;

  useEffect(() => {
    fetchDoctor();
  }, []);

  const fetchDoctor = async () => {
    const { data } = await supabase.from('doctor').select('id').limit(1).maybeSingle();
    if (data) setDoctorId(data.id);
  };

  const formatDateForDb = (date: Date) => format(date, 'yyyy-MM-dd');

  const handleBlockDays = async () => {
    if (!doctorId || selectedDates.length === 0) return;

    setIsLoading(true);
    try {
      const blockedDaysData = selectedDates.map(date => ({
        doctor_id: doctorId,
        blocked_date: formatDateForDb(date),
        reason: reason.trim() || null,
      }));

      const { error } = await supabase
        .from('blocked_days')
        .upsert(blockedDaysData, { onConflict: 'doctor_id,blocked_date' });

      if (error) throw error;

      toast.success(
        language === 'ARM' 
          ? 'Օdelays delays delays' 
          : 'Дни успешно заблокированы'
      );
      setIsBlockDialogOpen(false);
      setReason('');
      onClearSelection();
      onBlockedDaysChange();
    } catch (error) {
      console.error('Error blocking days:', error);
      toast.error(
        language === 'ARM'
          ? 'Сdelays delays'
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
          ? 'Օdelays delays delays'
          : 'Дни успешно разблокированы'
      );
      onClearSelection();
      onBlockedDaysChange();
    } catch (error) {
      console.error('Error unblocking days:', error);
      toast.error(
        language === 'ARM'
          ? 'Сdelays delays'
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
          ? 'Сdelays delays'
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
          ? `${successCount} delays delays delays`
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
          ? 'Сdelays delays'
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
          {language === 'ARM' ? 'Ընdelays delays:' : 'Выбрано дней:'} {selectedDates.length}
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
          {language === 'ARM' ? 'Չdelays delays' : 'Отменить записи'}
        </Button>
        
        {hasUnblockedDates && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setIsBlockDialogOpen(true)}
            className="gap-1"
          >
            <CalendarOff className="h-4 w-4" />
            {language === 'ARM' ? 'Блokavorel' : 'Заблокировать'}
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
            {language === 'ARM' ? 'Apakаблокіrovать' : 'Разблокировать'}
          </Button>
        )}
        
        <Button variant="ghost" size="sm" onClick={onClearSelection}>
          {language === 'ARM' ? 'Չегhel' : 'Отмена'}
        </Button>
      </div>

      {/* Block Days Dialog */}
      <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'ARM' ? 'Blokаvoрel дни' : 'Заблокировать дни'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">
                {language === 'ARM' ? 'Ынdelays delays:' : 'Выбранные даты:'}
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
                placeholder={language === 'ARM' ? 'Օрінak, Отпуск' : 'Например: Отпуск'}
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
              onClick={handleBlockDays}
              disabled={isLoading}
            >
              {isLoading 
                ? (language === 'ARM' ? 'Blokavorвум...' : 'Блокировка...') 
                : (language === 'ARM' ? 'Заблokirovать' : 'Заблокировать')
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
              {language === 'ARM' ? 'Масова скасавация' : 'Массовая отмена записей'}
            </DialogTitle>
            <DialogDescription>
              {language === 'ARM' 
                ? 'Всі записи на вибрані дні будуть скасовані, пацієнти отримають сповіщення через Telegram.'
                : 'Все записи на выбранные дни будут отменены, пациенты получат уведомление в Telegram.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Selected dates */}
            <div>
              <Label className="text-sm text-muted-foreground">
                {language === 'ARM' ? 'Ынtрvac delays:' : 'Выбранные даты:'}
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
                  ? `Zapisів до скасування: ${appointmentsToCancel.length}`
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
                    ? 'Записи для скасування не знайдені'
                    : 'Записей для отмены не найдено'}
                </p>
              )}
            </div>
            
            {/* Cancellation reason */}
            {appointmentsToCancel.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="cancelReason">
                  {language === 'ARM' ? 'Причина відміни' : 'Причина отмены'}
                </Label>
                <Textarea
                  id="cancelReason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder={language === 'ARM' 
                    ? 'Наприклад: Лікар у відпустці' 
                    : 'Например: Врач в отпуске'}
                  rows={2}
                  maxLength={200}
                />
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCancelDialogOpen(false)}>
              {language === 'ARM' ? 'Чегhel' : 'Отмена'}
            </Button>
            {appointmentsToCancel.length > 0 && (
              <Button 
                variant="destructive" 
                onClick={handleMassCancel}
                disabled={isLoading}
              >
                {isLoading 
                  ? (language === 'ARM' ? 'Скасування...' : 'Отмена...') 
                  : (language === 'ARM' 
                      ? `Скасувати ${appointmentsToCancel.length} записів` 
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
