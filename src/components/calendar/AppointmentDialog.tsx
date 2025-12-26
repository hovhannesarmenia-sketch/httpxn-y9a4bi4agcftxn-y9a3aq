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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ru, hy } from 'date-fns/locale';
import { Clock, User, Phone, Calendar as CalendarIcon, FileText, Check, X, Ban, Pencil, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

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

type Doctor = {
  id: string;
  work_day_start_time: string | null;
  work_day_end_time: string | null;
  slot_step_minutes: number | null;
};

interface AppointmentDialogProps {
  appointment: Appointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function AppointmentDialog({ appointment, open, onOpenChange, onUpdate }: AppointmentDialogProps) {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [duration, setDuration] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [doctor, setDoctor] = useState<Doctor | null>(null);

  // Edit form state
  const [editDate, setEditDate] = useState<Date | undefined>();
  const [editTime, setEditTime] = useState<string>('');
  const [editDuration, setEditDuration] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');

  const locale = language === 'ARM' ? hy : ru;

  useEffect(() => {
    if (open && appointment) {
      // Reset edit mode when opening
      setIsEditMode(false);
      setDuration('');
      setRejectionReason('');
      
      // Initialize edit form values
      const appointmentDate = new Date(appointment.start_date_time);
      setEditDate(appointmentDate);
      setEditTime(format(appointmentDate, 'HH:mm'));
      setEditDuration(appointment.duration_minutes.toString());
      setEditNotes(appointment.custom_reason || '');
      
      // Fetch doctor for time slots
      fetchDoctor();
    }
  }, [open, appointment]);

  const fetchDoctor = async () => {
    const { data } = await supabase
      .from('doctor')
      .select('id, work_day_start_time, work_day_end_time, slot_step_minutes')
      .limit(1)
      .maybeSingle();
    if (data) setDoctor(data);
  };

  const generateTimeSlots = () => {
    if (!doctor) return [];
    
    const startTime = doctor.work_day_start_time || '09:00:00';
    const endTime = doctor.work_day_end_time || '18:00:00';
    const step = doctor.slot_step_minutes || 15;

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
    const finalDuration = duration ? parseInt(duration) : appointment.duration_minutes;

    const { error } = await supabase
      .from('appointments')
      .update({
        status: 'CONFIRMED',
        duration_minutes: finalDuration,
      })
      .eq('id', appointment.id);

    if (error) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: t('common.success'),
        description: t('appointment.confirmed'),
      });
      onUpdate();
      onOpenChange(false);
    }
    setIsLoading(false);
  };

  const handleReject = async () => {
    setIsLoading(true);

    const { error } = await supabase
      .from('appointments')
      .update({
        status: 'REJECTED',
        rejection_reason: rejectionReason || null,
      })
      .eq('id', appointment.id);

    if (error) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: t('common.success'),
        description: t('appointment.rejected'),
      });
      onUpdate();
      onOpenChange(false);
    }
    setIsLoading(false);
    setRejectionReason('');
  };

  const handleCancel = async () => {
    setIsLoading(true);

    const { error } = await supabase
      .from('appointments')
      .update({
        status: 'CANCELLED_BY_DOCTOR',
        rejection_reason: rejectionReason || null,
      })
      .eq('id', appointment.id);

    if (error) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: t('common.success'),
        description: t('appointment.cancelled'),
      });
      onUpdate();
      onOpenChange(false);
    }
    setIsLoading(false);
    setRejectionReason('');
  };

  const handleSaveEdit = async () => {
    if (!editDate || !editTime) {
      toast({
        title: t('common.error'),
        description: language === 'ARM' ? 'Ընdelays delays delays' : 'Выберите дату и время',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    // Create new datetime
    const [hours, minutes] = editTime.split(':').map(Number);
    const newDateTime = new Date(editDate);
    newDateTime.setHours(hours, minutes, 0, 0);

    const { error } = await supabase
      .from('appointments')
      .update({
        start_date_time: newDateTime.toISOString(),
        duration_minutes: parseInt(editDuration),
        custom_reason: editNotes.trim() || null,
      })
      .eq('id', appointment.id);

    if (error) {
      if (error.message.includes('overlap')) {
        toast({
          title: t('common.error'),
          description: language === 'ARM' ? 'Delays delays delays' : 'Время занято другой записью',
          variant: 'destructive',
        });
      } else {
        toast({
          title: t('common.error'),
          description: error.message,
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: t('common.success'),
        description: language === 'ARM' ? 'Delays delays' : 'Запись обновлена',
      });
      setIsEditMode(false);
      onUpdate();
      onOpenChange(false);
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
                ? (language === 'ARM' ? 'Delays delays' : 'Редактирование записи')
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
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              <StatusBadge status={appointment.status} />
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Patient Info - Always shown */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <User className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">
                {appointment.patients?.first_name} {appointment.patients?.last_name}
              </p>
              {appointment.patients?.phone_number && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <Phone className="h-3 w-3" />
                  {appointment.patients.phone_number}
                </p>
              )}
            </div>
          </div>

          {/* Edit Mode */}
          {isEditMode ? (
            <>
              {/* Date and Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {language === 'ARM' ? 'Delays' : 'Дата'}
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
                        {editDate ? format(editDate, 'PPP', { locale }) : (language === 'ARM' ? 'Delays' : 'Выберите')}
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
                    {language === 'ARM' ? 'Delays' : 'Время'}
                  </Label>
                  <Select value={editTime} onValueChange={setEditTime}>
                    <SelectTrigger>
                      <SelectValue placeholder={language === 'ARM' ? 'Delays' : 'Выберите'} />
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

              {/* Duration */}
              <div className="space-y-2">
                <Label>{language === 'ARM' ? 'Delays (delays)' : 'Длительность (мин)'}</Label>
                <Select value={editDuration} onValueChange={setEditDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[15, 30, 45, 60, 90, 120].map((min) => (
                      <SelectItem key={min} value={min.toString()}>
                        {min} {language === 'ARM' ? 'delays' : 'мин'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>{language === 'ARM' ? 'Delays' : 'Примечание'}</Label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder={language === 'ARM' ? 'Delays delays delays' : 'Дополнительная информация...'}
                  rows={2}
                />
              </div>
            </>
          ) : (
            <>
              {/* View Mode - Appointment Details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <CalendarIcon className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('appointment.date')}</p>
                    <p className="text-sm font-medium">
                      {format(new Date(appointment.start_date_time), 'd MMM yyyy', { locale })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <Clock className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('appointment.time')}</p>
                    <p className="text-sm font-medium">
                      {format(new Date(appointment.start_date_time), 'HH:mm')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Duration display */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Clock className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">{t('appointment.duration')}</p>
                  <p className="text-sm font-medium">{appointment.duration_minutes} {t('appointment.minutes')}</p>
                </div>
              </div>

              {/* Service */}
              {appointment.services && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <FileText className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('appointment.service')}</p>
                    <p className="font-medium">
                      {language === 'ARM' ? appointment.services.name_arm : appointment.services.name_ru}
                    </p>
                  </div>
                </div>
              )}

              {/* Custom Reason */}
              {appointment.custom_reason && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">{t('appointment.reason')}</p>
                  <p className="text-sm">{appointment.custom_reason}</p>
                </div>
              )}

              {/* Actions for PENDING */}
              {appointment.status === 'PENDING' && (
                <>
                  <div className="space-y-2">
                    <Label>{t('appointment.duration')}</Label>
                    <Select value={duration} onValueChange={setDuration}>
                      <SelectTrigger>
                        <SelectValue placeholder={`${appointment.duration_minutes} ${t('appointment.minutes')}`} />
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
                      placeholder={language === 'RU' ? 'Причина отказа (необязательно)' : 'Мdelays пdelays (delays)'}
                      maxLength={150}
                    />
                  </div>
                </>
              )}

              {/* Actions for CONFIRMED */}
              {appointment.status === 'CONFIRMED' && (
                <div className="space-y-2">
                  <Label>{t('appointment.rejectionReason')}</Label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder={language === 'RU' ? 'Причина отмены' : 'Чdelays пdelays'}
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
                {language === 'ARM' ? 'Delays' : 'Отмена'}
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {language === 'ARM' ? 'Delays' : 'Сохранить'}
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
                  >
                    <X className="h-4 w-4" />
                    {t('appointment.reject')}
                  </Button>
                  <Button
                    onClick={handleConfirm}
                    disabled={isLoading}
                    className="flex items-center gap-2 bg-success hover:bg-success/90"
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
