import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  CheckCircle2, 
  XCircle, 
  Send, 
  RefreshCw, 
  MessageSquare, 
  Calendar, 
  FileSpreadsheet,
  AlertCircle,
  Loader2
} from 'lucide-react';

type ConnectionStatus = 'connected' | 'disconnected' | 'checking' | 'unknown';

interface ConnectionState {
  telegram: ConnectionStatus;
  googleCalendar: ConnectionStatus;
  googleSheets: ConnectionStatus;
}

export function DiagnosticsView() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionState>({
    telegram: 'unknown',
    googleCalendar: 'unknown',
    googleSheets: 'unknown',
  });
  const [isChecking, setIsChecking] = useState(false);

  const { data: doctor } = useQuery({
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

  const checkConnections = async () => {
    setIsChecking(true);
    setConnectionStatus({
      telegram: 'checking',
      googleCalendar: 'checking',
      googleSheets: 'checking',
    });

    try {
      const { data, error } = await supabase.functions.invoke('check-connections', {
        body: { doctorId: doctor?.id },
      });

      if (error) throw error;

      setConnectionStatus({
        telegram: data?.telegram ? 'connected' : 'disconnected',
        googleCalendar: data?.googleCalendar ? 'connected' : 'disconnected',
        googleSheets: data?.googleSheets ? 'connected' : 'disconnected',
      });
    } catch (error) {
      console.error('Connection check failed:', error);
      setConnectionStatus({
        telegram: doctor?.telegram_bot_token ? 'unknown' : 'disconnected',
        googleCalendar: doctor?.google_calendar_id ? 'unknown' : 'disconnected',
        googleSheets: doctor?.google_sheet_id ? 'unknown' : 'disconnected',
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
      return data;
    },
    onSuccess: () => {
      toast({
        title: t(language, 'common.success'),
        description: language === 'ARM' 
          ? 'Թdelays հaxordagir ուdelays'
          : 'Тестовое сообщение отправлено',
      });
    },
    onError: () => {
      toast({
        title: t(language, 'common.error'),
        description: language === 'ARM'
          ? 'Չ haxordel haghordagirutyuny'
          : 'Не удалось отправить сообщение',
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
      default:
        return (
          <Badge variant="outline">
            {language === 'ARM' ? 'Անdelays' : 'Неизвестно'}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t(language, 'diagnostics.title')}</h1>
        <Button 
          onClick={checkConnections}
          disabled={isChecking}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
          {language === 'ARM' ? 'Ստdelays' : 'Проверить'}
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
                    {doctor?.telegram_bot_token 
                      ? `Token: ****${doctor.telegram_bot_token.slice(-6)}`
                      : language === 'ARM' ? 'Token-ը delays' : 'Token не настроен'
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
                      ? `ID: ${doctor.google_calendar_id.substring(0, 20)}...`
                      : language === 'ARM' ? 'ID-ը delays' : 'ID не настроен'
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
                      ? `ID: ${doctor.google_sheet_id.substring(0, 20)}...`
                      : language === 'ARM' ? 'ID-ը delays' : 'ID не настроен'
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
              ? ' Delays Telegram haxordagirutyuny'
              : 'Отправить тестовое сообщение в Telegram'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => sendTestMessage.mutate()}
            disabled={sendTestMessage.isPending || !doctor?.telegram_bot_token || !doctor?.telegram_chat_id}
          >
            {sendTestMessage.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {t(language, 'diagnostics.sendTest')}
          </Button>
          {(!doctor?.telegram_bot_token || !doctor?.telegram_chat_id) && (
            <p className="text-sm text-muted-foreground mt-2">
              {language === 'ARM' 
                ? 'Khndrum enq kardelayelel Telegram Token-y ew Chat ID-n'
                : 'Сначала настройте Telegram Token и Chat ID в настройках'
              }
            </p>
          )}
        </CardContent>
      </Card>

      {/* System Info */}
      <Card className="medical-card">
        <CardHeader>
          <CardTitle>{language === 'ARM' ? 'Համակdelays' : 'Системная информация'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">{language === 'ARM' ? ' Delays' : 'Версия'}</p>
              <p className="font-medium">1.0.0 MVP</p>
            </div>
            <div>
              <p className="text-muted-foreground">{language === 'ARM' ? 'Ժ delays' : 'Часовой пояс'}</p>
              <p className="font-medium">Asia/Yerevan</p>
            </div>
            <div>
              <p className="text-muted-foreground">{language === 'ARM' ? 'Лязки' : 'Языки'}</p>
              <p className="font-medium">ARM, RU</p>
            </div>
            <div>
              <p className="text-muted-foreground">{language === 'ARM' ? 'Bndelays' : 'Слот-шаг'}</p>
              <p className="font-medium">{doctor?.slot_step_minutes || 15} {t(language, 'appointment.minutes')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
