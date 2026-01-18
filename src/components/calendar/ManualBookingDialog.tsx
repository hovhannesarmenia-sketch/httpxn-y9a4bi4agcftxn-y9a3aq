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
import { apiRequest } from '@/lib/queryClient';
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
  firstName: string;
  lastName: string | null;
  phoneNumber: string | null;
  telegramUserId: number;
};

type Service = {
  id: string;
  nameArm: string;
  nameRu: string;
  defaultDurationMinutes: number;
};

type Doctor = {
  id: string;
  workDayStartTime: string | null;
  workDayEndTime: string | null;
  slotStepMinutes: number | null;
};

export function ManualBookingDialog({ open, onOpenChange, selectedDate, onSuccess }: ManualBookingDialogProps) {
  const { language } = useLanguage();
  const locale = language === 'ARM' ? hy : ru;

  const [patientTab, setPatientTab] = useState<'existing' | 'new'>('existing');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [appointmentDate, setAppointmentDate] = useState<Date | undefined>(selectedDate || undefined);
  const [appointmentTime, setAppointmentTime] = useState<string>('');
  const [duration, setDuration] = useState<number>(30);
  const [customReason, setCustomReason] = useState<string>('');

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
        setDuration(service.defaultDurationMinutes);
      }
    }
  }, [selectedServiceId, services]);

  const fetchData = async () => {
    try {
      const [doctorRes, servicesRes, patientsRes] = await Promise.all([
        fetch('/api/doctor', { credentials: 'include' }),
        fetch('/api/services', { credentials: 'include' }),
        fetch('/api/patients', { credentials: 'include' })
      ]);

      if (doctorRes.ok) {
        const doctorData = await doctorRes.json();
        setDoctor(doctorData);
      }
      if (servicesRes.ok) {
        const servicesData = await servicesRes.json();
        setServices(servicesData);
      }
      if (patientsRes.ok) {
        const patientsData = await patientsRes.json();
        setPatients(patientsData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

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

  const filteredPatients = patients.filter(p => {
    const fullName = `${p.firstName} ${p.lastName || ''}`.toLowerCase();
    const phone = p.phoneNumber || '';
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
      toast.error(language === 'ARM' ? 'Բժիշկը չի գտնվել' : 'Врач не найден');
      return;
    }

    if (!appointmentDate || !appointmentTime) {
      toast.error(language === 'ARM' ? 'Ընտրեք ամսաթիվը և ժամը' : 'Выберите дату и время');
      return;
    }

    setIsSubmitting(true);

    try {
      let patientId = selectedPatientId;

      if (patientTab === 'new') {
        if (!newPatientFirstName.trim()) {
          toast.error(language === 'ARM' ? 'Գրեք հիվանդի անունը' : 'Введите имя пациента');
          setIsSubmitting(false);
          return;
        }

        const manualTelegramId = -Math.floor(Date.now() / 1000);

        const res = await apiRequest('POST', '/api/patients', {
          firstName: newPatientFirstName.trim(),
          lastName: newPatientLastName.trim() || null,
          phoneNumber: newPatientPhone.trim() || null,
          telegramUserId: manualTelegramId,
          language: language,
        });

        const newPatient = await res.json();
        patientId = newPatient.id;
      }

      if (!patientId) {
        toast.error(language === 'ARM' ? 'Ընտրեք հիվանդին' : 'Выберите пациента');
        setIsSubmitting(false);
        return;
      }

      const [hours, minutes] = appointmentTime.split(':').map(Number);
      const startDateTime = new Date(appointmentDate);
      startDateTime.setHours(hours, minutes, 0, 0);

      await apiRequest('POST', '/api/appointments', {
        patientId,
        serviceId: selectedServiceId || null,
        startDateTime: startDateTime.toISOString(),
        durationMinutes: duration,
        status: 'CONFIRMED',
        source: 'Manual',
        customReason: customReason.trim() || null,
      });

      toast.success(language === 'ARM' ? 'Գրանցումը ստեղծվեց' : 'Запись успешно создана');
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error creating appointment:', error);
      if (error.message?.includes('overlap')) {
        toast.error(language === 'ARM' ? 'Ժամը զբաղված է' : 'Время занято другой записью');
      } else {
        toast.error(language === 'ARM' ? 'Սխալ ստեղծման ժամանակ' : 'Ошибка при создании записи');
      }
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
            {language === 'ARM' ? 'Նոր գրանցում' : 'Новая запись'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <Label className="text-base font-medium">
              {language === 'ARM' ? 'Հիվանդ' : 'Пациент'}
            </Label>
            
            <Tabs value={patientTab} onValueChange={(v) => setPatientTab(v as 'existing' | 'new')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="existing" data-testid="tab-existing-patient">
                  {language === 'ARM' ? 'Գոյություն ունեցող' : 'Существующий'}
                </TabsTrigger>
                <TabsTrigger value="new" data-testid="tab-new-patient">
                  {language === 'ARM' ? 'Նոր' : 'Новый'}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="existing" className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={language === 'ARM' ? 'Որոնել...' : 'Поиск по имени или телефону...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-patient-search"
                  />
                </div>
                
                <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                  <SelectTrigger data-testid="select-patient">
                    <SelectValue placeholder={language === 'ARM' ? 'Ընտրեք հիվանդին' : 'Выберите пациента'} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredPatients.map((patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{patient.firstName} {patient.lastName}</span>
                          {patient.phoneNumber && (
                            <span className="text-xs text-muted-foreground">({patient.phoneNumber})</span>
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
                    <Label>{language === 'ARM' ? 'Անուն' : 'Имя'} *</Label>
                    <Input
                      value={newPatientFirstName}
                      onChange={(e) => setNewPatientFirstName(e.target.value)}
                      placeholder={language === 'ARM' ? 'Անուն' : 'Имя'}
                      data-testid="input-new-patient-firstname"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'ARM' ? 'Ազգանուն' : 'Фамилия'}</Label>
                    <Input
                      value={newPatientLastName}
                      onChange={(e) => setNewPatientLastName(e.target.value)}
                      placeholder={language === 'ARM' ? 'Ազգանուն' : 'Фамилия'}
                      data-testid="input-new-patient-lastname"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {language === 'ARM' ? 'Հեռախոս' : 'Телефон'}
                  </Label>
                  <Input
                    value={newPatientPhone}
                    onChange={(e) => setNewPatientPhone(e.target.value)}
                    placeholder="+374 XX XXX XXX"
                    data-testid="input-new-patient-phone"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-2">
            <Label>{language === 'ARM' ? 'Ծառայություն' : 'Услуга'}</Label>
            <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
              <SelectTrigger data-testid="select-service">
                <SelectValue placeholder={language === 'ARM' ? 'Ընտրեք (ոչ պարտադիր)' : 'Выберите услугу (необязательно)'} />
              </SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {language === 'ARM' ? service.nameArm : service.nameRu} ({service.defaultDurationMinutes} {language === 'ARM' ? 'րոպե' : 'мин'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
                      !appointmentDate && 'text-muted-foreground'
                    )}
                    data-testid="button-select-date"
                  >
                    {appointmentDate ? format(appointmentDate, 'PPP', { locale }) : (language === 'ARM' ? 'Ընտրեք ամսաթիվը' : 'Выберите дату')}
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
                {language === 'ARM' ? 'Ժամ' : 'Время'}
              </Label>
              <Select value={appointmentTime} onValueChange={setAppointmentTime}>
                <SelectTrigger data-testid="select-time">
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
            <Label>{language === 'ARM' ? 'Տևողություն (րոպե)' : 'Длительность (минуты)'}</Label>
            <Select value={duration.toString()} onValueChange={(v) => setDuration(Number(v))}>
              <SelectTrigger data-testid="select-duration">
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
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder={language === 'ARM' ? 'Լրացուցիչ տեղեկություն...' : 'Дополнительная информация...'}
              rows={2}
              data-testid="input-custom-reason"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              data-testid="button-cancel-booking"
            >
              {language === 'ARM' ? 'Չեղարկել' : 'Отмена'}
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={isSubmitting}
              data-testid="button-create-booking"
            >
              {isSubmitting ? (
                language === 'ARM' ? 'Ստեղծում...' : 'Создание...'
              ) : (
                language === 'ARM' ? 'Ստեղծել գրանցում' : 'Создать запись'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
