import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ru, hy } from 'date-fns/locale';
import { CalendarIcon, Clock, User, Phone, Search, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ManualBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date | null;
  onSuccess: () => void;
}

type Patient = {
  id: string;
  first_name: string;
  last_name: string | null;
  phone_number: string | null;
  telegram_user_id: number;
};

type Service = {
  id: string;
  name_arm: string;
  name_ru: string;
  default_duration_minutes: number;
};

type Doctor = {
  id: string;
  work_day_start_time: string | null;
  work_day_end_time: string | null;
  slot_step_minutes: number | null;
};

export function ManualBookingDialog({ open, onOpenChange, selectedDate, onSuccess }: ManualBookingDialogProps) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const locale = language === 'ARM' ? hy : ru;

  const [patientTab, setPatientTab] = useState<'existing' | 'new'>('existing');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [appointmentDate, setAppointmentDate] = useState<Date | undefined>(selectedDate || undefined);
  const [appointmentTime, setAppointmentTime] = useState<string>('');
  const [duration, setDuration] = useState<number>(30);
  const [customReason, setCustomReason] = useState<string>('');

  // New patient form
  const [newPatientFirstName, setNewPatientFirstName] = useState('');
  const [newPatientLastName, setNewPatientLastName] = useState('');
  const [newPatientPhone, setNewPatientPhone] = useState('');

  useEffect(() => {
    if (open) {
      fetchData();
      if (selectedDate) {
        setAppointmentDate(selectedDate);
      }
    }
  }, [open, selectedDate]);

  useEffect(() => {
    if (selectedServiceId && services.length > 0) {
      const service = services.find(s => s.id === selectedServiceId);
      if (service) {
        setDuration(service.default_duration_minutes);
      }
    }
  }, [selectedServiceId, services]);

  const fetchData = async () => {
    if (!user?.id) return;
    
    // Fetch doctor first using user_id
    const doctorRes = await supabase
      .from('doctor')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (doctorRes.data) {
      setDoctor(doctorRes.data);
      
      // Fetch services for this doctor
      const servicesRes = await supabase
        .from('services')
        .select('*')
        .eq('doctor_id', doctorRes.data.id)
        .eq('is_active', true)
        .order('sort_order');
      
      // Fetch patients (doctor can see their patients via RLS)
      const patientsRes = await supabase
        .from('patients')
        .select('*')
        .order('first_name');
      
      if (patientsRes.data) setPatients(patientsRes.data);
      if (servicesRes.data) setServices(servicesRes.data);
    }
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

  const filteredPatients = patients.filter(p => {
    const fullName = `${p.first_name} ${p.last_name || ''}`.toLowerCase();
    const phone = p.phone_number || '';
    return fullName.includes(searchQuery.toLowerCase()) || phone.includes(searchQuery);
  });

  const resetForm = () => {
    setPatientTab('existing');
    setSelectedPatientId('');
    setSelectedServiceId('');
    setAppointmentDate(selectedDate || undefined);
    setAppointmentTime('');
    setDuration(30);
    setCustomReason('');
    setNewPatientFirstName('');
    setNewPatientLastName('');
    setNewPatientPhone('');
    setSearchQuery('');
  };

  const handleSubmit = async () => {
    if (!doctor) {
      toast.error(language === 'ARM' ? '\u0532\u056A\u056B\u0577\u056F\u0568 \u0579\u056B \u0563\u057F\u0576\u057E\u0565\u056C' : 'Врач не найден');
      return;
    }

    if (!appointmentDate || !appointmentTime) {
      toast.error(language === 'ARM' ? '\u0538\u0576\u057F\u0580\u0565\u0584 \u0561\u0574\u057D\u0561\u0569\u056B\u057E\u0568 \u0587 \u056A\u0561\u0574\u0568' : 'Выберите дату и время');
      return;
    }

    setIsSubmitting(true);

    try {
      let patientId = selectedPatientId;

      // Create new patient if needed
      if (patientTab === 'new') {
      if (!newPatientFirstName.trim()) {
          toast.error(language === 'ARM' ? '\u0533\u0580\u0565\u0584 \u0570\u056B\u057E\u0561\u0576\u0564\u056B \u0561\u0576\u0578\u0582\u0576\u0568' : 'Введите имя пациента');
          setIsSubmitting(false);
          return;
        }

        // Generate a unique telegram_user_id for manual bookings (negative to distinguish)
        const manualTelegramId = -Math.floor(Date.now() / 1000);

        const { data: newPatient, error: patientError } = await supabase
          .from('patients')
          .insert({
            first_name: newPatientFirstName.trim(),
            last_name: newPatientLastName.trim() || null,
            phone_number: newPatientPhone.trim() || null,
            telegram_user_id: manualTelegramId,
            language: language,
          })
          .select()
          .single();

        if (patientError) {
          throw patientError;
        }

        patientId = newPatient.id;
      }

      if (!patientId) {
        toast.error(language === 'ARM' ? '\u0538\u0576\u057F\u0580\u0565\u0584 \u0570\u056B\u057E\u0561\u0576\u0564\u056B\u0576' : 'Выберите пациента');
        setIsSubmitting(false);
        return;
      }

      // Create appointment datetime
      const [hours, minutes] = appointmentTime.split(':').map(Number);
      const startDateTime = new Date(appointmentDate);
      startDateTime.setHours(hours, minutes, 0, 0);

      const { error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          doctor_id: doctor.id,
          patient_id: patientId,
          service_id: selectedServiceId || null,
          start_date_time: startDateTime.toISOString(),
          duration_minutes: duration,
          status: 'CONFIRMED',
          source: 'Manual',
          custom_reason: customReason.trim() || null,
        });

      if (appointmentError) {
        if (appointmentError.message.includes('overlap')) {
          toast.error(language === 'ARM' ? '\u053A\u0561\u0574\u0568 \u0566\u0562\u0561\u0572\u057E\u0561\u056E \u0567' : 'Время занято другой записью');
        } else {
          throw appointmentError;
        }
        return;
      }

      toast.success(language === 'ARM' ? '\u0533\u0580\u0561\u0576\u0581\u0578\u0582\u0574\u0568 \u057D\u057F\u0565\u0572\u056E\u057E\u0565\u0581' : 'Запись успешно создана');
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error creating appointment:', error);
      toast.error(language === 'ARM' ? '\u054D\u056D\u0561\u056C \u057D\u057F\u0565\u0572\u056E\u0574\u0561\u0576 \u056A\u0561\u0574\u0561\u0576\u0561\u056F' : 'Ошибка при создании записи');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            {language === 'ARM' ? '\u0546\u0578\u0580 \u0563\u0580\u0561\u0576\u0581\u0578\u0582\u0574' : 'Новая запись'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Patient Selection */}
          <div className="space-y-3">
            <Label className="text-base font-medium">
              {language === 'ARM' ? '\u0540\u056B\u057E\u0561\u0576\u0564' : 'Пациент'}
            </Label>
            
            <Tabs value={patientTab} onValueChange={(v) => setPatientTab(v as 'existing' | 'new')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="existing">
                  {language === 'ARM' ? '\u0533\u0580\u0561\u0576\u0581\u057E\u0561\u056E \u0570\u056B\u057E\u0561\u0576\u0564' : 'Существующий'}
                </TabsTrigger>
                <TabsTrigger value="new">
                  {language === 'ARM' ? '\u0546\u0578\u0580 \u0570\u056B\u057E\u0561\u0576\u0564' : 'Новый'}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="existing" className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={language === 'ARM' ? '\u0548\u0580\u0578\u0576\u0565\u056C...' : 'Поиск по имени или телефону...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'ARM' ? '\u0538\u0576\u057F\u0580\u0565\u0584 \u0570\u056B\u057E\u0561\u0576\u0564\u056B\u0576' : 'Выберите пациента'} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredPatients.map((patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{patient.first_name} {patient.last_name}</span>
                          {patient.phone_number && (
                            <span className="text-xs text-muted-foreground">({patient.phone_number})</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TabsContent>

              <TabsContent value="new" className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{language === 'ARM' ? '\u0531\u0576\u0578\u0582\u0576' : 'Имя'} *</Label>
                    <Input
                      value={newPatientFirstName}
                      onChange={(e) => setNewPatientFirstName(e.target.value)}
                      placeholder={language === 'ARM' ? '\u0531\u0576\u0578\u0582\u0576' : 'Имя'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'ARM' ? '\u0531\u0566\u0563\u0561\u0576\u0578\u0582\u0576' : 'Фамилия'}</Label>
                    <Input
                      value={newPatientLastName}
                      onChange={(e) => setNewPatientLastName(e.target.value)}
                      placeholder={language === 'ARM' ? '\u0531\u0566\u0563\u0561\u0576\u0578\u0582\u0576' : 'Фамилия'}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {language === 'ARM' ? '\u0540\u0565\u057C\u0561\u056D\u0578\u057D' : 'Телефон'}
                  </Label>
                  <Input
                    value={newPatientPhone}
                    onChange={(e) => setNewPatientPhone(e.target.value)}
                    placeholder="+374 XX XXX XXX"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Service Selection */}
          <div className="space-y-2">
            <Label>{language === 'ARM' ? '\u053E\u0561\u057C\u0561\u0575\u0578\u0582\u0569\u0575\u0578\u0582\u0576' : 'Услуга'}</Label>
            <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
              <SelectTrigger>
                <SelectValue placeholder={language === 'ARM' ? '\u0538\u0576\u057F\u0580\u0565\u0584 (\u0578\u0579 \u057A\u0561\u0580\u057F\u0561\u0564\u056B\u0580)' : 'Выберите услугу (необязательно)'} />
              </SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {language === 'ARM' ? service.name_arm : service.name_ru} ({service.default_duration_minutes} {language === 'ARM' ? '\u0580\u0578\u057A\u0565' : 'мин'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                {language === 'ARM' ? '\u0531\u0574\u057D\u0561\u0569\u056B\u057E' : 'Дата'}
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !appointmentDate && 'text-muted-foreground'
                    )}
                  >
                    {appointmentDate ? format(appointmentDate, 'PPP', { locale }) : (language === 'ARM' ? '\u0538\u0576\u057F\u0580\u0565\u0584 \u0561\u0574\u057D\u0561\u0569\u056B\u057E\u0568' : 'Выберите дату')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={appointmentDate}
                    onSelect={setAppointmentDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {language === 'ARM' ? '\u053A\u0561\u0574' : 'Время'}
              </Label>
              <Select value={appointmentTime} onValueChange={setAppointmentTime}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ARM' ? '\u0538\u0576\u057F\u0580\u0565\u0584' : 'Выберите'} />
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
            <Label>{language === 'ARM' ? '\u054F\u0587\u0578\u0572\u0578\u0582\u0569\u0575\u0578\u0582\u0576 (\u0580\u0578\u057A\u0565)' : 'Длительность (минуты)'}</Label>
            <Select value={duration.toString()} onValueChange={(v) => setDuration(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[15, 30, 45, 60, 90, 120].map((min) => (
                  <SelectItem key={min} value={min.toString()}>
                    {min} {language === 'ARM' ? '\u0580\u0578\u057A\u0565' : 'мин'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Reason */}
          <div className="space-y-2">
            <Label>{language === 'ARM' ? '\u0546\u0577\u0578\u0582\u0574\u0576\u0565\u0580' : 'Примечание'}</Label>
            <Textarea
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder={language === 'ARM' ? '\u053C\u0580\u0561\u0581\u0578\u0582\u0581\u056B\u0579 \u057F\u0565\u0572\u0565\u056F\u0578\u0582\u0569\u0575\u0578\u0582\u0576...' : 'Дополнительная информация...'}
              rows={2}
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {language === 'ARM' ? '\u0549\u0565\u0572\u0561\u0580\u056F\u0565\u056C' : 'Отмена'}
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                language === 'ARM' ? '\u054D\u057F\u0565\u0572\u056E\u057E\u0578\u0582\u0574 \u0567...' : 'Создание...'
              ) : (
                language === 'ARM' ? '\u054D\u057F\u0565\u0572\u056E\u0565\u056C \u0563\u0580\u0561\u0576\u0581\u0578\u0582\u0574' : 'Создать запись'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
