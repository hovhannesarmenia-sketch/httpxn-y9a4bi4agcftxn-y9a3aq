const TELEGRAM_API = 'https://api.telegram.org/bot';

export interface TelegramMessage {
  chat_id: number | string;
  text: string;
  parse_mode?: 'HTML' | 'Markdown';
  reply_markup?: object;
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: number | string,
  text: string,
  replyMarkup?: object
): Promise<any> {
  const cleanToken = botToken.replace(/^bot/i, '');
  const url = `${TELEGRAM_API}${cleanToken}/sendMessage`;
  
  const body: TelegramMessage = { 
    chat_id: chatId, 
    text, 
    parse_mode: 'HTML' 
  };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  console.log('[Telegram] Sending message to', chatId);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json() as { ok: boolean; description?: string; result?: unknown };
  
  if (!data.ok) {
    console.error('[Telegram] Error:', data);
    throw new Error(data.description || 'Telegram API error');
  }

  return data;
}

export async function answerCallbackQuery(
  botToken: string,
  callbackQueryId: string,
  text?: string
): Promise<void> {
  const cleanToken = botToken.replace(/^bot/i, '');
  
  await fetch(`${TELEGRAM_API}${cleanToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

export async function setWebhook(botToken: string, webhookUrl: string): Promise<void> {
  const cleanToken = botToken.replace(/^bot/i, '');
  
  const response = await fetch(`${TELEGRAM_API}${cleanToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl }),
  });

  const data = await response.json() as { ok: boolean; description?: string };
  
  if (!data.ok) {
    console.error('[Telegram] Set webhook error:', data);
    throw new Error(data.description || 'Failed to set webhook');
  }

  console.log('[Telegram] Webhook set to:', webhookUrl);
}

export async function deleteWebhook(botToken: string): Promise<void> {
  const cleanToken = botToken.replace(/^bot/i, '');
  
  await fetch(`${TELEGRAM_API}${cleanToken}/deleteWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

export function formatDateForTelegram(dateStr: string, lang: 'ARM' | 'RU'): string {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return dateStr;
  
  const [, yearStr, monthStr, dayStr, hourStr, minuteStr] = match;
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const day = parseInt(dayStr);
  
  const date = new Date(year, month - 1, day);
  const timeStr = `${hourStr}:${minuteStr}`;
  
  const armDayNames = ['\u053F\u056B\u0580', '\u0535\u0580\u056F', '\u0535\u0580\u0584', '\u0549\u0580\u0584', '\u0540\u0576\u0563', '\u0548\u0582\u0580', '\u0547\u0562\u0569'];
  const armMonthNames = ['\u0570\u0578\u0582\u0576\u057E\u0561\u0580', '\u0583\u0565\u057F\u0580\u057E\u0561\u0580', '\u0574\u0561\u0580\u057F', '\u0561\u057A\u0580\u056B\u056C', '\u0574\u0561\u0575\u056B\u057D', '\u0570\u0578\u0582\u0576\u056B\u057D', '\u0570\u0578\u0582\u056C\u056B\u057D', '\u0585\u0563\u0578\u057D\u057F\u0578\u057D', '\u057D\u0565\u057A\u057F\u0565\u0574\u0562\u0565\u0580', '\u0570\u0578\u056F\u057F\u0565\u0574\u0562\u0565\u0580', '\u0576\u0578\u0575\u0565\u0574\u0562\u0565\u0580', '\u0564\u0565\u056F\u057F\u0565\u0574\u0562\u0565\u0580'];
  
  if (lang === 'ARM') {
    const dayName = armDayNames[date.getDay()];
    const monthName = armMonthNames[month - 1];
    return `${dayName}, ${monthName} ${day} ${timeStr}`;
  }
  
  const ruDayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const ruMonthNames = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${ruDayNames[date.getDay()]}, ${day} ${ruMonthNames[month - 1]} ${timeStr}`;
}
