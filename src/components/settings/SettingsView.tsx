import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { User, Clock, Briefcase, Link2, Plus, Trash2, Save, Check, Bot, Eye, EyeOff, TestTube } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';

type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

interface Doctor {
  id: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  interfaceLanguage: 'ARM' | 'RU' | null;
  workDays: string[] | null;
  workDayStartTime: string | null;
  workDayEndTime: string | null;
  slotStepMinutes: number | null;
  telegramBotToken: string | null;
  telegramChatId: string | null;
  googleCalendarId: string | null;
  googleSheetId: string | null;
  aiEnabled: boolean | null;
  llmApiBaseUrl: string | null;
  llmApiKey: string | null;
  llmModelName: string | null;
  hasTelegramToken?: boolean;
  hasLlmKey?: boolean;
}

interface Service {
  id: string;
  doctorId: string;
  nameArm: string;
  nameRu: string;
  defaultDurationMinutes: number;
  isActive: boolean | null;
  sortOrder: number | null;
}

const DAYS_OF_WEEK: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export function SettingsView() {
  const { language, setLanguage } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [doctorForm, setDoctorForm] = useState<Partial<Doctor>>({});
  const [services, setServices] = useState<Partial<Service>[]>([]);
  const [newService, setNewService] = useState<Partial<Service>>({
    nameArm: '',
    nameRu: '',
    defaultDurationMinutes: 30,
    isActive: true,
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyChanged, setApiKeyChanged] = useState(false);
  const [tokenChanged, setTokenChanged] = useState(false);
  const [baseUrlChanged, setBaseUrlChanged] = useState(false);

  const { data: doctor, isLoading: doctorLoading } = useQuery<Doctor | null>({
    queryKey: ['/api/doctor'],
    enabled: !!user?.id,
  });

  const { data: existingServices = [], isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ['/api/services'],
    enabled: !!doctor?.id,
  });

  const { data: integrationStatus } = useQuery<{
    telegram: { configured: boolean; hasBotToken: boolean; hasChatId: boolean };
    googleCalendar: { configured: boolean; hasCalendarId: boolean; hasServiceAccount: boolean };
    googleSheets: { configured: boolean; hasSheetId: boolean; hasServiceAccount: boolean };
  }>({
    queryKey: ['/api/integrations/status'],
    enabled: !!doctor?.id,
  });

  useEffect(() => {
    if (doctor) {
      setDoctorForm({
        id: doctor.id,
        firstName: doctor.firstName,
        lastName: doctor.lastName,
        interfaceLanguage: doctor.interfaceLanguage,
        workDays: doctor.workDays,
        workDayStartTime: doctor.workDayStartTime,
        workDayEndTime: doctor.workDayEndTime,
        slotStepMinutes: doctor.slotStepMinutes,
        googleCalendarId: doctor.googleCalendarId,
        googleSheetId: doctor.googleSheetId,
        telegramChatId: doctor.telegramChatId,
        aiEnabled: doctor.aiEnabled,
        llmModelName: doctor.llmModelName,
        telegramBotToken: '',
        llmApiKey: '',
        llmApiBaseUrl: '',
      });
      setApiKeyChanged(false);
      setTokenChanged(false);
      setBaseUrlChanged(false);
    }
  }, [doctor]);

  useEffect(() => {
    setServices(existingServices);
  }, [existingServices]);

  const updateDoctor = useMutation({
    mutationFn: async (data: Partial<Doctor>) => {
      if (!doctor?.id) throw new Error('Doctor not found');
      
      const updateData: Record<string, unknown> = { ...data };
      
      if (!tokenChanged) delete updateData.telegramBotToken;
      if (!apiKeyChanged) delete updateData.llmApiKey;
      if (!baseUrlChanged) delete updateData.llmApiBaseUrl;
      
      delete updateData.hasTelegramToken;
      delete updateData.hasLlmKey;

      return apiRequest('PATCH', `/api/doctor/${doctor.id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/doctor'] });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/status'] });
      setApiKeyChanged(false);
      setTokenChanged(false);
      setBaseUrlChanged(false);
      toast({
        title: t(language, 'settings.saved'),
        description: t(language, 'common.success'),
      });
    },
    onError: (error) => {
      console.error('Error updating doctor:', error);
      toast({
        title: t(language, 'common.error'),
        variant: 'destructive',
      });
    },
  });

  const updateService = useMutation({
    mutationFn: async (service: Partial<Service>) => {
      if (!service.id) throw new Error('Service ID required');
      return apiRequest('PATCH', `/api/services/${service.id}`, {
        nameArm: service.nameArm,
        nameRu: service.nameRu,
        defaultDurationMinutes: service.defaultDurationMinutes,
        isActive: service.isActive,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/services'] });
      toast({ title: t(language, 'settings.saved') });
    },
  });

  const addService = useMutation({
    mutationFn: async (service: Partial<Service>) => {
      return apiRequest('POST', '/api/services', {
        nameArm: service.nameArm || '',
        nameRu: service.nameRu || '',
        defaultDurationMinutes: service.defaultDurationMinutes || 30,
        isActive: service.isActive ?? true,
        sortOrder: services.length,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/services'] });
      setNewService({
        nameArm: '',
        nameRu: '',
        defaultDurationMinutes: 30,
        isActive: true,
      });
      toast({ title: t(language, 'common.success') });
    },
  });

  const deleteService = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/services/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/services'] });
      toast({ title: t(language, 'common.success') });
    },
  });

  const testTelegram = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/integrations/test-telegram');
    },
    onSuccess: () => {
      toast({ title: 'Telegram test successful!', description: 'Check your Telegram chat for a test message.' });
    },
    onError: (error) => {
      console.error('Telegram test failed:', error);
      toast({ title: 'Telegram test failed', variant: 'destructive' });
    },
  });

  const setupWebhook = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/integrations/setup-telegram-webhook');
    },
    onSuccess: () => {
      toast({ title: 'Webhook configured!', description: 'Telegram bot is now active.' });
    },
    onError: (error) => {
      console.error('Webhook setup failed:', error);
      toast({ title: 'Webhook setup failed', variant: 'destructive' });
    },
  });

  const toggleDay = (day: DayOfWeek) => {
    const currentDays = (doctorForm.workDays || []) as string[];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];
    setDoctorForm({ ...doctorForm, workDays: newDays });
  };

  if (doctorLoading || servicesLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-spinner">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">{t(language, 'settings.title')}</h1>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile" className="flex items-center gap-2" data-testid="tab-profile">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">{t(language, 'settings.profile')}</span>
          </TabsTrigger>
          <TabsTrigger value="schedule" className="flex items-center gap-2" data-testid="tab-schedule">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">{t(language, 'settings.workSchedule')}</span>
          </TabsTrigger>
          <TabsTrigger value="services" className="flex items-center gap-2" data-testid="tab-services">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">{t(language, 'settings.services')}</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2" data-testid="tab-integrations">
            <Link2 className="h-4 w-4" />
            <span className="hidden sm:inline">{t(language, 'settings.integrations')}</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2" data-testid="tab-ai">
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">{t(language, 'settings.aiAssistant')}</span>
          </TabsTrigger>
        </TabsList>

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
                    data-testid="input-first-name"
                    value={doctorForm.firstName || ''}
                    onChange={(e) => setDoctorForm({ ...doctorForm, firstName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t(language, 'settings.lastName')}</Label>
                  <Input
                    data-testid="input-last-name"
                    value={doctorForm.lastName || ''}
                    onChange={(e) => setDoctorForm({ ...doctorForm, lastName: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t(language, 'patients.language')}</Label>
                <Select
                  value={doctorForm.interfaceLanguage || 'RU'}
                  onValueChange={(value) => {
                    setDoctorForm({ ...doctorForm, interfaceLanguage: value as 'ARM' | 'RU' });
                    setLanguage(value as 'ARM' | 'RU');
                  }}
                >
                  <SelectTrigger className="w-full md:w-[200px]" data-testid="select-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARM">{'\u0540\u0561\u0575\u0565\u0580\u0565\u0576'}</SelectItem>
                    <SelectItem value="RU">Русский</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={() => updateDoctor.mutate(doctorForm)}
                disabled={updateDoctor.isPending}
                className="w-full md:w-auto"
                data-testid="button-save-profile"
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
                      variant={(doctorForm.workDays as string[] || []).includes(day) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleDay(day)}
                      className="min-w-[100px]"
                      data-testid={`button-day-${day.toLowerCase()}`}
                    >
                      {(doctorForm.workDays as string[] || []).includes(day) && (
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
                    data-testid="input-work-start"
                    value={doctorForm.workDayStartTime || '09:00'}
                    onChange={(e) => setDoctorForm({ ...doctorForm, workDayStartTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t(language, 'settings.to')}</Label>
                  <Input
                    type="time"
                    data-testid="input-work-end"
                    value={doctorForm.workDayEndTime || '18:00'}
                    onChange={(e) => setDoctorForm({ ...doctorForm, workDayEndTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Slot Step (minutes)</Label>
                <Select
                  value={String(doctorForm.slotStepMinutes || 15)}
                  onValueChange={(value) => setDoctorForm({ ...doctorForm, slotStepMinutes: parseInt(value) })}
                >
                  <SelectTrigger className="w-full md:w-[200px]" data-testid="select-slot-step">
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
                data-testid="button-save-schedule"
              >
                <Save className="h-4 w-4 mr-2" />
                {t(language, 'settings.save')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services">
          <Card className="medical-card">
            <CardHeader>
              <CardTitle>{t(language, 'settings.services')}</CardTitle>
              <CardDescription>{t(language, 'settings.addService')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {services.map((service, index) => (
                  <div key={service.id || index} className="flex flex-col md:flex-row gap-3 p-4 rounded-lg border bg-muted/20" data-testid={`service-row-${index}`}>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Input
                        placeholder={t(language, 'settings.serviceNameArm')}
                        value={service.nameArm || ''}
                        onChange={(e) => {
                          const updated = [...services];
                          updated[index] = { ...updated[index], nameArm: e.target.value };
                          setServices(updated);
                        }}
                      />
                      <Input
                        placeholder={t(language, 'settings.serviceNameRu')}
                        value={service.nameRu || ''}
                        onChange={(e) => {
                          const updated = [...services];
                          updated[index] = { ...updated[index], nameRu: e.target.value };
                          setServices(updated);
                        }}
                      />
                      <Select
                        value={String(service.defaultDurationMinutes || 30)}
                        onValueChange={(value) => {
                          const updated = [...services];
                          updated[index] = { ...updated[index], defaultDurationMinutes: parseInt(value) };
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
                        checked={service.isActive ?? true}
                        onCheckedChange={(checked) => {
                          const updated = [...services];
                          updated[index] = { ...updated[index], isActive: checked };
                          setServices(updated);
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={() => updateService.mutate(service as Service)}
                        disabled={updateService.isPending}
                        data-testid={`button-save-service-${index}`}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => service.id && deleteService.mutate(service.id)}
                        disabled={deleteService.isPending}
                        data-testid={`button-delete-service-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col md:flex-row gap-3 p-4 rounded-lg border border-dashed">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input
                    placeholder={t(language, 'settings.serviceNameArm')}
                    value={newService.nameArm || ''}
                    onChange={(e) => setNewService({ ...newService, nameArm: e.target.value })}
                    data-testid="input-new-service-arm"
                  />
                  <Input
                    placeholder={t(language, 'settings.serviceNameRu')}
                    value={newService.nameRu || ''}
                    onChange={(e) => setNewService({ ...newService, nameRu: e.target.value })}
                    data-testid="input-new-service-ru"
                  />
                  <Select
                    value={String(newService.defaultDurationMinutes || 30)}
                    onValueChange={(value) => setNewService({ ...newService, defaultDurationMinutes: parseInt(value) })}
                  >
                    <SelectTrigger data-testid="select-new-service-duration">
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
                  disabled={addService.isPending || !newService.nameArm || !newService.nameRu}
                  data-testid="button-add-service"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t(language, 'common.add')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <Card className="medical-card">
            <CardHeader>
              <CardTitle>{t(language, 'settings.integrations')}</CardTitle>
              <CardDescription>Connect Telegram, Google Calendar, and Google Sheets</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>{t(language, 'settings.telegramToken')}</Label>
                <Input
                  type="password"
                  data-testid="input-telegram-token"
                  placeholder={doctor?.hasTelegramToken ? '••••••••••••••••' : '123456789:ABCdefGHIjklMNOpqrsTUVwxyz'}
                  value={doctorForm.telegramBotToken || ''}
                  onChange={(e) => {
                    setDoctorForm({ ...doctorForm, telegramBotToken: e.target.value });
                    setTokenChanged(true);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {doctor?.hasTelegramToken ? (
                    <span className="text-green-600">Token configured - enter new value to update</span>
                  ) : (
                    'Get your bot token from @BotFather on Telegram'
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Telegram Chat ID</Label>
                <Input
                  data-testid="input-telegram-chat-id"
                  placeholder="-1001234567890"
                  value={doctorForm.telegramChatId || ''}
                  onChange={(e) => setDoctorForm({ ...doctorForm, telegramChatId: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Your personal chat ID to receive notifications
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testTelegram.mutate()}
                  disabled={testTelegram.isPending || !integrationStatus?.telegram.configured}
                  data-testid="button-test-telegram"
                >
                  <TestTube className="h-4 w-4 mr-2" />
                  Test Connection
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setupWebhook.mutate()}
                  disabled={setupWebhook.isPending || !integrationStatus?.telegram.hasBotToken}
                  data-testid="button-setup-webhook"
                >
                  Setup Bot Webhook
                </Button>
              </div>

              <div className="space-y-2">
                <Label>{t(language, 'settings.googleCalendarId')}</Label>
                <Input
                  data-testid="input-google-calendar-id"
                  placeholder="your-calendar@group.calendar.google.com"
                  value={doctorForm.googleCalendarId || ''}
                  onChange={(e) => setDoctorForm({ ...doctorForm, googleCalendarId: e.target.value })}
                />
                {integrationStatus?.googleCalendar.hasServiceAccount ? (
                  <p className="text-xs text-green-600">Google Service Account configured</p>
                ) : (
                  <p className="text-xs text-yellow-600">Google Service Account not configured (contact admin)</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t(language, 'settings.googleSheetId')}</Label>
                <Input
                  data-testid="input-google-sheet-id"
                  placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                  value={doctorForm.googleSheetId || ''}
                  onChange={(e) => setDoctorForm({ ...doctorForm, googleSheetId: e.target.value })}
                />
              </div>

              <Button 
                onClick={() => updateDoctor.mutate(doctorForm)}
                disabled={updateDoctor.isPending}
                data-testid="button-save-integrations"
              >
                <Save className="h-4 w-4 mr-2" />
                {t(language, 'settings.save')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

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
                  checked={doctorForm.aiEnabled ?? false}
                  onCheckedChange={(checked) => setDoctorForm({ ...doctorForm, aiEnabled: checked })}
                  data-testid="switch-ai-enabled"
                />
              </div>

              <div className="space-y-2">
                <Label>{t(language, 'settings.llmApiBaseUrl')}</Label>
                <Input
                  data-testid="input-llm-base-url"
                  placeholder="https://api.deepseek.com/v1"
                  value={doctorForm.llmApiBaseUrl || ''}
                  onChange={(e) => {
                    setDoctorForm({ ...doctorForm, llmApiBaseUrl: e.target.value });
                    setBaseUrlChanged(true);
                  }}
                  disabled={!doctorForm.aiEnabled}
                />
              </div>

              <div className="space-y-2">
                <Label>{t(language, 'settings.llmApiKey')}</Label>
                <div className="relative">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    data-testid="input-llm-api-key"
                    placeholder={doctor?.hasLlmKey ? '••••••••••••••••' : 'sk-...'}
                    value={doctorForm.llmApiKey || ''}
                    onChange={(e) => {
                      setDoctorForm({ ...doctorForm, llmApiKey: e.target.value });
                      setApiKeyChanged(true);
                    }}
                    disabled={!doctorForm.aiEnabled}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowApiKey(!showApiKey)}
                    data-testid="button-toggle-api-key"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {doctor?.hasLlmKey ? (
                    <span className="text-green-600">{t(language, 'settings.aiKeyConfigured')} - enter new value to update</span>
                  ) : (
                    <span className="text-yellow-600">{t(language, 'settings.aiKeyNotConfigured')}</span>
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{t(language, 'settings.llmModelName')}</Label>
                <Input
                  data-testid="input-llm-model"
                  placeholder="deepseek-chat"
                  value={doctorForm.llmModelName || ''}
                  onChange={(e) => setDoctorForm({ ...doctorForm, llmModelName: e.target.value })}
                  disabled={!doctorForm.aiEnabled}
                />
                <p className="text-xs text-muted-foreground">
                  DeepSeek: deepseek-chat, deepseek-coder
                </p>
              </div>

              <Button 
                onClick={() => updateDoctor.mutate(doctorForm)}
                disabled={updateDoctor.isPending}
                data-testid="button-save-ai"
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
