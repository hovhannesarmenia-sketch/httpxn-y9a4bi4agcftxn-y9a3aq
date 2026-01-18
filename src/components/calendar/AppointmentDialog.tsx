import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { StatusBadge } from '@/components/ui/status-badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ru, hy } from 'date-fns/locale';
import { Clock, User, Phone, Calendar as CalendarIcon, FileText, Check, X, Ban, Pencil, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface AppointmentDialogProps {
  appointment: Appointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function AppointmentDialog({ appointment, open, onOpenChange, onUpdate }: AppointmentDialogProps) {
  const { t, language } = useLanguage();
  const { doctor } = useAuth();
  const { toast } = useToast();
  const [duration, setDuration] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const [editDate, setEditDate] = useState<Date | undefined>();
  const [editTime, setEditTime] = useState<string>('');
  const [editDuration, setEditDuration] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');

  const locale = language === 'ARM' ? hy : ru;

  useEffect(() => {
    if (open && appointment) {
      setIsEditMode(false);
      setDuration('');
      setRejectionReason('');
      
      const appointmentDate = new Date(appointment.startDateTime);
      setEditDate(appointmentDate);
      setEditTime(format(appointmentDate, 'HH:mm'));
      setEditDuration(appointment.durationMinutes.toString());
      setEditNotes(appointment.customReason || '');
    }
  }, [open, appointment]);

  const generateTimeSlots = () => {
    if (!doctor) return [];
    
    const startTime = doctor.workDayStartTime || '09:00:00';
    const endTime = doctor.workDayEndTime || '18:00:00';
    const step = doctor.slotStepMinutes || 15;

    const slots: string[] = [];
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    let currentHour = startHour;
    let currentMin = startMin;

    while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
      slots.push(`${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`);
      currentMin += step;
      if (currentMin >= 60) {
        currentHour += Math.floor(currentMin / 60);
        currentMin = currentMin % 60;
      }
    }

    return slots;
  };

  if (!appointment) return null;

  const handleConfirm = async () => {
    setIsLoading(true);
    const finalDuration = duration ? parseInt(duration) : appointment.durationMinutes;

    try {
      await apiRequest('PATCH', `/api/appointments/${appointment.id}`, {
        status: 'CONFIRMED',
        durationMinutes: finalDuration,
      });
      toast({
        title: t('common.success'),
        description: t('appointment.confirmed'),
      });
      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  };

  const handleReject = async () => {
    setIsLoading(true);

    try {
      await apiRequest('PATCH', `/api/appointments/${appointment.id}`, {
        status: 'REJECTED',
        rejectionReason: rejectionReason || null,
      });
      toast({
        title: t('common.success'),
        description: t('appointment.rejected'),
      });
      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    }
    setIsLoading(false);
    setRejectionReason('');
  };

  const handleCancel = async () => {
    setIsLoading(true);

    try {
      await apiRequest('PATCH', `/api/appointments/${appointment.id}`, {
        status: 'CANCELLED_BY_DOCTOR',
        rejectionReason: rejectionReason || null,
      });
      toast({
        title: t('common.success'),
        description: t('appointment.cancelled'),
      });
      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    }
    setIsLoading(false);
    setRejectionReason('');
  };

  const handleSaveEdit = async () => {
    if (!editDate || !editTime) {
      toast({
        title: t('common.error'),
        description: language === 'ARM' ? 'Ընտրեք ամսաթիվը և ժամը' : 'Выберите дату и время',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    const [hours, minutes] = editTime.split(':').map(Number);
    const newDateTime = new Date(editDate);
    newDateTime.setHours(hours, minutes, 0, 0);

    try {
      await apiRequest('PATCH', `/api/appointments/${appointment.id}`, {
        startDateTime: newDateTime.toISOString(),
        durationMinutes: parseInt(editDuration),
        customReason: editNotes.trim() || null,
      });
      toast({
        title: t('common.success'),
        description: language === 'ARM' ? 'Գրանցումը թարմացվեց' : 'Запись обновлена',
      });
      setIsEditMode(false);
      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  };

  const canEdit = appointment.status === 'PENDING' || appointment.status === 'CONFIRMED';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              {isEditMode 
                ? (language === 'ARM' ? 'Խմբագրել գրանցումը' : 'Редактирование записи')
                : t('appointment.new')
              }
            </DialogTitle>
            <div className="flex items-center gap-2">
              {canEdit && !isEditMode && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditMode(true)}
                  className="h-8 w-8 p-0"
                  data-testid="button-edit-appointment"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              <StatusBadge status={appointment.status} />
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <User className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">
                {appointment.patient?.firstName} {appointment.patient?.lastName}
              </p>
              {appointment.patient?.phoneNumber && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <Phone className="h-3 w-3" />
                  {appointment.patient.phoneNumber}
                </p>
              )}
            </div>
          </div>

          {isEditMode ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {language === 'ARM' ? 'Ամսաթիվ' : 'Дата'}
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !editDate && 'text-muted-foreground'
                        )}
                      >
                        {editDate ? format(editDate, 'PPP', { locale }) : (language === 'ARM' ? 'Ընտրեք' : 'Выберите')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={editDate}
                        onSelect={setEditDate}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {language === 'ARM' ? 'Ժամ' : 'Время'}
                  </Label>
                  <Select value={editTime} onValueChange={setEditTime}>
                    <SelectTrigger>
                      <SelectValue placeholder={language === 'ARM' ? 'Ընտրեք' : 'Выберите'} />
                    </SelectTrigger>
                    <SelectContent>
                      {generateTimeSlots().map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{language === 'ARM' ? 'Տևողություն (րոպե)' : 'Длительность (мин)'}</Label>
                <Select value={editDuration} onValueChange={setEditDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[15, 30, 45, 60, 90, 120].map((min) => (
                      <SelectItem key={min} value={min.toString()}>
                        {min} {language === 'ARM' ? 'րոպե' : 'мин'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{language === 'ARM' ? 'Նշում' : 'Примечание'}</Label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder={language === 'ARM' ? 'Լրացուցիչ տեղեկություն...' : 'Дополнительная информация...'}
                  rows={2}
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <CalendarIcon className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('appointment.date')}</p>
                    <p className="text-sm font-medium">
                      {format(new Date(appointment.startDateTime), 'd MMM yyyy', { locale })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <Clock className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('appointment.time')}</p>
                    <p className="text-sm font-medium">
                      {format(new Date(appointment.startDateTime), 'HH:mm')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Clock className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">{t('appointment.duration')}</p>
                  <p className="text-sm font-medium">{appointment.durationMinutes} {t('appointment.minutes')}</p>
                </div>
              </div>

              {appointment.service && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <FileText className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('appointment.service')}</p>
                    <p className="font-medium">
                      {language === 'ARM' ? appointment.service.nameArm : appointment.service.nameRu}
                    </p>
                  </div>
                </div>
              )}

              {appointment.customReason && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">{t('appointment.reason')}</p>
                  <p className="text-sm">{appointment.customReason}</p>
                </div>
              )}

              {appointment.status === 'PENDING' && (
                <>
                  <div className="space-y-2">
                    <Label>{t('appointment.duration')}</Label>
                    <Select value={duration} onValueChange={setDuration}>
                      <SelectTrigger>
                        <SelectValue placeholder={`${appointment.durationMinutes} ${t('appointment.minutes')}`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 {t('appointment.minutes')}</SelectItem>
                        <SelectItem value="60">60 {t('appointment.minutes')}</SelectItem>
                        <SelectItem value="90">90 {t('appointment.minutes')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('appointment.rejectionReason')}</Label>
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder={language === 'RU' ? 'Причина отказа (необязательно)' : 'Պատճառ (ոչ պարտադիր)'}
                      maxLength={150}
                    />
                  </div>
                </>
              )}

              {appointment.status === 'CONFIRMED' && (
                <div className="space-y-2">
                  <Label>{t('appointment.rejectionReason')}</Label>
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder={language === 'RU' ? 'Причина отмены' : 'Չեղարկման պատճառ'}
                      maxLength={150}
                    />
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          {isEditMode ? (
            <>
              <Button
                variant="outline"
                onClick={() => setIsEditMode(false)}
                disabled={isLoading}
              >
                {language === 'ARM' ? 'Չեղարկել' : 'Отмена'}
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={isLoading}
                className="flex items-center gap-2"
                data-testid="button-save-appointment"
              >
                <Save className="h-4 w-4" />
                {language === 'ARM' ? 'Պահպանել' : 'Сохранить'}
              </Button>
            </>
          ) : (
            <>
              {appointment.status === 'PENDING' && (
                <>
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={isLoading}
                    className="flex items-center gap-2"
                    data-testid="button-reject-appointment"
                  >
                    <X className="h-4 w-4" />
                    {t('appointment.reject')}
                  </Button>
                  <Button
                    onClick={handleConfirm}
                    disabled={isLoading}
                    className="flex items-center gap-2 bg-success hover:bg-success/90"
                    data-testid="button-confirm-appointment"
                  >
                    <Check className="h-4 w-4" />
                    {t('appointment.approve')}
                  </Button>
                </>
              )}
              {appointment.status === 'CONFIRMED' && (
                <Button
                  variant="destructive"
                  onClick={handleCancel}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                  data-testid="button-cancel-appointment"
                >
                  <Ban className="h-4 w-4" />
                  {t('appointment.cancel')}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
