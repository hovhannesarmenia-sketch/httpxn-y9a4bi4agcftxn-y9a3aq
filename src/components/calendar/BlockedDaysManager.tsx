import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { apiRequest } from '@/lib/queryClient';
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
  startDateTime: string;
  status: string | null;
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
  const [isBlockWarningDialogOpen, setIsBlockWarningDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [appointmentsToCancel, setAppointmentsToCancel] = useState<AppointmentToCancel[]>([]);
  const [appointmentsOnBlockDays, setAppointmentsOnBlockDays] = useState<AppointmentToCancel[]>([]);
  const [isFetchingAppointments, setIsFetchingAppointments] = useState(false);

  const locale = language === 'ARM' ? hy : ru;

  const formatDateForDb = (date: Date) => format(date, 'yyyy-MM-dd');

  const handleBlockButtonClick = async () => {
    if (selectedDates.length === 0) return;

    setIsFetchingAppointments(true);
    try {
      const dateStrings = selectedDates.map(formatDateForDb);
      
      const res = await fetch('/api/appointments/with-details', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch appointments');
      const data: AppointmentToCancel[] = await res.json();

      const filtered = data.filter(apt => {
        if (!['PENDING', 'CONFIRMED'].includes(apt.status as string)) return false;
        const aptDate = format(new Date(apt.startDateTime), 'yyyy-MM-dd');
        return dateStrings.includes(aptDate);
      });

      setAppointmentsOnBlockDays(filtered);

      if (filtered.length > 0) {
        setIsBlockWarningDialogOpen(true);
      } else {
        setIsBlockDialogOpen(true);
      }
    } catch (error) {
      console.error('Error checking appointments:', error);
      setIsBlockDialogOpen(true);
    } finally {
      setIsFetchingAppointments(false);
    }
  };

  const handleBlockDays = async (cancelAppointments = false) => {
    if (selectedDates.length === 0) return;

    setIsLoading(true);
    try {
      if (cancelAppointments && appointmentsOnBlockDays.length > 0) {
        const appointmentIds = appointmentsOnBlockDays.map(apt => apt.id);
        await apiRequest('POST', '/api/appointments/bulk-cancel', {
          appointmentIds,
          reason: reason.trim() || null
        });
      }

      const dates = selectedDates.map(formatDateForDb);
      await apiRequest('POST', '/api/blocked-days/bulk', {
        dates,
        reason: reason.trim() || null
      });

      const message = cancelAppointments && appointmentsOnBlockDays.length > 0
        ? (language === 'ARM' 
            ? `${ARM.daysBlocked}, ${appointmentsOnBlockDays.length} ${ARM.allCancelled}`
            : `Дни заблокированы, ${appointmentsOnBlockDays.length} записей отменено`)
        : (language === 'ARM' 
            ? 'Օրերը արգելափակվեց' 
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
          ? 'Սխալ'
          : 'Ошибка при блокировке дней'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnblockDays = async () => {
    if (selectedDates.length === 0) return;

    setIsLoading(true);
    try {
      const dates = selectedDates.map(formatDateForDb);
      await apiRequest('DELETE', '/api/blocked-days/bulk', { dates });

      toast.success(
        language === 'ARM' 
            ? 'Օրերը արգելափակվեց'
          : 'Дни успешно разблокированы'
      );
      onClearSelection();
      onBlockedDaysChange();
    } catch (error) {
      console.error('Error unblocking days:', error);
      toast.error(
        language === 'ARM'
          ? 'Սխալ'
          : 'Ошибка при разблокировке дней'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAppointmentsForDates = async () => {
    if (selectedDates.length === 0) return;

    setIsFetchingAppointments(true);
    try {
      const dateStrings = selectedDates.map(formatDateForDb);
      
      const res = await fetch('/api/appointments/with-details', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch appointments');
      const data: AppointmentToCancel[] = await res.json();

      const filtered = data.filter(apt => {
        if (!['PENDING', 'CONFIRMED'].includes(apt.status as string)) return false;
        const aptDate = format(new Date(apt.startDateTime), 'yyyy-MM-dd');
        return dateStrings.includes(aptDate);
      });

      setAppointmentsToCancel(filtered);
      setIsCancelDialogOpen(true);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast.error(
        language === 'ARM'
          ? 'Սխալ'
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
      await apiRequest('POST', '/api/appointments/bulk-cancel', {
        appointmentIds,
        reason: cancelReason.trim() || null
      });

      const successCount = appointmentsToCancel.length;
      toast.success(
        language === 'ARM'
          ? `${successCount} գրանցում չեղարկվեց`
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
          ? 'Սխալ'
          : 'Ошибка при отмене записей'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const hasBlockedDates = selectedDates.some(date => blockedDates.has(formatDateForDb(date)));
  const hasUnblockedDates = selectedDates.some(date => !blockedDates.has(formatDateForDb(date)));

  if (selectedDates.length === 0) return null;

  return (
    <>
      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border flex-wrap">
        <span className="text-sm text-muted-foreground">
          {language === 'ARM' ? 'Ընտրված օրեր:' : 'Выбрано дней:'} {selectedDates.length}
        </span>
        <div className="flex-1" />
        
        <Button
          variant="outline"
          size="sm"
          onClick={fetchAppointmentsForDates}
          disabled={isFetchingAppointments}
          className="gap-1 text-destructive border-destructive/50 hover:bg-destructive/10"
          data-testid="button-cancel-appointments"
        >
          <XCircle className="h-4 w-4" />
          {language === 'ARM' ? 'Չեղարկել գրանցումները' : 'Отменить записи'}
        </Button>
        
        {hasUnblockedDates && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleBlockButtonClick}
            disabled={isFetchingAppointments}
            className="gap-1"
            data-testid="button-block-days"
          >
            <CalendarOff className="h-4 w-4" />
            {language === 'ARM' ? 'Արգելափակել' : 'Заблокировать'}
          </Button>
        )}
        
        {hasBlockedDates && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleUnblockDays}
            disabled={isLoading}
            className="gap-1"
            data-testid="button-unblock-days"
          >
            <Unlock className="h-4 w-4" />
            {language === 'ARM' ? 'Ապարգելափակել' : 'Разблокировать'}
          </Button>
        )}
        
        <Button variant="ghost" size="sm" onClick={onClearSelection} data-testid="button-clear-selection">
          {language === 'ARM' ? 'Չեղարկել' : 'Отмена'}
        </Button>
      </div>

      <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'ARM' ? 'Արգելափակել օրերը' : 'Заблокировать дни'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">
                {language === 'ARM' ? 'Ընտրված ամսաթվեր:' : 'Выбранные даты:'}
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
                {language === 'ARM' ? 'Պատճառ (ոչ պարտադիր)' : 'Причина (необязательно)'}
              </Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={language === 'ARM' ? 'Օրինակ, արձակուրդ' : 'Например: Отпуск'}
                maxLength={100}
                data-testid="input-block-reason"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsBlockDialogOpen(false)}>
              {language === 'ARM' ? 'Չեղարկել' : 'Отмена'}
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => handleBlockDays(false)}
              disabled={isLoading}
              data-testid="button-confirm-block"
            >
              {isLoading 
                ? (language === 'ARM' ? 'Արգելափակում...' : 'Блокировка...') 
                : (language === 'ARM' ? 'Արգելափակել' : 'Заблокировать')
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBlockWarningDialogOpen} onOpenChange={setIsBlockWarningDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {language === 'ARM' ? 'Նախազգուշացում!' : 'Внимание!'}
            </DialogTitle>
            <DialogDescription>
              {language === 'ARM' 
                ? 'Ընտրված օրերին կան ակտիվ գրանցումներ'
                : 'На выбранные дни есть активные записи. Выберите действие:'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">
                {language === 'ARM' 
                  ? `Ակտիվ գրանցումներ: ${appointmentsOnBlockDays.length}`
                  : `Активных записей: ${appointmentsOnBlockDays.length}`}
              </Label>
              <div className="mt-2 max-h-32 overflow-y-auto space-y-1 border rounded p-2 bg-muted/30">
                {appointmentsOnBlockDays.map(apt => (
                  <div key={apt.id} className="text-xs flex justify-between items-center">
                    <span>
                      {apt.patients?.first_name} {apt.patients?.last_name}
                    </span>
                    <span className="text-muted-foreground">
                      {format(new Date(apt.startDateTime), 'd MMM HH:mm', { locale })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="blockReason">
                {language === 'ARM' ? 'Պատճառ' : 'Причина'}
              </Label>
              <Input
                id="blockReason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={language === 'ARM' ? 'Օրինակ, արձակուրդ' : 'Например: Отпуск'}
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
              {language === 'ARM' ? 'Չեղարկել' : 'Отмена'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleBlockDays(false)}
              disabled={isLoading}
            >
              {language === 'ARM' 
                ? 'Միայն արգելափակել'
                : 'Только заблокировать'}
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => handleBlockDays(true)}
              disabled={isLoading}
            >
              {isLoading 
                ? (language === 'ARM' ? 'Կատարում...' : 'Выполнение...') 
                : (language === 'ARM' 
                    ? 'Արգելափակել և չեղարկել'
                    : 'Заблокировать и отменить записи')
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {language === 'ARM' ? 'Զանգվածային չեղարկում' : 'Массовая отмена записей'}
            </DialogTitle>
            <DialogDescription>
              {language === 'ARM' 
                ? 'Գրանցումներ չեղարկման համար'
                : 'Все записи на выбранные дни будут отменены, пациенты получат уведомление в Telegram.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">
                {language === 'ARM' ? 'Ընտրված ամսաթվեր:' : 'Выбранные даты:'}
              </Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedDates.slice(0, 5).map(date => (
                  <span 
                    key={date.toISOString()} 
                    className="px-2 py-1 bg-muted rounded text-xs"
                  >
                    {format(date, 'd MMM', { locale })}
                  </span>
                ))}
                {selectedDates.length > 5 && (
                  <span className="px-2 py-1 bg-muted rounded text-xs">
                    +{selectedDates.length - 5}
                  </span>
                )}
              </div>
            </div>

            {appointmentsToCancel.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {language === 'ARM' ? 'Ակտիվ գրանցումներ չկան ընտրված օրերին' : 'Нет активных записей на выбранные дни'}
              </p>
            ) : (
              <>
                <div>
                  <Label className="text-sm font-medium">
                    {language === 'ARM' 
                      ? `Գրանցումներ չեղարկման համար: ${appointmentsToCancel.length}`
                      : `Записей к отмене: ${appointmentsToCancel.length}`}
                  </Label>
                  <div className="mt-2 max-h-32 overflow-y-auto space-y-1 border rounded p-2 bg-muted/30">
                    {appointmentsToCancel.map(apt => (
                      <div key={apt.id} className="text-xs flex justify-between items-center">
                        <span>
                          {apt.patients?.first_name} {apt.patients?.last_name}
                        </span>
                        <span className="text-muted-foreground">
                          {format(new Date(apt.startDateTime), 'd MMM HH:mm', { locale })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="cancelReason">
                    {language === 'ARM' ? 'Չեղարկման պատճառ' : 'Причина отмены'}
                  </Label>
                  <Input
                    id="cancelReason"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder={language === 'ARM' ? 'Օրինակ, արձակուրդ' : 'Например: Изменение графика'}
                    maxLength={200}
                    data-testid="input-cancel-reason"
                  />
                </div>
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCancelDialogOpen(false)}>
              {language === 'ARM' ? 'Փակել' : 'Закрыть'}
            </Button>
            {appointmentsToCancel.length > 0 && (
              <Button 
                variant="destructive" 
                onClick={handleMassCancel}
                disabled={isLoading}
                data-testid="button-confirm-mass-cancel"
              >
                {isLoading 
                  ? (language === 'ARM' ? 'Չեղարկում...' : 'Отмена...') 
                  : (language === 'ARM' 
                      ? `Գրանցումներ չեղարկման համար: ${appointmentsToCancel.length}` 
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
