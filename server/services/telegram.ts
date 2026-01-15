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

const RU_MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const ARM_MONTH_NAMES = [
  '\u0540\u0578\u0582\u0576\u057E\u0561\u0580', '\u0553\u0565\u057F\u0580\u057E\u0561\u0580', '\u0544\u0561\u0580\u057F', '\u0531\u057A\u0580\u056B\u056C', '\u0544\u0561\u0575\u056B\u057D', '\u0540\u0578\u0582\u0576\u056B\u057D',
  '\u0540\u0578\u0582\u056C\u056B\u057D', '\u0555\u0563\u0578\u057D\u057F\u0578\u057D', '\u054D\u0565\u057A\u057F\u0565\u0574\u0562\u0565\u0580', '\u0540\u0578\u056F\u057F\u0565\u0574\u0562\u0565\u0580', '\u0546\u0578\u0575\u0565\u0574\u0562\u0565\u0580', '\u0534\u0565\u056F\u057F\u0565\u0574\u0562\u0565\u0580'
];

const RU_DAY_HEADERS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const ARM_DAY_HEADERS = ['\u0535\u0580', '\u0535\u0584', '\u0549\u0584', '\u0540\u0563', '\u0548\u0582', '\u0547\u0562', '\u053F\u056B'];

interface DayAvailability {
  date: string;
  available: boolean;
}

export interface CalendarKeyboardOptions {
  year: number;
  month: number;
  lang: 'ARM' | 'RU';
  availabilityMap?: Map<string, boolean>;
}

export function generateCalendarKeyboard(options: CalendarKeyboardOptions): object {
  const { year, month, lang, availabilityMap } = options;
  const keyboard: Array<Array<{ text: string; callback_data: string }>> = [];
  
  const monthNames = lang === 'ARM' ? ARM_MONTH_NAMES : RU_MONTH_NAMES;
  const monthName = monthNames[month];
  keyboard.push([{ text: `📅 ${monthName} ${year}`, callback_data: 'calendar_header' }]);
  
  const dayHeaders = lang === 'ARM' ? ARM_DAY_HEADERS : RU_DAY_HEADERS;
  keyboard.push(dayHeaders.map(d => ({ text: d, callback_data: 'day_header' })));
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  
  let startDayOfWeek = firstDay.getDay();
  startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let currentRow: Array<{ text: string; callback_data: string }> = [];
  
  for (let i = 0; i < startDayOfWeek; i++) {
    currentRow.push({ text: ' ', callback_data: 'empty' });
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const currentDate = new Date(year, month, day);
    
    const isPast = currentDate < today;
    
    const dayOfWeek = currentDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    let isAvailable = !isPast && !isWeekend;
    if (availabilityMap && availabilityMap.has(dateStr)) {
      isAvailable = availabilityMap.get(dateStr)!;
    }
    
    let buttonText: string;
    let callbackData: string;
    
    if (isPast) {
      buttonText = ' ';
      callbackData = 'past_date';
    } else if (!isAvailable) {
      buttonText = `❌ ${day}`;
      callbackData = 'unavailable';
    } else {
      buttonText = String(day);
      callbackData = `select_date_${dateStr}`;
    }
    
    currentRow.push({ text: buttonText, callback_data: callbackData });
    
    if (currentRow.length === 7) {
      keyboard.push(currentRow);
      currentRow = [];
    }
  }
  
  if (currentRow.length > 0) {
    while (currentRow.length < 7) {
      currentRow.push({ text: ' ', callback_data: 'empty' });
    }
    keyboard.push(currentRow);
  }
  
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  
  const prevText = lang === 'ARM' ? '\u25C0\uFE0F \u0546\u0561\u056D' : '\u25C0\uFE0F Назад';
  const nextText = lang === 'ARM' ? '\u0540\u0561\u057B \u25B6\uFE0F' : 'Вперёд \u25B6\uFE0F';
  
  keyboard.push([
    { text: prevText, callback_data: `calendar_nav_${prevYear}_${prevMonth}` },
    { text: nextText, callback_data: `calendar_nav_${nextYear}_${nextMonth}` }
  ]);
  
  return { inline_keyboard: keyboard };
}

export interface TimeSlot {
  time: string;
  available: boolean;
}

export function generateTimeSlotKeyboard(
  slots: TimeSlot[],
  selectedDate: string,
  lang: 'ARM' | 'RU'
): object {
  const keyboard: Array<Array<{ text: string; callback_data: string }>> = [];
  
  const headerText = lang === 'ARM' 
    ? `\u0538\u0576\u057f\u0580\u0565\u0584 \u056a\u0561\u0574\u0568:` 
    : 'Выберите время:';
  keyboard.push([{ text: headerText, callback_data: 'time_header' }]);
  
  let row: Array<{ text: string; callback_data: string }> = [];
  for (const slot of slots) {
    if (slot.available) {
      row.push({ text: slot.time, callback_data: `select_time_${selectedDate}_${slot.time}` });
      if (row.length === 4) {
        keyboard.push(row);
        row = [];
      }
    }
  }
  if (row.length > 0) {
    keyboard.push(row);
  }
  
  const backText = lang === 'ARM' ? '\u25C0\uFE0F \u0540\u0565\u057f' : '\u25C0\uFE0F Назад';
  keyboard.push([{ text: backText, callback_data: 'back_to_calendar' }]);
  
  return { inline_keyboard: keyboard };
}

export interface ServiceOption {
  id: string;
  name: string;
  duration: number;
}

export function generateServiceKeyboard(
  services: ServiceOption[],
  lang: 'ARM' | 'RU'
): object {
  const keyboard: Array<Array<{ text: string; callback_data: string }>> = [];
  
  const headerText = lang === 'ARM' 
    ? `\u0538\u0576\u057f\u0580\u0565\u0584 \u056e\u0561\u057c\u0561\u0575\u0578\u0582\u0569\u0575\u0578\u0582\u0576\u0568:` 
    : 'Выберите услугу:';
  keyboard.push([{ text: headerText, callback_data: 'service_header' }]);
  
  for (const service of services) {
    const durationText = lang === 'ARM' ? `${service.duration} \u0580\u0578\u057a\u0565` : `${service.duration} мин`;
    keyboard.push([{ 
      text: `${service.name} (${durationText})`, 
      callback_data: `select_service_${service.id}` 
    }]);
  }
  
  const backText = lang === 'ARM' ? '\u25C0\uFE0F \u0540\u0565\u057f' : '\u25C0\uFE0F Назад';
  keyboard.push([{ text: backText, callback_data: 'back_to_time' }]);
  
  return { inline_keyboard: keyboard };
}

export function generateAvailableTimeSlots(
  workDayStartTime: string,
  workDayEndTime: string,
  slotStepMinutes: number,
  bookedTimes: string[]
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  
  const [startHour, startMin] = workDayStartTime.split(':').map(Number);
  const [endHour, endMin] = workDayEndTime.split(':').map(Number);
  
  let currentMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  while (currentMinutes < endMinutes) {
    const hours = Math.floor(currentMinutes / 60);
    const mins = currentMinutes % 60;
    const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    
    const isBooked = bookedTimes.includes(timeStr);
    slots.push({ time: timeStr, available: !isBooked });
    
    currentMinutes += slotStepMinutes;
  }
  
  return slots;
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
