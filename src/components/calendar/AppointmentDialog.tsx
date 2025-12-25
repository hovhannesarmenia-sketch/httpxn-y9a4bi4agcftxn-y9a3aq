import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ru, hy } from 'date-fns/locale';
import { Clock, User, Phone, Calendar, FileText, Check, X, Ban } from 'lucide-react';

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

  const locale = language === 'ARM' ? hy : ru;

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{t('appointment.new')}</DialogTitle>
            <StatusBadge status={appointment.status} />
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Patient Info */}
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

          {/* Appointment Details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Calendar className="h-4 w-4 text-primary" />
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
                  placeholder={language === 'RU' ? 'Причина отказа (необязательно)' : 'Մdelays պdelays ( delays)'}
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
        </div>

        <DialogFooter className="flex gap-2">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
