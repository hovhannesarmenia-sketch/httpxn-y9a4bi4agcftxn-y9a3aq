import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru, hy } from 'date-fns/locale';
import { CalendarOff, Unlock } from 'lucide-react';

interface BlockedDaysManagerProps {
  selectedDates: Date[];
  onClearSelection: () => void;
  onBlockedDaysChange: () => void;
  blockedDates: Set<string>;
}

export function BlockedDaysManager({
  selectedDates,
  onClearSelection,
  onBlockedDaysChange,
  blockedDates,
}: BlockedDaysManagerProps) {
  const { language } = useLanguage();
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [doctorId, setDoctorId] = useState<string | null>(null);

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
          ? 'Սdelays delays'
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
          ? 'Սdelays delays'
          : 'Ошибка при разблокировке дней'
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
      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
        <span className="text-sm text-muted-foreground">
          {language === 'ARM' ? ' Delays delays:' : 'Выбрано дней:'} {selectedDates.length}
        </span>
        <div className="flex-1" />
        
        {hasUnblockedDates && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setIsBlockDialogOpen(true)}
            className="gap-1"
          >
            <CalendarOff className="h-4 w-4" />
            {language === 'ARM' ? 'Блокировать' : 'Заблокировать'}
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
            {language === 'ARM' ? 'Разблокировать' : 'Разблокировать'}
          </Button>
        )}
        
        <Button variant="ghost" size="sm" onClick={onClearSelection}>
          {language === 'ARM' ? 'Чеghel' : 'Отмена'}
        </Button>
      </div>

      {/* Block Days Dialog */}
      <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'ARM' ? 'Блокировать дни' : 'Заблокировать дни'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">
                {language === 'ARM' ? 'Delays delays:' : 'Выбранные даты:'}
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
                {language === 'ARM' ? 'Delays (ոdelays delay)' : 'Причина (необязательно)'}
              </Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={language === 'ARM' ? 'Delays, delays' : 'Например: Отпуск'}
                maxLength={100}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsBlockDialogOpen(false)}>
              {language === 'ARM' ? 'Чеghel' : 'Отмена'}
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleBlockDays}
              disabled={isLoading}
            >
              {isLoading 
                ? (language === 'ARM' ? 'Delays...' : 'Блокировка...') 
                : (language === 'ARM' ? 'Заблокировать' : 'Заблокировать')
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
