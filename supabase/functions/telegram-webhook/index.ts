import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  language: 'ARM' | 'RU' | null;
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

const translations = {
  ARM: {
    welcome: "Barev dzez MedBook! Yntreq lezu:",
    enterName: "Khndrum enq grel dzez anun (Anun Azganun):",
    sharePhone: "Khndrum enq kisvatsnel dzez herakhosy:",
    sharePhoneButton: "📱 Kisvatsnel herakhosy",
    skipPhone: "Bats toel",
    chooseService: "Yntreq tsarrayutyuny:",
    otherService: "🔹 Ayl",
    enterCustomReason: "Nkaragreq dzez aytselutyuny:",
    chooseDate: "Yntreq amsativ:",
    chooseTime: "Yntreq zham:",
    confirmBooking: "Hastateq granchum?",
    bookingConfirmed: "✅ Dzez granchumy stacvats e! Bzhishky piti hastati ayn.",
    service: "Tsarrayutyun",
    dateTime: "Amsativ u zham",
    waitConfirmation: "Spasum enq bzhishki hastatman...",
    appointmentConfirmed: "✅ Dzez granchumy hastatvats e!\n\n👨‍⚕️ Bzhishk: Dr. {doctorName}\n📅 {dateTime}",
    appointmentRejected: "❌ Dzez granchumy merjvats e.\n\nPatchar: {reason}",
    noSlots: "Ayt ory azat slotner chkan. Khndrum enq yntreq urarishy.",
    yes: "✅ Hastatiel",
    no: "❌ Cheghel",
    back: "◀️ Het",
    newDoctor: "👨‍⚕️ Nor granchum harcum:\n\nPacient: {patientName}\nTsarrayutyun: {service}\nAmset: {dateTime}\n\nSteghtsek gortsoghutyan:",
    confirm: "✅ Hastatiel",
    reject: "❌ Merjel",
  },
  RU: {
    welcome: "Добро пожаловать в MedBook! Выберите язык:",
    enterName: "Пожалуйста, введите ваше имя (Имя Фамилия):",
    sharePhone: "Пожалуйста, поделитесь вашим номером телефона:",
    sharePhoneButton: "📱 Поделиться номером",
    skipPhone: "Пропустить",
    chooseService: "Выберите услугу:",
    otherService: "🔹 Другое",
    enterCustomReason: "Опишите причину вашего визита:",
    chooseDate: "Выберите дату:",
    chooseTime: "Выберите время:",
    confirmBooking: "Подтвердить запись?",
    bookingConfirmed: "✅ Ваша заявка отправлена! Врач должен подтвердить её.",
    service: "Услуга",
    dateTime: "Дата и время",
    waitConfirmation: "Ожидаем подтверждения врача...",
    appointmentConfirmed: "✅ Ваша запись подтверждена!\n\n👨‍⚕️ Врач: Др. {doctorName}\n📅 {dateTime}",
    appointmentRejected: "❌ Ваша запись отклонена.\n\nПричина: {reason}",
    noSlots: "На этот день нет свободных слотов. Выберите другую дату.",
    yes: "✅ Подтвердить",
    no: "❌ Отмена",
    back: "◀️ Назад",
    newDoctor: "👨‍⚕️ Новая запись:\n\nПациент: {patientName}\nУслуга: {service}\nДата: {dateTime}\n\nВыберите действие:",
    confirm: "✅ Подтвердить",
    reject: "❌ Отклонить",
  },
};

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

function getAvailableDates(workDays?: string[]): string[] {
  const dates: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayNameToNumber: Record<string, number> = {
    SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6,
  };
  const validDays = new Set(workDays?.map(d => dayNameToNumber[d]) || [1, 2, 3, 4, 5]);
  for (let i = 1; i <= 21; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    if (validDays.has(date.getDay())) {
      dates.push(date.toISOString().split('T')[0]);
      if (dates.length >= 14) break;
    }
  }
  return dates;
}

