import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { User, Clock, Briefcase, Link2, Plus, Trash2, Save, Check, Bot, Eye, EyeOff } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Doctor = Database['public']['Tables']['doctor']['Row'];
type Service = Database['public']['Tables']['services']['Row'];
type DayOfWeek = Database['public']['Enums']['day_of_week'];

const DAYS_OF_WEEK: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export function SettingsView() {
  const { language, setLanguage } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [doctorForm, setDoctorForm] = useState<Partial<Doctor> & { ai_enabled?: boolean; llm_api_base_url?: string; llm_api_key?: string; llm_model_name?: string }>({});
  const [services, setServices] = useState<Partial<Service>[]>([]);
  const [newService, setNewService] = useState<Partial<Service>>({
    name_arm: '',
    name_ru: '',
    default_duration_minutes: 30,
    is_active: true,
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyChanged, setApiKeyChanged] = useState(false);

  const { data: doctor, isLoading: doctorLoading } = useQuery({
    queryKey: ['doctor'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctor')
        .select('*')
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  const { data: existingServices = [], isLoading: servicesLoading } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (doctor) {
      setDoctorForm({
        ...doctor,
        // Don't show existing API key, just indicate if set
        llm_api_key: doctor.llm_api_key ? '' : '',
      });
      setApiKeyChanged(false);
    }
  }, [doctor]);

  useEffect(() => {
    setServices(existingServices);
  }, [existingServices]);

  const updateDoctor = useMutation({
    mutationFn: async (data: Partial<Doctor> & { ai_enabled?: boolean; llm_api_base_url?: string; llm_api_key?: string; llm_model_name?: string }) => {
      const updateData: Record<string, unknown> = { ...data };
      
      // Only update API key if it was changed (not empty placeholder)
      if (!apiKeyChanged && data.llm_api_key === '') {
        delete updateData.llm_api_key;
      }
      
      if (doctor?.id) {
        const { error } = await supabase
          .from('doctor')
          .update(updateData as any)
          .eq('id', doctor.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('doctor')
          .insert([{ 
            first_name: data.first_name || 'Doctor',
            last_name: data.last_name || '',
            ...updateData 
          } as any]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor'] });
      setApiKeyChanged(false);
      toast({
        title: t(language, 'settings.saved'),
        description: t(language, 'common.success'),
      });
    },
    onError: () => {
      toast({
        title: t(language, 'common.error'),
        variant: 'destructive',
      });
    },
  });

  const updateService = useMutation({
    mutationFn: async (service: Partial<Service>) => {
      if (service.id) {
        const { error } = await supabase
          .from('services')
          .update({
            name_arm: service.name_arm,
            name_ru: service.name_ru,
            default_duration_minutes: service.default_duration_minutes,
            is_active: service.is_active,
          })
          .eq('id', service.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast({
        title: t(language, 'settings.saved'),
      });
    },
  });

  const addService = useMutation({
    mutationFn: async (service: Partial<Service>) => {
      if (!doctor?.id) {
        throw new Error('Doctor not found');
      }
      const { error } = await supabase
        .from('services')
        .insert([{
          doctor_id: doctor.id,
          name_arm: service.name_arm || '',
          name_ru: service.name_ru || '',
          default_duration_minutes: service.default_duration_minutes || 30,
          is_active: service.is_active ?? true,
          sort_order: services.length,
        }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setNewService({
        name_arm: '',
        name_ru: '',
        default_duration_minutes: 30,
        is_active: true,
      });
      toast({
        title: t(language, 'common.success'),
      });
    },
  });

  const deleteService = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast({
        title: t(language, 'common.success'),
      });
    },
  });

  const toggleDay = (day: DayOfWeek) => {
    const currentDays = doctorForm.work_days || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];
    setDoctorForm({ ...doctorForm, work_days: newDays });
  };

  if (doctorLoading || servicesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">{t(language, 'settings.title')}</h1>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">{t(language, 'settings.profile')}</span>
          </TabsTrigger>
          <TabsTrigger value="schedule" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">{t(language, 'settings.workSchedule')}</span>
          </TabsTrigger>
          <TabsTrigger value="services" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">{t(language, 'settings.services')}</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            <span className="hidden sm:inline">{t(language, 'settings.integrations')}</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">{t(language, 'settings.aiAssistant')}</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card className="medical-card">
            <CardHeader>
              <CardTitle>{t(language, 'settings.profile')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t(language, 'settings.firstName')}</Label>
                  <Input
                    value={doctorForm.first_name || ''}
                    onChange={(e) => setDoctorForm({ ...doctorForm, first_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t(language, 'settings.lastName')}</Label>
                  <Input
                    value={doctorForm.last_name || ''}
                    onChange={(e) => setDoctorForm({ ...doctorForm, last_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t(language, 'patients.language')}</Label>
                <Select
                  value={doctorForm.interface_language || 'RU'}
                  onValueChange={(value) => {
                    setDoctorForm({ ...doctorForm, interface_language: value as 'ARM' | 'RU' });
                    setLanguage(value as 'ARM' | 'RU');
                  }}
                >
                  <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARM">Հdelays (Armenian)</SelectItem>
                    <SelectItem value="RU">Русский (Russian)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={() => updateDoctor.mutate(doctorForm)}
                disabled={updateDoctor.isPending}
                className="w-full md:w-auto"
              >
                {updateDoctor.isPending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {t(language, 'settings.save')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule">
          <Card className="medical-card">
            <CardHeader>
              <CardTitle>{t(language, 'settings.workSchedule')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>{t(language, 'settings.workDays')}</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <Button
                      key={day}
                      type="button"
                      variant={doctorForm.work_days?.includes(day) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleDay(day)}
                      className="min-w-[100px]"
                    >
                      {doctorForm.work_days?.includes(day) && (
                        <Check className="h-3 w-3 mr-1" />
                      )}
                      {t(language, `days.${day}`)}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t(language, 'settings.from')}</Label>
                  <Input
                    type="time"
                    value={doctorForm.work_day_start_time || '09:00'}
                    onChange={(e) => setDoctorForm({ ...doctorForm, work_day_start_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t(language, 'settings.to')}</Label>
                  <Input
                    type="time"
                    value={doctorForm.work_day_end_time || '18:00'}
                    onChange={(e) => setDoctorForm({ ...doctorForm, work_day_end_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Slot Step (minutes)</Label>
                <Select
                  value={String(doctorForm.slot_step_minutes || 15)}
                  onValueChange={(value) => setDoctorForm({ ...doctorForm, slot_step_minutes: parseInt(value) })}
                >
                  <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 {t(language, 'appointment.minutes')}</SelectItem>
                    <SelectItem value="30">30 {t(language, 'appointment.minutes')}</SelectItem>
                    <SelectItem value="60">60 {t(language, 'appointment.minutes')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={() => updateDoctor.mutate(doctorForm)}
                disabled={updateDoctor.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {t(language, 'settings.save')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services">
          <Card className="medical-card">
            <CardHeader>
              <CardTitle>{t(language, 'settings.services')}</CardTitle>
              <CardDescription>{t(language, 'settings.addService')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Existing Services */}
              <div className="space-y-4">
                {services.map((service, index) => (
                  <div key={service.id || index} className="flex flex-col md:flex-row gap-3 p-4 rounded-lg border bg-muted/20">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Input
                        placeholder={t(language, 'settings.serviceNameArm')}
                        value={service.name_arm || ''}
                        onChange={(e) => {
                          const updated = [...services];
                          updated[index] = { ...updated[index], name_arm: e.target.value };
                          setServices(updated);
                        }}
                      />
                      <Input
                        placeholder={t(language, 'settings.serviceNameRu')}
                        value={service.name_ru || ''}
                        onChange={(e) => {
                          const updated = [...services];
                          updated[index] = { ...updated[index], name_ru: e.target.value };
                          setServices(updated);
                        }}
                      />
                      <Select
                        value={String(service.default_duration_minutes || 30)}
                        onValueChange={(value) => {
                          const updated = [...services];
                          updated[index] = { ...updated[index], default_duration_minutes: parseInt(value) };
                          setServices(updated);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30 {t(language, 'appointment.minutes')}</SelectItem>
                          <SelectItem value="60">60 {t(language, 'appointment.minutes')}</SelectItem>
                          <SelectItem value="90">90 {t(language, 'appointment.minutes')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={service.is_active ?? true}
                        onCheckedChange={(checked) => {
                          const updated = [...services];
                          updated[index] = { ...updated[index], is_active: checked };
                          setServices(updated);
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={() => updateService.mutate(service as Service)}
                        disabled={updateService.isPending}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => service.id && deleteService.mutate(service.id)}
                        disabled={deleteService.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add New Service */}
              <div className="flex flex-col md:flex-row gap-3 p-4 rounded-lg border border-dashed">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input
                    placeholder={t(language, 'settings.serviceNameArm')}
                    value={newService.name_arm || ''}
                    onChange={(e) => setNewService({ ...newService, name_arm: e.target.value })}
                  />
                  <Input
                    placeholder={t(language, 'settings.serviceNameRu')}
                    value={newService.name_ru || ''}
                    onChange={(e) => setNewService({ ...newService, name_ru: e.target.value })}
                  />
                  <Select
                    value={String(newService.default_duration_minutes || 30)}
                    onValueChange={(value) => setNewService({ ...newService, default_duration_minutes: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 {t(language, 'appointment.minutes')}</SelectItem>
                      <SelectItem value="60">60 {t(language, 'appointment.minutes')}</SelectItem>
                      <SelectItem value="90">90 {t(language, 'appointment.minutes')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => addService.mutate(newService)}
                  disabled={addService.isPending || !newService.name_arm || !newService.name_ru}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t(language, 'common.add')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations">
          <Card className="medical-card">
            <CardHeader>
              <CardTitle>{t(language, 'settings.integrations')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>{t(language, 'settings.telegramToken')}</Label>
                <Input
                  type="password"
                  placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                  value={doctorForm.telegram_bot_token || ''}
                  onChange={(e) => setDoctorForm({ ...doctorForm, telegram_bot_token: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Get your bot token from @BotFather on Telegram
                </p>
              </div>

              <div className="space-y-2">
                <Label>Telegram Chat ID</Label>
                <Input
                  placeholder="-1001234567890"
                  value={doctorForm.telegram_chat_id || ''}
                  onChange={(e) => setDoctorForm({ ...doctorForm, telegram_chat_id: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Your personal chat ID to receive notifications
                </p>
              </div>

              <div className="space-y-2">
                <Label>{t(language, 'settings.googleCalendarId')}</Label>
                <Input
                  placeholder="your-calendar@group.calendar.google.com"
                  value={doctorForm.google_calendar_id || ''}
                  onChange={(e) => setDoctorForm({ ...doctorForm, google_calendar_id: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>{t(language, 'settings.googleSheetId')}</Label>
                <Input
                  placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                  value={doctorForm.google_sheet_id || ''}
                  onChange={(e) => setDoctorForm({ ...doctorForm, google_sheet_id: e.target.value })}
                />
              </div>

              <Button 
                onClick={() => updateDoctor.mutate(doctorForm)}
                disabled={updateDoctor.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {t(language, 'settings.save')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Assistant Tab */}
        <TabsContent value="ai">
          <Card className="medical-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                {t(language, 'settings.aiAssistant')}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {t(language, 'settings.aiEnabledDescription')}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t(language, 'settings.aiEnabled')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t(language, 'settings.aiEnabledDescription')}
                  </p>
                </div>
                <Switch
                  checked={doctorForm.ai_enabled ?? false}
                  onCheckedChange={(checked) => setDoctorForm({ ...doctorForm, ai_enabled: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label>{t(language, 'settings.llmApiBaseUrl')}</Label>
                <Input
                  placeholder="https://api.deepseek.com/v1"
                  value={doctorForm.llm_api_base_url || ''}
                  onChange={(e) => setDoctorForm({ ...doctorForm, llm_api_base_url: e.target.value })}
                  disabled={!doctorForm.ai_enabled}
                />
                <p className="text-xs text-muted-foreground">
                  DeepSeek: https://api.deepseek.com/v1
                </p>
              </div>

              <div className="space-y-2">
                <Label>{t(language, 'settings.llmApiKey')}</Label>
                <div className="relative">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    placeholder={doctor?.llm_api_key ? '••••••••••••••••' : 'sk-...'}
                    value={doctorForm.llm_api_key || ''}
                    onChange={(e) => {
                      setDoctorForm({ ...doctorForm, llm_api_key: e.target.value });
                      setApiKeyChanged(true);
                    }}
                    disabled={!doctorForm.ai_enabled}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {doctor?.llm_api_key ? (
                    <span className="text-green-600">{t(language, 'settings.aiKeyConfigured')}</span>
                  ) : (
                    <span className="text-yellow-600">{t(language, 'settings.aiKeyNotConfigured')}</span>
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{t(language, 'settings.llmModelName')}</Label>
                <Input
                  placeholder="deepseek-chat"
                  value={doctorForm.llm_model_name || ''}
                  onChange={(e) => setDoctorForm({ ...doctorForm, llm_model_name: e.target.value })}
                  disabled={!doctorForm.ai_enabled}
                />
                <p className="text-xs text-muted-foreground">
                  DeepSeek: deepseek-chat, deepseek-coder
                </p>
              </div>

              <Button 
                onClick={() => updateDoctor.mutate(doctorForm)}
                disabled={updateDoctor.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {t(language, 'settings.save')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
