import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { 
  CheckCircle2, 
  XCircle, 
  Send, 
  RefreshCw, 
  MessageSquare, 
  Calendar, 
  FileSpreadsheet,
  AlertCircle,
  Loader2,
  Settings2
} from 'lucide-react';

type ConnectionStatus = 'connected' | 'disconnected' | 'checking' | 'not_configured';

// Type for the doctor_safe view that excludes sensitive credentials
type DoctorSafe = Database['public']['Views']['doctor_safe']['Row'];

interface ConnectionState {
  telegram: ConnectionStatus;
  googleCalendar: ConnectionStatus;
  googleSheets: ConnectionStatus;
  lastChecked: Date | null;
}

export function DiagnosticsView() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionState>({
    telegram: 'not_configured',
    googleCalendar: 'not_configured',
    googleSheets: 'not_configured',
    lastChecked: null,
  });
  const [isChecking, setIsChecking] = useState(false);

  const { data: doctor, isLoading: doctorLoading } = useQuery<DoctorSafe | null>({
    queryKey: ['doctor_safe', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      // Use doctor_safe view to avoid exposing sensitive credentials to browser
      // Cast to avoid Supabase client type issues with views
      const { data, error } = await supabase
        .from('doctor_safe')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as DoctorSafe | null;
    },
    enabled: !!user?.id,
  });

  // Derive initial status from doctor settings (using safe boolean flags)
  useEffect(() => {
    if (doctor) {
      setConnectionStatus(prev => ({
        ...prev,
        telegram: doctor.has_telegram_token && doctor.telegram_chat_id 
          ? (prev.lastChecked ? prev.telegram : 'not_configured')
          : 'not_configured',
        googleCalendar: doctor.google_calendar_id 
          ? (prev.lastChecked ? prev.googleCalendar : 'not_configured')
          : 'not_configured',
        googleSheets: doctor.google_sheet_id 
          ? (prev.lastChecked ? prev.googleSheets : 'not_configured')
          : 'not_configured',
      }));
    }
  }, [doctor]);

  // Auto-check connections on mount if settings are configured
  useEffect(() => {
    if (doctor && !connectionStatus.lastChecked) {
      const hasAnyConfig = doctor.has_telegram_token || doctor.google_calendar_id || doctor.google_sheet_id;
      if (hasAnyConfig) {
        checkConnections();
      }
    }
  }, [doctor]);

  const checkConnections = async () => {
    if (!doctor?.id) return;
    
    setIsChecking(true);
    setConnectionStatus(prev => ({
      ...prev,
      telegram: doctor.has_telegram_token ? 'checking' : 'not_configured',
      googleCalendar: doctor.google_calendar_id ? 'checking' : 'not_configured',
      googleSheets: doctor.google_sheet_id ? 'checking' : 'not_configured',
    }));

    try {
      const { data, error } = await supabase.functions.invoke('check-connections', {
        body: { doctorId: doctor.id },
      });

      if (error) throw error;

      setConnectionStatus({
        telegram: !doctor.has_telegram_token ? 'not_configured' 
          : data?.telegram ? 'connected' : 'disconnected',
        googleCalendar: !doctor.google_calendar_id ? 'not_configured'
          : data?.googleCalendar ? 'connected' : 'disconnected',
        googleSheets: !doctor.google_sheet_id ? 'not_configured'
          : data?.googleSheets ? 'connected' : 'disconnected',
        lastChecked: new Date(),
      });

      toast({
        title: language === 'ARM' ? 'Stugumner avartvel en' : 'Проверка завершена',
        description: language === 'ARM' 
          ? 'Integratsianeri karvavijakner tharmatsvel en' 
          : 'Статусы интеграций обновлены',
      });
    } catch (error) {
      console.error('Connection check failed:', error);
      setConnectionStatus(prev => ({
        telegram: doctor.has_telegram_token ? 'disconnected' : 'not_configured',
        googleCalendar: doctor.google_calendar_id ? 'disconnected' : 'not_configured',
        googleSheets: doctor.google_sheet_id ? 'disconnected' : 'not_configured',
        lastChecked: new Date(),
      }));

      toast({
        title: language === 'ARM' ? 'Stugman skhal' : 'Ошибка проверки',
        description: language === 'ARM' 
          ? 'Chi hajogvats stugel kpnumnerun' 
          : 'Не удалось проверить подключения',
        variant: 'destructive',
      });
    } finally {
      setIsChecking(false);
    }
  };

  const sendTestMessage = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('send-test-message', {
        body: { doctorId: doctor?.id },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      setConnectionStatus(prev => ({
        ...prev,
        telegram: 'connected',
        lastChecked: new Date(),
      }));
      toast({
        title: t(language, 'common.success'),
        description: language === 'ARM' 
          ? 'Test haxordagiry uxxarkvats e'
          : 'Тестовое сообщение отправлено',
      });
    },
    onError: (error: Error) => {
      setConnectionStatus(prev => ({
        ...prev,
        telegram: 'disconnected',
        lastChecked: new Date(),
      }));
      toast({
        title: t(language, 'common.error'),
        description: error.message || (language === 'ARM'
          ? 'Chi hajoxvats uxarkel haxordagirutyuny'
          : 'Не удалось отправить сообщение'),
        variant: 'destructive',
      });
    },
  });

  const getStatusIcon = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected':
        return <CheckCircle2 className="h-5 w-5 text-medical-success" />;
      case 'disconnected':
        return <XCircle className="h-5 w-5 text-medical-error" />;
      case 'checking':
        return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
      case 'not_configured':
        return <Settings2 className="h-5 w-5 text-muted-foreground" />;
      default:
        return <AlertCircle className="h-5 w-5 text-medical-warning" />;
    }
  };

  const getStatusBadge = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected':
        return (
          <Badge className="bg-medical-success/10 text-medical-success border-medical-success/20">
            {t(language, 'diagnostics.connected')}
          </Badge>
        );
      case 'disconnected':
        return (
          <Badge className="bg-medical-error/10 text-medical-error border-medical-error/20">
            {t(language, 'diagnostics.disconnected')}
          </Badge>
        );
      case 'checking':
        return (
          <Badge variant="outline" className="animate-pulse">
            {t(language, 'common.loading')}
          </Badge>
        );
      case 'not_configured':
        return (
          <Badge variant="outline" className="text-muted-foreground">
            {language === 'ARM' ? 'Chkarxavorvats' : 'Не настроено'}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            {language === 'ARM' ? 'Anhayt' : 'Неизвестно'}
          </Badge>
        );
    }
  };

  if (doctorLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t(language, 'diagnostics.title')}</h1>
          {connectionStatus.lastChecked && (
            <p className="text-sm text-muted-foreground">
              {language === 'ARM' ? 'Vergin stugum:' : 'Последняя проверка:'}{' '}
              {connectionStatus.lastChecked.toLocaleTimeString()}
            </p>
          )}
        </div>
        <Button 
          onClick={checkConnections}
          disabled={isChecking || !doctor}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
          {language === 'ARM' ? 'Stugel' : 'Проверить'}
        </Button>
      </div>

      <div className="grid gap-4">
        {/* Telegram Status */}
        <Card className="medical-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-[#0088cc]/10">
                  <MessageSquare className="h-6 w-6 text-[#0088cc]" />
                </div>
                <div>
                  <h3 className="font-semibold">{t(language, 'diagnostics.telegram')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {doctor?.has_telegram_token 
                      ? `Token: ••••••`
                      : language === 'ARM' ? 'Token chkarxavorvats' : 'Token не настроен'
                    }
                    {doctor?.telegram_chat_id 
                      ? ` | Chat ID: ${doctor.telegram_chat_id}`
                      : ''
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStatusIcon(connectionStatus.telegram)}
                {getStatusBadge(connectionStatus.telegram)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Google Calendar Status */}
        <Card className="medical-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-[#4285f4]/10">
                  <Calendar className="h-6 w-6 text-[#4285f4]" />
                </div>
                <div>
                  <h3 className="font-semibold">{t(language, 'diagnostics.googleCalendar')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {doctor?.google_calendar_id 
                      ? `ID: ${doctor.google_calendar_id.length > 30 
                          ? doctor.google_calendar_id.substring(0, 30) + '...' 
                          : doctor.google_calendar_id}`
                      : language === 'ARM' ? 'Calendar ID chkarxavorvats' : 'Calendar ID не настроен'
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStatusIcon(connectionStatus.googleCalendar)}
                {getStatusBadge(connectionStatus.googleCalendar)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Google Sheets Status */}
        <Card className="medical-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-[#0f9d58]/10">
                  <FileSpreadsheet className="h-6 w-6 text-[#0f9d58]" />
                </div>
                <div>
                  <h3 className="font-semibold">{t(language, 'diagnostics.googleSheets')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {doctor?.google_sheet_id 
                      ? `ID: ${doctor.google_sheet_id.length > 30 
                          ? doctor.google_sheet_id.substring(0, 30) + '...' 
                          : doctor.google_sheet_id}`
                      : language === 'ARM' ? 'Sheet ID chkarxavorvats' : 'Sheet ID не настроен'
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStatusIcon(connectionStatus.googleSheets)}
                {getStatusBadge(connectionStatus.googleSheets)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Test Actions */}
      <Card className="medical-card">
        <CardHeader>
          <CardTitle>{t(language, 'diagnostics.testMessage')}</CardTitle>
          <CardDescription>
            {language === 'ARM' 
              ? 'Uxarkel test haxordagir Telegram-um'
              : 'Отправить тестовое сообщение в Telegram'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => sendTestMessage.mutate()}
            disabled={sendTestMessage.isPending || !doctor?.has_telegram_token || !doctor?.telegram_chat_id}
          >
            {sendTestMessage.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {t(language, 'diagnostics.sendTest')}
          </Button>
          {(!doctor?.has_telegram_token || !doctor?.telegram_chat_id) && (
            <p className="text-sm text-muted-foreground mt-2">
              {language === 'ARM' 
                ? 'Nakh karxavoriq Telegram Token-y ev Chat ID-n Settings → Integrations baxnum'
                : 'Сначала настройте Telegram Token и Chat ID в разделе Настройки → Интеграции'
              }
            </p>
          )}
        </CardContent>
      </Card>

      {/* System Info */}
      <Card className="medical-card">
        <CardHeader>
          <CardTitle>{language === 'ARM' ? 'Hamakargayin teghekutyun' : 'Системная информация'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">{language === 'ARM' ? 'Tarberaky' : 'Версия'}</p>
              <p className="font-medium">1.0.0 MVP</p>
            </div>
            <div>
              <p className="text-muted-foreground">{language === 'ARM' ? 'Zhamagotvadrky' : 'Часовой пояс'}</p>
              <p className="font-medium">Asia/Yerevan</p>
            </div>
            <div>
              <p className="text-muted-foreground">{language === 'ARM' ? 'Lezuner' : 'Языки'}</p>
              <p className="font-medium">ARM, RU</p>
            </div>
            <div>
              <p className="text-muted-foreground">{language === 'ARM' ? 'Slot qayl' : 'Слот-шаг'}</p>
              <p className="font-medium">{doctor?.slot_step_minutes || 15} {t(language, 'appointment.minutes')}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{language === 'ARM' ? 'Bzhishk' : 'Врач'}</p>
              <p className="font-medium">{doctor?.first_name} {doctor?.last_name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{language === 'ARM' ? 'AI ognutyun' : 'AI ассистент'}</p>
              <p className="font-medium">{doctor?.ai_enabled ? '✅ Активен' : '❌ Отключён'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
