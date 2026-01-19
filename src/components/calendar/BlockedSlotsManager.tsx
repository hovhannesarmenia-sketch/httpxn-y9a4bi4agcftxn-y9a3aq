import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { apiRequest } from '@/lib/queryClient';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru, hy } from 'date-fns/locale';
import { Clock, Unlock, X, Plus } from 'lucide-react';

type BlockedSlot = {
  id: string;
  blockedDate: string;
  startTime: string;
  durationMinutes: number;
  reason: string | null;
};

interface BlockedSlotsManagerProps {
  selectedDate: Date | null;
  onSlotsChange?: () => void;
}

export function BlockedSlotsManager({ selectedDate, onSlotsChange }: BlockedSlotsManagerProps) {
  const { language } = useLanguage();
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [startTime, setStartTime] = useState('12:00');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [reason, setReason] = useState('');

  const locale = language === 'ARM' ? hy : ru;

  const fetchBlockedSlots = useCallback(async () => {
    if (!selectedDate) return;
    
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const res = await fetch(`/api/blocked-slots?date=${dateStr}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setBlockedSlots(data);
      }
    } catch (error) {
      console.error('Failed to fetch blocked slots:', error);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchBlockedSlots();
  }, [fetchBlockedSlots]);

  const handleBlockSlot = async () => {
    if (!selectedDate) return;

    setIsLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      await apiRequest('POST', '/api/blocked-slots', {
        blockedDate: dateStr,
        startTime,
        durationMinutes: parseInt(durationMinutes, 10),
        reason: reason.trim() || null
      });

      toast.success(
        language === 'ARM'
          ? '\u0546\u0577\u057E\u0561\u056E \u056A\u0561\u0574\u0568 \u0561\u0580\u0563\u0565\u056C\u0561\u0583\u0561\u056F\u057E\u0565\u0581'
          : '\u0412\u0440\u0435\u043C\u044F \u0443\u0441\u043F\u0435\u0448\u043D\u043E \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u043E'
      );

      setIsDialogOpen(false);
      setStartTime('12:00');
      setDurationMinutes('60');
      setReason('');
      fetchBlockedSlots();
      onSlotsChange?.();
    } catch (error) {
      console.error('Error blocking slot:', error);
      toast.error(
        language === 'ARM'
          ? '\u054D\u056D\u0561\u056C'
          : '\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u043A\u0435'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnblockSlot = async (slotId: string) => {
    setIsLoading(true);
    try {
      await apiRequest('DELETE', `/api/blocked-slots/${slotId}`, {});

      toast.success(
        language === 'ARM'
          ? '\u0546\u0577\u057E\u0561\u056E \u056A\u0561\u0574\u0568 \u0561\u057A\u0561\u0580\u0563\u0565\u056C\u0561\u0583\u0561\u056F\u057E\u0565\u0581'
          : '\u0412\u0440\u0565\u043C\u044F \u0443\u0441\u043F\u0435\u0448\u043D\u043E \u0440\u0430\u0437\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u043E'
      );

      fetchBlockedSlots();
      onSlotsChange?.();
    } catch (error) {
      console.error('Error unblocking slot:', error);
      toast.error(
        language === 'ARM'
          ? '\u054D\u056D\u0561\u056C'
          : '\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u0440\u0430\u0437\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u043A\u0435'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimeRange = (startTime: string, durationMinutes: number) => {
    const [hours, mins] = startTime.split(':').map(Number);
    const startMinutes = hours * 60 + mins;
    const endMinutes = startMinutes + durationMinutes;
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    return `${startTime} - ${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
  };

  const generateTimeOptions = () => {
    const options = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        options.push(time);
      }
    }
    return options;
  };

  if (!selectedDate) return null;

  return (
    <>
      <div className="mt-4 border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {language === 'ARM' ? '\u0531\u0580\u0563\u0565\u056C\u0561\u0583\u0561\u056F\u057E\u0561\u056E \u056A\u0561\u0574\u0565\u0580' : '\u0417\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u043E\u0435 \u0432\u0440\u0435\u043C\u044F'}
          </h4>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDialogOpen(true)}
            className="gap-1"
            data-testid="button-block-time"
          >
            <Plus className="h-4 w-4" />
            {language === 'ARM' ? '\u0531\u0580\u0563\u0565\u056C\u0561\u0583\u0561\u056F\u0565\u056C \u056A\u0561\u0574' : '\u0417\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u0442\u044C'}
          </Button>
        </div>

        {blockedSlots.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">
            {language === 'ARM' 
              ? '\u0531\u0580\u0563\u0565\u056C\u0561\u0583\u0561\u056F\u057E\u0561\u056E \u056A\u0561\u0574\u0565\u0580 \u0579\u056F\u0561\u0576'
              : '\u041D\u0435\u0442 \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u043E\u0433\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u0438'}
          </p>
        ) : (
          <div className="space-y-2">
            {blockedSlots.map((slot) => (
              <div 
                key={slot.id} 
                className="flex items-center justify-between p-2 bg-muted/50 rounded-lg border"
                data-testid={`blocked-slot-${slot.id}`}
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-medium">
                    {formatTimeRange(slot.startTime, slot.durationMinutes)}
                  </span>
                  {slot.reason && (
                    <span className="text-xs text-muted-foreground">
                      ({slot.reason})
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUnblockSlot(slot.id)}
                  disabled={isLoading}
                  className="h-7 w-7 p-0"
                  data-testid={`button-unblock-slot-${slot.id}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'ARM' ? '\u0531\u0580\u0563\u0565\u056C\u0561\u0583\u0561\u056F\u0565\u056C \u056A\u0561\u0574\u0568' : '\u0417\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0432\u0440\u0435\u043C\u044F'}
            </DialogTitle>
            <DialogDescription>
              {language === 'ARM' 
                ? `\u0538\u0576\u057F\u0580\u0565\u0584 \u056A\u0561\u0574\u0568 ${format(selectedDate, 'd MMMM yyyy', { locale })} \u0585\u0580\u057E\u0561 \u0570\u0561\u0574\u0561\u0580`
                : `\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0432\u0440\u0435\u043C\u044F \u0434\u043B\u044F ${format(selectedDate, 'd MMMM yyyy', { locale })}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{language === 'ARM' ? '\u054D\u056F\u0566\u0562\u0568' : '\u041D\u0430\u0447\u0430\u043B\u043E'}</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger data-testid="select-start-time">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {generateTimeOptions().map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{language === 'ARM' ? '\u054F\u0587\u0578\u0572\u0578\u0582\u0569\u0575\u0578\u0582\u0576 (\u0580\u0578\u057A\u0565)' : '\u0414\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C (\u043C\u0438\u043D)'}</Label>
              <Select value={durationMinutes} onValueChange={setDurationMinutes}>
                <SelectTrigger data-testid="select-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 {language === 'ARM' ? '\u0580\u0578\u057A\u0565' : '\u043C\u0438\u043D'}</SelectItem>
                  <SelectItem value="30">30 {language === 'ARM' ? '\u0580\u0578\u057A\u0565' : '\u043C\u0438\u043D'}</SelectItem>
                  <SelectItem value="45">45 {language === 'ARM' ? '\u0580\u0578\u057A\u0565' : '\u043C\u0438\u043D'}</SelectItem>
                  <SelectItem value="60">60 {language === 'ARM' ? '\u0580\u0578\u057A\u0565' : '\u043C\u0438\u043D'}</SelectItem>
                  <SelectItem value="90">90 {language === 'ARM' ? '\u0580\u0578\u057A\u0565' : '\u043C\u0438\u043D'}</SelectItem>
                  <SelectItem value="120">120 {language === 'ARM' ? '\u0580\u0578\u057A\u0565' : '\u043C\u0438\u043D'}</SelectItem>
                  <SelectItem value="180">180 {language === 'ARM' ? '\u0580\u0578\u057A\u0565' : '\u043C\u0438\u043D'}</SelectItem>
                  <SelectItem value="240">240 {language === 'ARM' ? '\u0580\u0578\u057A\u0565' : '\u043C\u0438\u043D'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{language === 'ARM' ? '\u054A\u0561\u057F\u0573\u0561\u057C (\u0578\u0579 \u057A\u0561\u0580\u057F\u0561\u0564\u056B\u0580)' : '\u041F\u0440\u0438\u0447\u0438\u043D\u0430 (\u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E)'}</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={language === 'ARM' ? '\u0555\u0580\u056B\u0576\u0561\u056F\u055D \u0543\u0561\u0577' : '\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: \u041E\u0431\u0435\u0434'}
                data-testid="input-reason"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              data-testid="button-cancel-block"
            >
              {language === 'ARM' ? '\u0549\u0565\u0572\u0561\u0580\u056F\u0565\u056C' : '\u041E\u0442\u043C\u0435\u043D\u0430'}
            </Button>
            <Button
              onClick={handleBlockSlot}
              disabled={isLoading}
              data-testid="button-confirm-block"
            >
              {language === 'ARM' ? '\u0531\u0580\u0563\u0565\u056C\u0561\u0583\u0561\u056F\u0565\u056C' : '\u0417\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u0442\u044C'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