function formatDateForDisplay(dateStr: string, lang: 'ARM' | 'RU'): string {
  const date = new Date(dateStr + 'T00:00:00');
  const locale = lang === 'ARM' ? 'hy-AM' : 'ru-RU';
  return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
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
            await showDatesMenu(botToken, chatId, session, doctor);
          }
        }
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
            [{ text: "🇦🇲 Hayeren", callback_data: "lang_arm" }, { text: "🇷🇺 Русский", callback_data: "lang_ru" }]
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
          // User sent text instead of clicking button - show language selection again
          console.log(`[Flow] ${userId}: awaiting_language, re-showing language buttons`);
          const keyboard = {
            inline_keyboard: [
              [{ text: "🇦🇲 Hayeren", callback_data: "lang_arm" }, { text: "🇷🇺 Русский", callback_data: "lang_ru" }]
            ]
          };
          await sendTelegramMessage(botToken, chatId, `${translations.RU.welcome}\n${translations.ARM.welcome}`, keyboard);
          break;

        case 'awaiting_name':
          // Parse name from text
          const nameParts = text.split(/\s+/);
          const firstName = nameParts[0] || text;
          const lastName = nameParts.slice(1).join(' ') || null;

          console.log(`[Flow] ${userId}: received name="${firstName} ${lastName}", creating/updating patient`);

          // Upsert patient
          const { data: existingPatient } = await supabase
            .from('patients')
            .select('id')
            .eq('telegram_user_id', userId)
            .maybeSingle();

          let patientId: string;
          if (existingPatient) {
            await supabase.from('patients').update({
              first_name: firstName,
              last_name: lastName,
              language: session.language,
            }).eq('id', existingPatient.id);
            patientId = existingPatient.id;
          } else {
            const { data: newPatient } = await supabase.from('patients').insert({
              telegram_user_id: userId,
              first_name: firstName,
              last_name: lastName,
              language: session.language,
            }).select('id').single();
            patientId = newPatient?.id;
          }

          session.patient_id = patientId;
          session.step = 'awaiting_phone';
          await updateSession(supabase, session);

          console.log(`[Flow] ${userId}: patient saved, patientId=${patientId} -> awaiting_phone`);

          // Ask for phone with skip option
          const phoneKeyboard = {
            keyboard: [[{ text: t.sharePhoneButton, request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          };
          const skipKeyboard = { inline_keyboard: [[{ text: t.skipPhone, callback_data: 'skip_phone' }]] };
          await sendTelegramMessage(botToken, chatId, t.sharePhone, phoneKeyboard);
          await sendTelegramMessage(botToken, chatId, "👇", skipKeyboard);
          break;

        case 'awaiting_phone':
          // Handle contact share
          if (msg.contact?.phone_number) {
            await supabase.from('patients').update({ phone_number: msg.contact.phone_number }).eq('id', session.patient_id);
            console.log(`[Flow] ${userId}: phone saved -> awaiting_service`);
          } else {
            console.log(`[Flow] ${userId}: text instead of contact, treating as phone or skip -> awaiting_service`);
            // Could be phone as text, save it
            if (/^\+?\d{6,}$/.test(text.replace(/\s/g, ''))) {
              await supabase.from('patients').update({ phone_number: text }).eq('id', session.patient_id);
            }
          }
          session.step = 'awaiting_service';
          await updateSession(supabase, session);
          await showServicesMenu(supabase, botToken, chatId, session, doctor);
          break;

        case 'awaiting_service':
          // If user types text here, treat it as custom reason
          session.custom_reason = text;
          session.duration_minutes = 30; // default for custom
          session.step = 'awaiting_date';
          await updateSession(supabase, session);
          console.log(`[Flow] ${userId}: custom reason="${text}" -> awaiting_date`);
          await showDatesMenu(botToken, chatId, session, doctor);
          break;

        case 'awaiting_date':
        case 'awaiting_time':
        case 'awaiting_confirmation':
          // User sent text when buttons expected - resend appropriate menu
          console.log(`[Flow] ${userId}: unexpected text at step=${session.step}, re-showing menu`);
          if (session.step === 'awaiting_date') await showDatesMenu(botToken, chatId, session, doctor);
          else if (session.step === 'awaiting_time') await showTimeSlotsMenu(supabase, botToken, chatId, session, doctor);
          else if (session.step === 'awaiting_confirmation') await showConfirmation(supabase, botToken, chatId, session, doctor);
          break;

        case 'idle':
          // After booking, show services again for new booking
          session.step = 'awaiting_service';
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

async function showDatesMenu(botToken: string, chatId: number, session: TelegramSession, doctor: any) {
  const lang = session.language || 'RU';
  const t = translations[lang];
  const dates = getAvailableDates(doctor.work_days as string[] | undefined);

  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < dates.length; i += 3) {
    rows.push(dates.slice(i, i + 3).map(d => ({
      text: formatDateForDisplay(d, lang),
      callback_data: `date_${d}`,
    })));
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
    .eq('status', 'CONFIRMED')
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

  while (current < endTime) {
    const slotEnd = new Date(current.getTime() + duration * 60000);
    if (slotEnd > endTime) break;

    const isBooked = bookedSlots.some((b: any) => 
      (current >= b.start && current < b.end) || (slotEnd > b.start && slotEnd <= b.end)
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
    await showDatesMenu(botToken, chatId, session, doctor);
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
