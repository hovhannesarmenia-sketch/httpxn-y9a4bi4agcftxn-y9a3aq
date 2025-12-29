import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { botTranslations, type Language } from "../_shared/translations.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_API = "https://api.telegram.org/bot";

// Steps in the booking flow
type BookingStep = 
  | 'awaiting_language'
  | 'awaiting_name'
  | 'awaiting_phone'
  | 'awaiting_service'
  | 'awaiting_date'
  | 'awaiting_time'
  | 'awaiting_confirmation'
  | 'idle';

interface TelegramSession {
  telegram_user_id: number;
  step: BookingStep;
  language: Language | null;
  patient_id: string | null;
  service_id: string | null;
  selected_date: string | null;
  selected_time: string | null;
  duration_minutes: number | null;
  custom_reason: string | null;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; first_name: string; last_name?: string };
    chat: { id: number };
    text?: string;
    contact?: { phone_number: string; first_name: string; last_name?: string };
  };
  callback_query?: {
    id: string;
    from: { id: number; first_name: string; last_name?: string };
    message: { chat: { id: number }; message_id: number };
    data: string;
  };
}

// Use shared translations
const translations = botTranslations;

// ============ HELPERS ============

async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string,
  replyMarkup?: object
) {
  const cleanToken = botToken.replace(/^bot/i, '');
  const url = `${TELEGRAM_API}${cleanToken}/sendMessage`;
  const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: "HTML" };
  if (replyMarkup) body.reply_markup = replyMarkup;

  console.log("[TG] Sending:", { chatId, text: text.substring(0, 60) });
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  console.log("[TG] Response:", data);
  return data;
}

