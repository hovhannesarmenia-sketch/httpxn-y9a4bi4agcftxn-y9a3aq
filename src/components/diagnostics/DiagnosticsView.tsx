import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
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

interface IntegrationStatus {
  telegram: {
    configured: boolean;
    hasBotToken: boolean;
    hasChatId: boolean;
  };
  googleCalendar: {
    configured: boolean;
    hasCalendarId: boolean;
    hasServiceAccount: boolean;
  };
  googleSheets: {
    configured: boolean;
    hasSheetId: boolean;
    hasServiceAccount: boolean;
  };
}

interface Doctor {
  id: number;
  firstName: string;
  lastName: string;
  telegramChatId: string | null;
  googleCalendarId: string | null;
  googleSheetId: string | null;
  slotStepMinutes: number;
  aiEnabled: boolean;
}

export function DiagnosticsView() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const { data: doctor, isLoading: doctorLoading } = useQuery<Doctor>({
    queryKey: ['/api/doctor'],
  });

  const { data: integrationStatus, isLoading: statusLoading, refetch: refetchStatus } = useQuery<IntegrationStatus>({
    queryKey: ['/api/integrations/status'],
  });

  const getConnectionStatus = (type: 'telegram' | 'googleCalendar' | 'googleSheets'): ConnectionStatus => {
    if (!integrationStatus) return 'not_configured';
    
    const status = integrationStatus[type];
    if (!status.configured) return 'not_configured';
    return 'connected';
  };

  const checkConnections = async () => {
    await refetchStatus();
    setLastChecked(new Date());
    toast({
      title: language === 'ARM' ? 'Stugumner avartvel en' : 'Проверка завершена',
      description: language === 'ARM' 
        ? 'Integratsianeri karvavijakner tharmatsvel en' 
        : 'Статусы интеграций обновлены',
    });
  };

  const sendTestMessage = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/integrations/test-telegram');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t(language, 'common.success'),
        description: language === 'ARM' 
          ? 'Test haxordagiry uxxarkvats e'
          : 'Тестовое сообщение отправлено',
      });
    },
    onError: (error: Error) => {
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
        return <CheckCircle2 className="h-5 w-5 text-green-500" data-testid="icon-status-connected" />;
      case 'disconnected':
        return <XCircle className="h-5 w-5 text-red-500" data-testid="icon-status-disconnected" />;
      case 'checking':
        return <Loader2 className="h-5 w-5 text-primary animate-spin" data-testid="icon-status-checking" />;
      case 'not_configured':
        return <Settings2 className="h-5 w-5 text-muted-foreground" data-testid="icon-status-not-configured" />;
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-500" data-testid="icon-status-unknown" />;
    }
  };

  const getStatusBadge = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected':
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20" data-testid="badge-connected">
            {t(language, 'diagnostics.connected')}
          </Badge>
        );
      case 'disconnected':
        return (
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20" data-testid="badge-disconnected">
            {t(language, 'diagnostics.disconnected')}
          </Badge>
        );
      case 'checking':
        return (
          <Badge variant="outline" className="animate-pulse" data-testid="badge-checking">
            {t(language, 'common.loading')}
          </Badge>
        );
      case 'not_configured':
        return (
          <Badge variant="outline" className="text-muted-foreground" data-testid="badge-not-configured">
            {language === 'ARM' ? 'Chkarxavorvats' : 'Не настроено'}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" data-testid="badge-unknown">
            {language === 'ARM' ? 'Anhayt' : 'Неизвестно'}
          </Badge>
        );
    }
  };

  if (doctorLoading || statusLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-diagnostics">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const telegramStatus = getConnectionStatus('telegram');
  const calendarStatus = getConnectionStatus('googleCalendar');
  const sheetsStatus = getConnectionStatus('googleSheets');

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-diagnostics-title">{t(language, 'diagnostics.title')}</h1>
          {lastChecked && (
            <p className="text-sm text-muted-foreground" data-testid="text-last-checked">
              {language === 'ARM' ? 'Vergin stugum:' : 'Последняя проверка:'}{' '}
              {lastChecked.toLocaleTimeString()}
            </p>
          )}
        </div>
        <Button 
          onClick={checkConnections}
          disabled={!doctor}
          variant="outline"
          data-testid="button-refresh-status"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          {language === 'ARM' ? 'Stugel' : 'Проверить'}
        </Button>
      </div>

      <div className="grid gap-4">
        {/* Telegram Status */}
        <Card data-testid="card-telegram-status">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-[#0088cc]/10">
                  <MessageSquare className="h-6 w-6 text-[#0088cc]" />
                </div>
                <div>
                  <h3 className="font-semibold">{t(language, 'diagnostics.telegram')}</h3>
                  <p className="text-sm text-muted-foreground" data-testid="text-telegram-info">
                    {integrationStatus?.telegram.hasBotToken 
                      ? `Token: ••••••`
                      : language === 'ARM' ? 'Token chkarxavorvats' : 'Token не настроен'
                    }
                    {doctor?.telegramChatId 
                      ? ` | Chat ID: ${doctor.telegramChatId}`
                      : ''
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStatusIcon(telegramStatus)}
                {getStatusBadge(telegramStatus)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Google Calendar Status */}
        <Card data-testid="card-calendar-status">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-[#4285f4]/10">
                  <Calendar className="h-6 w-6 text-[#4285f4]" />
                </div>
                <div>
                  <h3 className="font-semibold">{t(language, 'diagnostics.googleCalendar')}</h3>
                  <p className="text-sm text-muted-foreground" data-testid="text-calendar-info">
                    {doctor?.googleCalendarId 
                      ? `ID: ${doctor.googleCalendarId.length > 30 
                          ? doctor.googleCalendarId.substring(0, 30) + '...' 
                          : doctor.googleCalendarId}`
                      : language === 'ARM' ? 'Calendar ID chkarxavorvats' : 'Calendar ID не настроен'
                    }
                    {!integrationStatus?.googleCalendar.hasServiceAccount && (
                      <span className="text-yellow-500 ml-2">
                        ({language === 'ARM' ? 'Service Account pahanjvum e' : 'Требуется Service Account'})
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStatusIcon(calendarStatus)}
                {getStatusBadge(calendarStatus)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Google Sheets Status */}
        <Card data-testid="card-sheets-status">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-[#0f9d58]/10">
                  <FileSpreadsheet className="h-6 w-6 text-[#0f9d58]" />
                </div>
                <div>
                  <h3 className="font-semibold">{t(language, 'diagnostics.googleSheets')}</h3>
                  <p className="text-sm text-muted-foreground" data-testid="text-sheets-info">
                    {doctor?.googleSheetId 
                      ? `ID: ${doctor.googleSheetId.length > 30 
                          ? doctor.googleSheetId.substring(0, 30) + '...' 
                          : doctor.googleSheetId}`
                      : language === 'ARM' ? 'Sheet ID chkarxavorvats' : 'Sheet ID не настроен'
                    }
                    {!integrationStatus?.googleSheets.hasServiceAccount && (
                      <span className="text-yellow-500 ml-2">
                        ({language === 'ARM' ? 'Service Account pahanjvum e' : 'Требуется Service Account'})
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStatusIcon(sheetsStatus)}
                {getStatusBadge(sheetsStatus)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Test Actions */}
      <Card data-testid="card-test-actions">
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
            disabled={sendTestMessage.isPending || !integrationStatus?.telegram.configured}
            data-testid="button-send-test"
          >
            {sendTestMessage.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {t(language, 'diagnostics.sendTest')}
          </Button>
          {!integrationStatus?.telegram.configured && (
            <p className="text-sm text-muted-foreground mt-2" data-testid="text-telegram-hint">
              {language === 'ARM' 
                ? 'Nakh karxavoriq Telegram Token-y ev Chat ID-n Settings → Integrations baxnum'
                : 'Сначала настройте Telegram Token и Chat ID в разделе Настройки → Интеграции'
              }
            </p>
          )}
        </CardContent>
      </Card>

      {/* System Info */}
      <Card data-testid="card-system-info">
        <CardHeader>
          <CardTitle>{language === 'ARM' ? 'Hamakargayin teghekutyun' : 'Системная информация'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">{language === 'ARM' ? 'Tarberaky' : 'Версия'}</p>
              <p className="font-medium" data-testid="text-version">1.0.0 MVP</p>
            </div>
            <div>
              <p className="text-muted-foreground">{language === 'ARM' ? 'Zhamagotvadrky' : 'Часовой пояс'}</p>
              <p className="font-medium" data-testid="text-timezone">Asia/Yerevan</p>
            </div>
            <div>
              <p className="text-muted-foreground">{language === 'ARM' ? 'Lezuner' : 'Языки'}</p>
              <p className="font-medium" data-testid="text-languages">ARM, RU</p>
            </div>
            <div>
              <p className="text-muted-foreground">{language === 'ARM' ? 'Slot qayl' : 'Слот-шаг'}</p>
              <p className="font-medium" data-testid="text-slot-step">{doctor?.slotStepMinutes || 15} {t(language, 'appointment.minutes')}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{language === 'ARM' ? 'Bzhishk' : 'Врач'}</p>
              <p className="font-medium" data-testid="text-doctor-name">{doctor?.firstName} {doctor?.lastName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{language === 'ARM' ? 'AI ognutyun' : 'AI ассистент'}</p>
              <p className="font-medium" data-testid="text-ai-status">{doctor?.aiEnabled ? 'Активен' : 'Отключён'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