async function answerCallbackQuery(botToken: string, callbackQueryId: string, text?: string) {
  const cleanToken = botToken.replace(/^bot/i, '');
  await fetch(`${TELEGRAM_API}${cleanToken}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

// ============ DATE & TIME HELPERS ============

// Yerevan timezone helper - get current date in Asia/Yerevan
function getYerevanDate(): Date {
  const now = new Date();
  const yerevantTimeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Yerevan' });
  return new Date(yerevantTimeStr);
}

// Format date to YYYY-MM-DD
function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Armenian day names (Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6)
const armDayNames = ['Կdelays', 'Եdelays', 'Եdelays', 'Չdelays', 'Հdelays', ' Delays', 'Շdelays'];
// Armenian month names (0-based: Jan=0, Feb=1, ...)
const armMonthNames = ['delays', 'փdelays', 'delays', ' delays', 'delays', 'delays', 'delays', 'Опdelays', 'սdelays', 'Пdelays', 'delays', 'delays'];

// Russian day names (Sun=0, Mon=1, etc.)
const ruDayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
// Russian month names (0-based)
const ruMonthNames = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function formatDateForDisplay(dateStr: string, lang: 'ARM' | 'RU'): string {
  const date = new Date(dateStr + 'T12:00:00'); // Use noon to avoid timezone issues
  const dayOfWeek = date.getDay();
  const dayOfMonth = date.getDate();
  const month = date.getMonth();
  
  if (lang === 'ARM') {
    return `${armDayNames[dayOfWeek]}, ${armMonthNames[month]} ${dayOfMonth}`;
  }
  
  // Russian formatting
  return `${ruDayNames[dayOfWeek]}, ${dayOfMonth} ${ruMonthNames[month]}`;
}

// Check if a specific date has at least one available time slot
async function dateHasAvailableSlots(
  supabase: any,
  doctor: any,
  dateStr: string,
  durationMinutes: number
): Promise<boolean> {
  const startHour = parseInt(doctor.work_day_start_time?.split(':')[0] || '9');
  const startMin = parseInt(doctor.work_day_start_time?.split(':')[1] || '0');
  const endHour = parseInt(doctor.work_day_end_time?.split(':')[0] || '18');
  const endMin = parseInt(doctor.work_day_end_time?.split(':')[1] || '0');
  const slotStep = doctor.slot_step_minutes || 30;

  // Get existing appointments for this date
  const dateStart = `${dateStr}T00:00:00`;
  const dateEnd = `${dateStr}T23:59:59`;
  const { data: existingApts } = await supabase
    .from('appointments')
    .select('start_date_time, duration_minutes')
    .eq('doctor_id', doctor.id)
    .in('status', ['CONFIRMED', 'PENDING'])
    .gte('start_date_time', dateStart)
    .lte('start_date_time', dateEnd);

  const bookedSlots = (existingApts || []).map((a: any) => {
    const start = new Date(a.start_date_time);
    const end = new Date(start.getTime() + a.duration_minutes * 60000);
    return { start, end };
  });

  // Check each potential slot
  let current = new Date(`${dateStr}T${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00`);
  const endTime = new Date(`${dateStr}T${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00`);

  // For today, skip past slots
  const yerevantNow = getYerevanDate();
  const todayStr = formatDateISO(yerevantNow);
  if (dateStr === todayStr) {
    const currentHour = yerevantNow.getHours();
    const currentMin = yerevantNow.getMinutes();
    const nowTime = new Date(`${dateStr}T${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}:00`);
    if (current < nowTime) {
      current = nowTime;
      const mins = current.getMinutes();
      const roundedMins = Math.ceil(mins / slotStep) * slotStep;
      current.setMinutes(roundedMins, 0, 0);
    }
  }

  while (current < endTime) {
    const slotEnd = new Date(current.getTime() + durationMinutes * 60000);
    if (slotEnd > endTime) break;

    const isBooked = bookedSlots.some((b: any) => 
      (current >= b.start && current < b.end) || (slotEnd > b.start && slotEnd <= b.end) ||
      (current <= b.start && slotEnd >= b.end)
    );

    if (!isBooked) {
      return true;
    }

    current = new Date(current.getTime() + slotStep * 60000);
  }

  return false;
}

// Get available dates for a specific page (7 days per page)
async function getAvailableDatesForPage(
  supabase: any,
  doctor: any,
  pageIndex: number,
  durationMinutes: number,
  blockedDatesSet: Set<string>
): Promise<{ dates: string[]; hasMorePages: boolean; hasPrevPages: boolean }> {
  const dayNameToNumber: Record<string, number> = {
    SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6,
  };
  const validDays = new Set(doctor.work_days?.map((d: string) => dayNameToNumber[d]) || [1, 2, 3, 4, 5]);
  
  const yerevantToday = getYerevanDate();
  yerevantToday.setHours(0, 0, 0, 0);
  
  // Calculate the date range for this page
  const startOffset = pageIndex * 7;
  const startDate = new Date(yerevantToday);
  startDate.setDate(startDate.getDate() + startOffset);
  
  const dates: string[] = [];
  const maxLookAhead = 60;
  
  console.log(`[Dates] Page ${pageIndex}: checking days from ${formatDateISO(startDate)}`);
  
  // Iterate through 7 calendar days for this page
  for (let i = 0; i <= 6; i++) {
    const checkDate = new Date(startDate);
    checkDate.setDate(checkDate.getDate() + i);
    
    const dayOffset = Math.floor((checkDate.getTime() - yerevantToday.getTime()) / (1000 * 60 * 60 * 24));
    if (dayOffset > maxLookAhead) break;
    if (dayOffset < 0) continue;
    
    const dateStr = formatDateISO(checkDate);
    
    if (blockedDatesSet.has(dateStr)) {
      console.log(`[Dates] ${dateStr} is blocked`);
      continue;
    }
    if (!validDays.has(checkDate.getDay())) {
      console.log(`[Dates] ${dateStr} is not a work day (day=${checkDate.getDay()})`);
      continue;
    }
    
    const hasSlots = await dateHasAvailableSlots(supabase, doctor, dateStr, durationMinutes);
    if (hasSlots) {
      dates.push(dateStr);
      console.log(`[Dates] ${dateStr} has available slots`);
    } else {
      console.log(`[Dates] ${dateStr} has no available slots`);
    }
  }
  
  // Check if there are more pages
  let hasMorePages = false;
  const nextPageStart = new Date(startDate);
  nextPageStart.setDate(nextPageStart.getDate() + 7);
  
  for (let i = 0; i < 14; i++) {
    const checkDate = new Date(nextPageStart);
    checkDate.setDate(checkDate.getDate() + i);
    
    const dayOffset = Math.floor((checkDate.getTime() - yerevantToday.getTime()) / (1000 * 60 * 60 * 24));
    if (dayOffset > maxLookAhead) break;
    
    const dateStr = formatDateISO(checkDate);
    
    if (blockedDatesSet.has(dateStr)) continue;
    if (!validDays.has(checkDate.getDay())) continue;
    
    const hasSlots = await dateHasAvailableSlots(supabase, doctor, dateStr, durationMinutes);
    if (hasSlots) {
      hasMorePages = true;
      break;
    }
  }
  
  const hasPrevPages = pageIndex > 0;
  
  console.log(`[Dates] Page ${pageIndex}: found ${dates.length} dates, hasMore=${hasMorePages}, hasPrev=${hasPrevPages}`);
  
  return { dates, hasMorePages, hasPrevPages };
}

// ============ BOOKING LIMIT CHECK ============
const MAX_ACTIVE_BOOKINGS = 3;

async function getActiveBookingsCount(supabase: any, patientId: string, doctorId: string): Promise<number> {
  // Get current time in Asia/Yerevan timezone
  const yerevantNow = getYerevanDate();
  
  const { count, error } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('patient_id', patientId)
    .eq('doctor_id', doctorId)
    .in('status', ['PENDING', 'CONFIRMED'])
    .gt('start_date_time', yerevantNow.toISOString());
  
  if (error) {
    console.error('[BookingLimit] Error checking active bookings:', error);
    return 0;
  }
  
  console.log(`[BookingLimit] Patient ${patientId} has ${count} active bookings`);
  return count || 0;
}

// ============ SESSION PERSISTENCE ============

async function getSession(supabase: any, telegramUserId: number): Promise<TelegramSession> {
  const { data } = await supabase
    .from('telegram_sessions')
    .select('*')
    .eq('telegram_user_id', telegramUserId)
    .maybeSingle();

  if (data) {
    console.log(`[Session] Found persisted session for ${telegramUserId}, step=${data.step}`);
    return data as TelegramSession;
  }

  // Check if patient already exists (returning patient)
  const { data: patient } = await supabase
    .from('patients')
    .select('id, language, first_name, last_name, phone_number')
    .eq('telegram_user_id', telegramUserId)
    .maybeSingle();

  if (patient) {
    console.log(`[Session] Returning patient ${telegramUserId}, creating session at awaiting_service`);
    const session: TelegramSession = {
      telegram_user_id: telegramUserId,
      step: 'awaiting_service',
      language: patient.language || 'RU',
      patient_id: patient.id,
      service_id: null,
      selected_date: null,
      selected_time: null,
      duration_minutes: null,
      custom_reason: null,
    };
    await supabase.from('telegram_sessions').upsert(session);
    return session;
  }

  // New user
  console.log(`[Session] New user ${telegramUserId}, creating session at awaiting_language`);
  const session: TelegramSession = {
    telegram_user_id: telegramUserId,
    step: 'awaiting_language',
    language: null,
    patient_id: null,
    service_id: null,
    selected_date: null,
    selected_time: null,
    duration_minutes: null,
    custom_reason: null,
  };
  await supabase.from('telegram_sessions').upsert(session);
  return session;
}

async function updateSession(supabase: any, session: TelegramSession) {
  console.log(`[Session] Updating session for ${session.telegram_user_id} -> step=${session.step}`);
  await supabase.from('telegram_sessions').upsert(session);
}

async function resetSession(supabase: any, telegramUserId: number) {
  console.log(`[Session] Resetting session for ${telegramUserId}`);
  await supabase.from('telegram_sessions').delete().eq('telegram_user_id', telegramUserId);
}

// ============ MAIN HANDLER ============

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const update: TelegramUpdate = await req.json();
    console.log("[Webhook] Received update:", JSON.stringify(update));

    // Get doctor info
    const { data: doctor } = await supabase.from("doctor").select("*").limit(1).maybeSingle();
    if (!doctor?.telegram_bot_token) {
      console.log("[Webhook] No doctor or bot token configured");
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const botToken = doctor.telegram_bot_token;

    // ============ CALLBACK QUERY (button clicks) ============
    if (update.callback_query) {
      const cb = update.callback_query;
      const userId = cb.from.id;
      const chatId = cb.message.chat.id;
      const data = cb.data;

      console.log(`[Callback] User ${userId}, data=${data}`);
      await answerCallbackQuery(botToken, cb.id);

      // Doctor actions (confirm/reject)
      if (data.startsWith('apt_confirm_') || data.startsWith('apt_reject_')) {
        const isConfirm = data.startsWith('apt_confirm_');
        const appointmentId = data.replace('apt_confirm_', '').replace('apt_reject_', '');
        
        const newStatus = isConfirm ? 'CONFIRMED' : 'REJECTED';
        await supabase.from('appointments').update({ status: newStatus }).eq('id', appointmentId);

        // Notify patient
        const { data: apt } = await supabase
          .from('appointments')
          .select('*, patients(*), services(name_arm, name_ru)')
          .eq('id', appointmentId)
          .single();

        if (apt?.patients?.telegram_user_id) {
          const patientLang = apt.patients.language || 'RU';
          const t = translations[patientLang as 'ARM' | 'RU'];
          const startDT = new Date(apt.start_date_time);
          const dateTimeStr = startDT.toLocaleString(patientLang === 'ARM' ? 'hy-AM' : 'ru-RU', {
            weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
          });
          const doctorName = `${doctor.first_name} ${doctor.last_name}`;
          const msg = isConfirm
            ? t.appointmentConfirmed.replace('{doctorName}', doctorName).replace('{dateTime}', dateTimeStr)
            : t.appointmentRejected.replace('{reason}', apt.rejection_reason || '-');
          await sendTelegramMessage(botToken, apt.patients.telegram_user_id, msg);
        }

        const confirmMsg = isConfirm ? "✅ Appointment confirmed" : "❌ Appointment rejected";
        await sendTelegramMessage(botToken, chatId, confirmMsg);

        // Sync to Google Calendar if confirmed
        if (isConfirm && doctor.google_calendar_id) {
          try {
            await supabase.functions.invoke('sync-google-calendar', { body: { appointmentId, action: 'create' } });
          } catch (e) { console.error("[Webhook] Calendar sync failed:", e); }
        }

        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Patient flow callbacks
      const session = await getSession(supabase, userId);
      const lang = session.language || 'RU';
      const t = translations[lang];

      // Language selection
      if (data.startsWith('lang_')) {
        session.language = data === 'lang_arm' ? 'ARM' : 'RU';
        session.step = 'awaiting_name';
        await updateSession(supabase, session);
        console.log(`[Flow] ${userId}: language=${session.language} -> awaiting_name`);
        await sendTelegramMessage(botToken, chatId, translations[session.language].enterName);
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Skip phone
      if (data === 'skip_phone') {
        session.step = 'awaiting_service';
        await updateSession(supabase, session);
        console.log(`[Flow] ${userId}: skipped phone -> awaiting_service`);
        await showServicesMenu(supabase, botToken, chatId, session, doctor);
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Service selection
      if (data.startsWith('service_')) {
        const serviceId = data.replace('service_', '');
        if (serviceId === 'other') {
          session.service_id = null;
          session.custom_reason = null;
          session.step = 'awaiting_service'; // Will ask for custom reason text next
          await updateSession(supabase, session);
          await sendTelegramMessage(botToken, chatId, t.enterCustomReason);
        } else {
          const { data: svc } = await supabase.from('services').select('*').eq('id', serviceId).single();
          if (svc) {
            session.service_id = svc.id;
            session.duration_minutes = svc.default_duration_minutes;
            session.step = 'awaiting_date';
            await updateSession(supabase, session);
            console.log(`[Flow] ${userId}: service=${svc.id} -> awaiting_date`);
            await showDatesMenu(supabase, botToken, chatId, session, doctor, 0);
          }
        }
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Date pagination (prev/next)
      if (data.startsWith('page_')) {
        const pageIndex = parseInt(data.replace('page_', ''), 10);
        console.log(`[Flow] ${userId}: navigating to date page ${pageIndex}`);
        await showDatesMenu(supabase, botToken, chatId, session, doctor, pageIndex);
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Date selection
      if (data.startsWith('date_')) {
        session.selected_date = data.replace('date_', '');
        session.step = 'awaiting_time';
        await updateSession(supabase, session);
        console.log(`[Flow] ${userId}: date=${session.selected_date} -> awaiting_time`);
        await showTimeSlotsMenu(supabase, botToken, chatId, session, doctor);
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Time selection
      if (data.startsWith('time_')) {
        session.selected_time = data.replace('time_', '');
        session.step = 'awaiting_confirmation';
        await updateSession(supabase, session);
        console.log(`[Flow] ${userId}: time=${session.selected_time} -> awaiting_confirmation`);
        await showConfirmation(supabase, botToken, chatId, session, doctor);
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Confirm booking
      if (data === 'confirm_yes') {
        await createAppointment(supabase, botToken, chatId, session, doctor);
        session.step = 'idle';
        await updateSession(supabase, session);
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Cancel booking
      if (data === 'confirm_no') {
        session.step = 'awaiting_service';
        session.service_id = null;
        session.selected_date = null;
        session.selected_time = null;
        session.custom_reason = null;
        await updateSession(supabase, session);
        await showServicesMenu(supabase, botToken, chatId, session, doctor);
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ============ TEXT MESSAGE ============
    if (update.message) {
      const msg = update.message;
      const userId = msg.from.id;
      const chatId = msg.chat.id;
      const text = msg.text?.trim() || '';

      console.log(`[Message] User ${userId}, text="${text.substring(0, 30)}"`);

      // Handle /start command - reset session
      if (text === '/start') {
        await resetSession(supabase, userId);
        console.log(`[Flow] ${userId}: /start -> showing language selection`);
        const keyboard = {
          inline_keyboard: [
            [{ text: "🇦🇲 Հdelays", callback_data: "lang_arm" }, { text: "🇷🇺 Русский", callback_data: "lang_ru" }]
          ]
        };
        await sendTelegramMessage(botToken, chatId, `${translations.RU.welcome}\n${translations.ARM.welcome}`, keyboard);
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Get current session
      const session = await getSession(supabase, userId);
      const lang = session.language || 'RU';
      const t = translations[lang];

      console.log(`[Flow] ${userId}: current step=${session.step}, processing text message`);

      // Handle based on current step
      switch (session.step) {
        case 'awaiting_language':
          // User sent text instead of clicking button - prompt to use buttons
          console.log(`[Flow] ${userId}: awaiting_language, prompting to use buttons`);
          await sendTelegramMessage(botToken, chatId, `${translations.RU.useButtonsPrompt}\n${translations.ARM.useButtonsPrompt}`);
          const keyboard = {
            inline_keyboard: [
              [{ text: "🇦🇲 ՀАЙDELAYSdelays", callback_data: "lang_arm" }, { text: "🇷🇺 Русский", callback_data: "lang_ru" }]
            ]
          };
          await sendTelegramMessage(botToken, chatId, `${translations.RU.welcome}\n${translations.ARM.welcome}`, keyboard);
          break;

        case 'awaiting_name':
          // Store name, create patient
          const nameParts = text.split(' ');
          const firstName = nameParts[0] || text;
          const lastName = nameParts.slice(1).join(' ') || null;
          
          const { data: patient, error: patientError } = await supabase.from('patients').insert({
            telegram_user_id: userId,
            first_name: firstName,
            last_name: lastName,
            language: session.language,
          }).select('id').single();

          if (patientError) {
            console.error('[Flow] Failed to create patient:', patientError);
            await sendTelegramMessage(botToken, chatId, 'Error creating patient. Please try /start again.');
            break;
          }

          session.patient_id = patient.id;
          session.step = 'awaiting_phone';
          await updateSession(supabase, session);
          console.log(`[Flow] ${userId}: created patient ${patient.id} -> awaiting_phone`);

          // Ask for phone with skip option
          const phoneKeyboard = {
            keyboard: [[{ text: t.sharePhoneButton, request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          };
          const skipKeyboard = {
            inline_keyboard: [[{ text: t.skipPhone, callback_data: 'skip_phone' }]]
          };
          await sendTelegramMessage(botToken, chatId, t.sharePhone, phoneKeyboard);
          await sendTelegramMessage(botToken, chatId, t.skipPhone, skipKeyboard);
          break;

        case 'awaiting_phone':
          // Handle phone as text (they might type it instead of sharing)
          if (msg.contact) {
            await supabase.from('patients').update({ phone_number: msg.contact.phone_number }).eq('id', session.patient_id);
          } else if (text) {
            await supabase.from('patients').update({ phone_number: text }).eq('id', session.patient_id);
          }
          session.step = 'awaiting_service';
          await updateSession(supabase, session);
          console.log(`[Flow] ${userId}: phone saved -> awaiting_service`);
          await showServicesMenu(supabase, botToken, chatId, session, doctor);
          break;

        case 'awaiting_service':
          // If we're here via text, it's a custom reason
          if (text && !session.service_id) {
            session.custom_reason = text;
            session.duration_minutes = 30; // Default duration for custom services
            session.step = 'awaiting_date';
            await updateSession(supabase, session);
            console.log(`[Flow] ${userId}: custom reason="${text}" -> awaiting_date`);
            await showDatesMenu(supabase, botToken, chatId, session, doctor, 0);
          } else {
            // Prompt to use buttons
            await sendTelegramMessage(botToken, chatId, t.useButtonsPrompt);
            await showServicesMenu(supabase, botToken, chatId, session, doctor);
          }
          break;

        case 'awaiting_date':
        case 'awaiting_time':
        case 'awaiting_confirmation':
          // Prompt to use buttons
          await sendTelegramMessage(botToken, chatId, t.useButtonsPrompt);
          break;

        case 'idle':
          // Patient already completed booking, show services menu for new booking
          session.service_id = null;
          session.selected_date = null;
          session.selected_time = null;
          session.custom_reason = null;
          await updateSession(supabase, session);
          await showServicesMenu(supabase, botToken, chatId, session, doctor);
          break;

        default:
          console.log(`[Flow] ${userId}: unknown step=${session.step}, resetting`);
          await resetSession(supabase, userId);
          break;
      }

      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[Webhook] Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ============ FLOW HELPERS ============

async function showServicesMenu(supabase: any, botToken: string, chatId: number, session: TelegramSession, doctor: any) {
  const lang = session.language || 'RU';
  const t = translations[lang];

  // Check booking limit before showing services
  if (session.patient_id) {
    const activeCount = await getActiveBookingsCount(supabase, session.patient_id, doctor.id);
    if (activeCount >= MAX_ACTIVE_BOOKINGS) {
      console.log(`[BookingLimit] Patient ${session.patient_id} has reached max bookings (${activeCount})`);
      await sendTelegramMessage(botToken, chatId, t.maxBookingsReached);
      return;
    }
  }

  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('doctor_id', doctor.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  const buttons = (services || []).map((s: any) => [{
    text: lang === 'ARM' ? s.name_arm : s.name_ru,
    callback_data: `service_${s.id}`,
  }]);
  buttons.push([{ text: t.otherService, callback_data: 'service_other' }]);

  await sendTelegramMessage(botToken, chatId, t.chooseService, { inline_keyboard: buttons });
}

async function showDatesMenu(supabase: any, botToken: string, chatId: number, session: TelegramSession, doctor: any, pageIndex: number = 0) {
  const lang = session.language || 'RU';
  const t = translations[lang];
  const duration = session.duration_minutes || 30;

  // Fetch blocked days for this doctor
  const { data: blockedDays } = await supabase
    .from('blocked_days')
    .select('blocked_date')
    .eq('doctor_id', doctor.id);
  
  const blockedDatesSet = new Set<string>(
    (blockedDays || []).map((bd: any) => bd.blocked_date)
  );
  
  console.log(`[Dates] Blocked dates for doctor ${doctor.id}:`, Array.from(blockedDatesSet));
  
  // Get paginated dates
  const { dates, hasMorePages, hasPrevPages } = await getAvailableDatesForPage(
    supabase,
    doctor,
    pageIndex,
    duration,
    blockedDatesSet
  );

  if (dates.length === 0 && pageIndex === 0) {
    await sendTelegramMessage(botToken, chatId, t.noDatesAvailable);
    return;
  }

  // Build date buttons - 2 per row for better readability
  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < dates.length; i += 2) {
    const row = dates.slice(i, i + 2).map(d => ({
      text: formatDateForDisplay(d, lang),
      callback_data: `date_${d}`,
    }));
    rows.push(row);
  }

  // Add navigation row
  const navRow: { text: string; callback_data: string }[] = [];
  if (hasPrevPages) {
    navRow.push({
      text: lang === 'ARM' ? '◀️ Нdelays 7 Пн' : '◀️ Пред. 7 дней',
      callback_data: `page_${pageIndex - 1}`,
    });
  }
  if (hasMorePages) {
    navRow.push({
      text: lang === 'ARM' ? 'Delays 7 Пн ▶️' : 'След. 7 дней ▶️',
      callback_data: `page_${pageIndex + 1}`,
    });
  }
  if (navRow.length > 0) {
    rows.push(navRow);
  }

  await sendTelegramMessage(botToken, chatId, t.chooseDate, { inline_keyboard: rows });
}

async function showTimeSlotsMenu(supabase: any, botToken: string, chatId: number, session: TelegramSession, doctor: any) {
  const lang = session.language || 'RU';
  const t = translations[lang];

  const startHour = parseInt(doctor.work_day_start_time?.split(':')[0] || '9');
  const startMin = parseInt(doctor.work_day_start_time?.split(':')[1] || '0');
  const endHour = parseInt(doctor.work_day_end_time?.split(':')[0] || '18');
  const endMin = parseInt(doctor.work_day_end_time?.split(':')[1] || '0');
  const slotStep = doctor.slot_step_minutes || 30;
  const duration = session.duration_minutes || 30;

  // Get existing appointments for selected date
  const dateStart = `${session.selected_date}T00:00:00`;
  const dateEnd = `${session.selected_date}T23:59:59`;
  const { data: existingApts } = await supabase
    .from('appointments')
    .select('start_date_time, duration_minutes')
    .eq('doctor_id', doctor.id)
    .in('status', ['CONFIRMED', 'PENDING'])
    .gte('start_date_time', dateStart)
    .lte('start_date_time', dateEnd);

  const bookedSlots = (existingApts || []).map((a: any) => {
    const start = new Date(a.start_date_time);
    const end = new Date(start.getTime() + a.duration_minutes * 60000);
    return { start, end };
  });

  const slots: string[] = [];
  let current = new Date(`${session.selected_date}T${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00`);
  const endTime = new Date(`${session.selected_date}T${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00`);

  // For today, skip past slots
  const yerevantNow = getYerevanDate();
  const todayStr = formatDateISO(yerevantNow);
  if (session.selected_date === todayStr) {
    const currentHour = yerevantNow.getHours();
    const currentMin = yerevantNow.getMinutes();
    const nowTime = new Date(`${session.selected_date}T${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}:00`);
    if (current < nowTime) {
      current = nowTime;
      const mins = current.getMinutes();
      const roundedMins = Math.ceil(mins / slotStep) * slotStep;
      current.setMinutes(roundedMins, 0, 0);
    }
  }

  while (current < endTime) {
    const slotEnd = new Date(current.getTime() + duration * 60000);
    if (slotEnd > endTime) break;

    const isBooked = bookedSlots.some((b: any) => 
      (current >= b.start && current < b.end) || (slotEnd > b.start && slotEnd <= b.end) ||
      (current <= b.start && slotEnd >= b.end)
    );

    if (!isBooked) {
      slots.push(`${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}`);
    }

    current = new Date(current.getTime() + slotStep * 60000);
  }

  if (slots.length === 0) {
    await sendTelegramMessage(botToken, chatId, t.noSlots);
    session.step = 'awaiting_date';
    await supabase.from('telegram_sessions').upsert(session);
    await showDatesMenu(supabase, botToken, chatId, session, doctor, 0);
    return;
  }

  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < slots.length; i += 4) {
    rows.push(slots.slice(i, i + 4).map(s => ({ text: s, callback_data: `time_${s}` })));
  }

  await sendTelegramMessage(botToken, chatId, t.chooseTime, { inline_keyboard: rows });
}

async function showConfirmation(supabase: any, botToken: string, chatId: number, session: TelegramSession, doctor: any) {
  const lang = session.language || 'RU';
  const t = translations[lang];

  let serviceName = session.custom_reason || '-';
  if (session.service_id) {
    const { data: svc } = await supabase.from('services').select('name_arm, name_ru').eq('id', session.service_id).single();
    serviceName = svc ? (lang === 'ARM' ? svc.name_arm : svc.name_ru) : serviceName;
  }

  const dateDisplay = formatDateForDisplay(session.selected_date!, lang);
  const text = `${t.confirmBooking}\n\n${t.service}: ${serviceName}\n${t.dateTime}: ${dateDisplay} ${session.selected_time}`;

  const keyboard = {
    inline_keyboard: [[
      { text: t.yes, callback_data: 'confirm_yes' },
      { text: t.no, callback_data: 'confirm_no' },
    ]]
  };

  await sendTelegramMessage(botToken, chatId, text, keyboard);
}

async function createAppointment(supabase: any, botToken: string, chatId: number, session: TelegramSession, doctor: any) {
  const lang = session.language || 'RU';
  const t = translations[lang];

  const startDateTime = `${session.selected_date}T${session.selected_time}:00`;

  const { data: apt, error } = await supabase.from('appointments').insert({
    doctor_id: doctor.id,
    patient_id: session.patient_id,
    service_id: session.service_id,
    custom_reason: session.custom_reason,
    start_date_time: startDateTime,
    duration_minutes: session.duration_minutes || 30,
    status: 'PENDING',
    source: 'Telegram',
  }).select('id').single();

  if (error) {
    console.error("[Webhook] Failed to create appointment:", error);
    await sendTelegramMessage(botToken, chatId, "Error creating appointment. Please try again.");
    return;
  }

  console.log(`[Webhook] Appointment created: ${apt.id}`);
  await sendTelegramMessage(botToken, chatId, t.bookingConfirmed + "\n" + t.waitConfirmation);

  // Notify doctor
  if (doctor.telegram_chat_id) {
    const { data: patient } = await supabase.from('patients').select('first_name, last_name').eq('id', session.patient_id).single();
    const patientName = `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim();

    let serviceName = session.custom_reason || '-';
    if (session.service_id) {
      const { data: svc } = await supabase.from('services').select('name_arm, name_ru').eq('id', session.service_id).single();
      serviceName = svc ? (doctor.interface_language === 'ARM' ? svc.name_arm : svc.name_ru) : serviceName;
    }

    const dateDisplay = formatDateForDisplay(session.selected_date!, doctor.interface_language || 'RU');
    const doctorLang = (doctor.interface_language || 'RU') as 'ARM' | 'RU';
    const dt = translations[doctorLang];

    const notifyText = dt.newDoctor
      .replace('{patientName}', patientName)
      .replace('{service}', serviceName)
      .replace('{dateTime}', `${dateDisplay} ${session.selected_time}`);

    const doctorKeyboard = {
      inline_keyboard: [[
        { text: dt.confirm, callback_data: `apt_confirm_${apt.id}` },
        { text: dt.reject, callback_data: `apt_reject_${apt.id}` },
      ]]
    };

    await sendTelegramMessage(botToken, doctor.telegram_chat_id, notifyText, doctorKeyboard);
    console.log(`[Webhook] Doctor notified at chat ${doctor.telegram_chat_id}`);
  }
}
