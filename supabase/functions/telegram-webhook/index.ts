import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_API = "https://api.telegram.org/bot";

interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    first_name: string;
    last_name?: string;
  };
  chat: {
    id: number;
  };
  text?: string;
  contact?: {
    phone_number: string;
    first_name: string;
    last_name?: string;
  };
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: {
    id: string;
    from: { id: number; first_name: string; last_name?: string };
    message: { chat: { id: number }; message_id: number };
    data: string;
  };
}

interface UserSession {
  step: 'choose_language' | 'enter_name' | 'share_phone' | 'choose_service' | 'choose_date' | 'choose_time' | 'confirm' | 'enter_custom_reason';
  language?: 'ARM' | 'RU';
  firstName?: string;
  lastName?: string;
  phone?: string;
  serviceId?: string;
  serviceName?: string;
  customReason?: string;
  date?: string;
  time?: string;
  duration?: number;
}

interface LLMClassificationResult {
  service_id: string;
  duration_minutes: number;
  confidence: number;
}

interface ServiceInfo {
  id: string;
  name_arm: string;
  name_ru: string;
  default_duration_minutes: number;
}

const userSessions = new Map<number, UserSession>();

const translations = {
  ARM: {
    welcome: "Barev dzez MedBook! Yntreq lezu:",
    enterName: "Khndrum enq grel dzez anun (Anun Azganun):",
    sharePhone: "Khndrum enq kisvatsnel dzez herakhosy:",
    sharePhoneButton: "📱 Kisvatsnel herakhosy",
    chooseService: "Yntreq tsarrayutyuny:",
    otherService: "🔹 Ayl",
    enterCustomReason: "Nkaragreq dzez aytselutyuny:",
    chooseDate: "Yntreq amsativ:",
    chooseTime: "Yntreq zham:",
    confirmBooking: "Hastateq granchum?",
    bookingConfirmed: "✅ Dzez granchumy stacvats e! Bzhishky piti hastati ayn.",
    bookingDetails: "📋 Granchumi manramasnutyunner:",
    service: "Tsarrayutyun",
    dateTime: "Amsativ u zham",
    waitConfirmation: "Spasum enq bzhishki hastatman...",
    appointmentConfirmed: "✅ Dzez granchumy hastatvats e!\n\n👨‍⚕️ Bzhishk: Dr. {doctorName}\n📅 {dateTime}",
    appointmentRejected: "❌ Dzez granchumy merjvats e.\n\nPatchar: {reason}",
    noSlots: "Ayt ory azat slotner chkan. Khndrum enq yntreq urarishy.",
    yes: "✅ Hastatiel",
    no: "❌ Cheghel",
    back: "◀️ Het",
  },
  RU: {
    welcome: "Добро пожаловать в MedBook! Выберите язык:",
    enterName: "Пожалуйста, введите ваше имя (Имя Фамилия):",
    sharePhone: "Пожалуйста, поделитесь вашим номером телефона:",
    sharePhoneButton: "📱 Поделиться номером",
    chooseService: "Выберите услугу:",
    otherService: "🔹 Другое",
    enterCustomReason: "Опишите причину вашего визита:",
    chooseDate: "Выберите дату:",
    chooseTime: "Выберите время:",
    confirmBooking: "Подтвердить запись?",
    bookingConfirmed: "✅ Ваша заявка отправлена! Врач должен подтвердить её.",
    bookingDetails: "📋 Детали записи:",
    service: "Услуга",
    dateTime: "Дата и время",
    waitConfirmation: "Ожидаем подтверждения врача...",
    appointmentConfirmed: "✅ Ваша запись подтверждена!\n\n👨‍⚕️ Врач: Др. {doctorName}\n📅 {dateTime}",
    appointmentRejected: "❌ Ваша запись отклонена.\n\nПричина: {reason}",
    noSlots: "На этот день нет свободных слотов. Выберите другую дату.",
    yes: "✅ Подтвердить",
    no: "❌ Отмена",
    back: "◀️ Назад",
  },
};

async function sendTelegramMessage(
  botToken: string, 
  chatId: number, 
  text: string, 
  replyMarkup?: object
) {
  // Remove "bot" prefix if user accidentally included it
  const cleanToken = botToken.replace(/^bot/i, '');
  const url = `${TELEGRAM_API}${cleanToken}/sendMessage`;
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  console.log("Sending telegram message:", { chatId, text: text.substring(0, 50) });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  console.log("Telegram response:", data);
  return data;
}

async function answerCallbackQuery(botToken: string, callbackQueryId: string, text?: string) {
  // Remove "bot" prefix if user accidentally included it
  const cleanToken = botToken.replace(/^bot/i, '');
  const url = `${TELEGRAM_API}${cleanToken}/answerCallbackQuery`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
    }),
  });
}

function getAvailableDates(): string[] {
  const dates: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 1; i <= 14; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dayOfWeek = date.getDay();
    // Skip Sunday (0)
    if (dayOfWeek !== 0) {
      dates.push(date.toISOString().split('T')[0]);
    }
  }
  return dates;
}

function formatDateForDisplay(dateStr: string, lang: 'ARM' | 'RU'): string {
  const date = new Date(dateStr + 'T00:00:00');
  const locale = lang === 'ARM' ? 'hy-AM' : 'ru-RU';
  return date.toLocaleDateString(locale, { 
    weekday: 'short', 
    day: 'numeric', 
    month: 'short' 
  });
}

// LLM Classification for free-text custom reasons
async function classifyWithLLM(
  customReason: string,
  services: ServiceInfo[],
  doctor: { ai_enabled?: boolean; llm_api_base_url?: string; llm_api_key?: string; llm_model_name?: string },
  lang: 'ARM' | 'RU'
): Promise<{ serviceId: string | null; duration: number; serviceName: string } | null> {
  // Check if AI is enabled and configured
  if (!doctor.ai_enabled || !doctor.llm_api_key || !doctor.llm_api_base_url) {
    console.log("AI assistant is disabled or not configured, skipping LLM classification");
    return null;
  }

  try {
    const serviceList = services.map(s => ({
      id: s.id,
      name: lang === 'ARM' ? s.name_arm : s.name_ru,
      duration_minutes: s.default_duration_minutes
    }));

    const prompt = `You are a medical appointment assistant. A patient has described their problem in free text. Based on this description, classify which medical service they need.

Patient's description: "${customReason}"

Available services:
${serviceList.map(s => `- ID: ${s.id}, Name: "${s.name}", Typical duration: ${s.duration_minutes} minutes`).join('\n')}

Instructions:
1. Analyze the patient's description
2. Choose the most appropriate service_id from the list above
3. Suggest a duration_minutes (must be one of: 30, 60, or 90)
4. Provide a confidence score from 0 to 1 indicating how certain you are about the match

Return ONLY a valid JSON object with this exact format:
{"service_id": "uuid-here", "duration_minutes": 30, "confidence": 0.85}

If no service matches well, set confidence below 0.5.`;

    const modelName = doctor.llm_model_name || 'deepseek-chat';
    const apiUrl = doctor.llm_api_base_url.endsWith('/') 
      ? `${doctor.llm_api_base_url}chat/completions` 
      : `${doctor.llm_api_base_url}/chat/completions`;

    console.log(`Calling LLM API: ${apiUrl} with model: ${modelName}`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${doctor.llm_api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: 'You are a medical appointment classification assistant. Always respond with valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`LLM API error (${response.status}):`, errorText);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      console.error("LLM returned empty content");
      return null;
    }

    console.log("LLM response content:", content);

    // Parse JSON from response (handle potential markdown code blocks)
    let jsonStr = content;
    if (content.includes('```')) {
      const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      jsonStr = match ? match[1].trim() : content;
    }

    const result: LLMClassificationResult = JSON.parse(jsonStr);

    console.log("Parsed LLM result:", result);

    // Validate result
    if (!result.service_id || typeof result.confidence !== 'number') {
      console.error("Invalid LLM result format");
      return null;
    }

    // Check confidence threshold
    if (result.confidence < 0.7) {
      console.log(`Low confidence (${result.confidence}), falling back to manual selection`);
      return null;
    }

    // Validate service_id exists
    const matchedService = services.find(s => s.id === result.service_id);
    if (!matchedService) {
      console.error(`Service ID ${result.service_id} not found in available services`);
      return null;
    }

    // Validate duration
    const validDurations = [30, 60, 90];
    const duration = validDurations.includes(result.duration_minutes) 
      ? result.duration_minutes 
      : matchedService.default_duration_minutes;

    return {
      serviceId: result.service_id,
      duration,
      serviceName: lang === 'ARM' ? matchedService.name_arm : matchedService.name_ru
    };

  } catch (error) {
    console.error("LLM classification error:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const update: TelegramUpdate = await req.json();
    console.log("Received Telegram update:", JSON.stringify(update));

    // Get doctor info
    const { data: doctor } = await supabase
      .from("doctor")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!doctor?.telegram_bot_token) {
      console.log("No doctor or bot token configured");
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const botToken = doctor.telegram_bot_token;

    // Handle callback queries (button clicks)
    if (update.callback_query) {
      const callback = update.callback_query;
      const userId = callback.from.id;
      const chatId = callback.message.chat.id;
      const data = callback.data;
      const session = userSessions.get(userId) || { step: 'choose_language' };
      const lang = session.language || 'RU';
      const t = translations[lang];

      await answerCallbackQuery(botToken, callback.id);

      if (data.startsWith('lang_')) {
        session.language = data === 'lang_arm' ? 'ARM' : 'RU';
        session.step = 'enter_name';
        userSessions.set(userId, session);
        await sendTelegramMessage(botToken, chatId, translations[session.language].enterName);
      } else if (data.startsWith('service_')) {
        if (data === 'service_other') {
          session.serviceId = 'other';
          session.serviceName = t.otherService;
          session.step = 'choose_date';
          userSessions.set(userId, session);
          await sendTelegramMessage(botToken, chatId, translations[lang].enterCustomReason);
        } else if (data === 'service_keep_other') {
          // User chose to keep the custom reason as "Other"
          session.serviceId = null as any;
          session.duration = 30;
          session.step = 'choose_date';
          
          const dates = getAvailableDates();
          const keyboard = {
            inline_keyboard: dates.map(date => [{
              text: formatDateForDisplay(date, lang),
              callback_data: `date_${date}`,
            }]).reduce((acc, curr, idx) => {
              const rowIdx = Math.floor(idx / 3);
              if (!acc[rowIdx]) acc[rowIdx] = [];
              acc[rowIdx].push(curr[0]);
              return acc;
            }, [] as { text: string; callback_data: string }[][]),
          };
          
          await sendTelegramMessage(botToken, chatId, t.chooseDate, keyboard);
          userSessions.set(userId, session);
        } else {
          const serviceId = data.replace('service_', '');
          const { data: service } = await supabase
            .from('services')
            .select('*')
            .eq('id', serviceId)
            .single();
          
          if (service) {
            session.serviceId = serviceId;
            session.serviceName = lang === 'ARM' ? service.name_arm : service.name_ru;
            session.duration = service.default_duration_minutes;
            session.step = 'choose_date';
            userSessions.set(userId, session);

            const dates = getAvailableDates();
            const keyboard = {
              inline_keyboard: dates.map(date => [{
                text: formatDateForDisplay(date, lang),
                callback_data: `date_${date}`,
              }]).reduce((acc, curr, idx) => {
                const rowIdx = Math.floor(idx / 3);
                if (!acc[rowIdx]) acc[rowIdx] = [];
                acc[rowIdx].push(curr[0]);
                return acc;
              }, [] as { text: string; callback_data: string }[][]),
            };

            await sendTelegramMessage(botToken, chatId, t.chooseDate, keyboard);
          }
        }
      } else if (data.startsWith('date_')) {
        session.date = data.replace('date_', '');
        session.step = 'choose_time';
        userSessions.set(userId, session);

        // Generate time slots based on doctor's work hours
        const startHour = parseInt(doctor.work_day_start_time?.split(':')[0] || '9');
        const endHour = parseInt(doctor.work_day_end_time?.split(':')[0] || '18');
        const step = doctor.slot_step_minutes || 15;

        const slots: string[] = [];
        for (let h = startHour; h < endHour; h++) {
          for (let m = 0; m < 60; m += step) {
            slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
          }
        }

        // Check existing appointments for this date
        const { data: existingAppts } = await supabase
          .from('appointments')
          .select('start_date_time, duration_minutes')
          .eq('status', 'CONFIRMED')
          .gte('start_date_time', `${session.date}T00:00:00`)
          .lte('start_date_time', `${session.date}T23:59:59`);

        // Filter out occupied slots
        const availableSlots = slots.filter(slot => {
          const slotStart = new Date(`${session.date}T${slot}:00`);
          const slotEnd = new Date(slotStart.getTime() + (session.duration || 30) * 60000);

          return !existingAppts?.some(appt => {
            const apptStart = new Date(appt.start_date_time);
            const apptEnd = new Date(apptStart.getTime() + appt.duration_minutes * 60000);
            return (slotStart < apptEnd && slotEnd > apptStart);
          });
        });

        if (availableSlots.length === 0) {
          await sendTelegramMessage(botToken, chatId, t.noSlots);
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const keyboard = {
          inline_keyboard: availableSlots.slice(0, 15).map(slot => [{
            text: slot,
            callback_data: `time_${slot}`,
          }]).reduce((acc, curr, idx) => {
            const rowIdx = Math.floor(idx / 4);
            if (!acc[rowIdx]) acc[rowIdx] = [];
            acc[rowIdx].push(curr[0]);
            return acc;
          }, [] as { text: string; callback_data: string }[][]),
        };

        await sendTelegramMessage(botToken, chatId, t.chooseTime, keyboard);
      } else if (data.startsWith('time_')) {
        session.time = data.replace('time_', '');
        session.step = 'confirm';
        userSessions.set(userId, session);

        const confirmText = `${t.confirmBooking}\n\n${t.service}: ${session.serviceName}\n${t.dateTime}: ${session.date} ${session.time}`;
        const keyboard = {
          inline_keyboard: [
            [
              { text: t.yes, callback_data: 'confirm_yes' },
              { text: t.no, callback_data: 'confirm_no' },
            ],
          ],
        };

        await sendTelegramMessage(botToken, chatId, confirmText, keyboard);
      } else if (data === 'confirm_yes') {
        // Create or get patient
        let { data: patient } = await supabase
          .from('patients')
          .select('*')
          .eq('telegram_user_id', userId)
          .maybeSingle();

        if (!patient) {
          const { data: newPatient } = await supabase
            .from('patients')
            .insert({
              telegram_user_id: userId,
              first_name: session.firstName || callback.from.first_name,
              last_name: session.lastName || callback.from.last_name,
              phone_number: session.phone,
              language: lang,
            })
            .select()
            .single();
          patient = newPatient;
        }

        if (patient && doctor) {
          const startDateTime = `${session.date}T${session.time}:00+04:00`; // Asia/Yerevan

          const { data: appointment, error } = await supabase
            .from('appointments')
            .insert({
              doctor_id: doctor.id,
              patient_id: patient.id,
              service_id: session.serviceId !== 'other' ? session.serviceId : null,
              custom_reason: session.serviceId === 'other' ? session.serviceName : null,
              start_date_time: startDateTime,
              duration_minutes: session.duration || 30,
              status: 'PENDING',
              source: 'Telegram',
            })
            .select()
            .single();

          if (error) {
            console.error("Error creating appointment:", error);
            await sendTelegramMessage(botToken, chatId, "Error creating appointment. Please try again.");
          } else {
            await sendTelegramMessage(botToken, chatId, `${t.bookingConfirmed}\n\n${t.waitConfirmation}`);

            // Notify doctor
            if (doctor.telegram_chat_id) {
              const doctorLang = doctor.interface_language || 'RU';
              const notifyText = doctorLang === 'RU'
                ? `🔔 <b>Новая заявка!</b>\n\n👤 Пациент: ${patient.first_name} ${patient.last_name || ''}\n📱 Телефон: ${patient.phone_number || 'Не указан'}\n💼 Услуга: ${session.serviceName}\n📅 Дата: ${session.date}\n🕐 Время: ${session.time}\n⏱ Длительность: ${session.duration} мин`
                : `🔔 <b>Новая заявка!</b>\n\n👤 Пациент: ${patient.first_name} ${patient.last_name || ''}\n📱 Телефон: ${patient.phone_number || 'Не указан'}\n💼 Услуга: ${session.serviceName}\n📅 Дата: ${session.date}\n🕐 Время: ${session.time}\n⏱ Длительность: ${session.duration} мин`;

              const doctorKeyboard = {
                inline_keyboard: [
                  [
                    { text: '✅ Подтвердить (30 мин)', callback_data: `approve_${appointment.id}_30` },
                    { text: '✅ (60 мин)', callback_data: `approve_${appointment.id}_60` },
                  ],
                  [
                    { text: '❌ Отклонить', callback_data: `reject_${appointment.id}` },
                  ],
                ],
              };

              await sendTelegramMessage(botToken, parseInt(doctor.telegram_chat_id), notifyText, doctorKeyboard);
            }
          }
        }

        userSessions.delete(userId);
      } else if (data === 'confirm_no') {
        userSessions.delete(userId);
        await sendTelegramMessage(botToken, chatId, lang === 'RU' ? 'Запись отменена.' : 'Granchumy chgtsvats e.');
      } else if (data.startsWith('approve_')) {
        // Doctor approval
        const parts = data.split('_');
        const appointmentId = parts[1];
        const duration = parseInt(parts[2]);

        const { data: appointment } = await supabase
          .from('appointments')
          .update({ status: 'CONFIRMED', duration_minutes: duration })
          .eq('id', appointmentId)
          .select(`*, patients (*)`)
          .single();

        if (appointment?.patients) {
          const patient = appointment.patients;
          const patientLang: "ARM" | "RU" = patient.language === "ARM" ? "ARM" : "RU";
          const t = translations[patientLang];
          const dateTime = new Date(appointment.start_date_time).toLocaleString(
            patientLang === 'ARM' ? 'hy-AM' : 'ru-RU'
          );
          const confirmMsg = t.appointmentConfirmed
            .replace('{doctorName}', `${doctor.first_name} ${doctor.last_name}`)
            .replace('{dateTime}', dateTime);

          // Notify patient
          await sendTelegramMessage(botToken, patient.telegram_user_id, confirmMsg);

          // Sync to Google Calendar
          try {
            await supabase.functions.invoke('sync-google-calendar', {
              body: { appointmentId, action: 'create' },
            });
          } catch (e) {
            console.error("Calendar sync error:", e);
          }

          // Log to Google Sheets
          try {
            await supabase.functions.invoke('sync-google-sheets', {
              body: { appointmentId, action: 'log' },
            });
          } catch (e) {
            console.error("Sheets sync error:", e);
          }
        }

        await sendTelegramMessage(botToken, chatId, '✅ Запись подтверждена!');
      } else if (data.startsWith('reject_')) {
        const appointmentId = data.replace('reject_', '');

        const { data: appointment } = await supabase
          .from('appointments')
          .update({ status: 'REJECTED', rejection_reason: 'Отклонено врачом' })
          .eq('id', appointmentId)
          .select(`*, patients (*)`)
          .single();

        if (appointment?.patients) {
          const patient = appointment.patients;
          const patientLang: "ARM" | "RU" = patient.language === "ARM" ? "ARM" : "RU";
          const t = translations[patientLang];
          const rejectMsg = t.appointmentRejected.replace('{reason}', 'Врач не может принять вас в это время.');
          await sendTelegramMessage(botToken, patient.telegram_user_id, rejectMsg);
        }

        await sendTelegramMessage(botToken, chatId, '❌ Запись отклонена.');
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle text messages
    if (update.message) {
      const message = update.message;
      const userId = message.from.id;
      const chatId = message.chat.id;
      const text = message.text;
      const session = userSessions.get(userId) || { step: 'choose_language' };

      if (text === '/start' || !session.language) {
        session.step = 'choose_language';
        userSessions.set(userId, session);

        const keyboard = {
          inline_keyboard: [
            [
              { text: '🇦🇲 Hayeren', callback_data: 'lang_arm' },
              { text: '🇷🇺 Русский', callback_data: 'lang_ru' },
            ],
          ],
        };

        await sendTelegramMessage(
          botToken,
          chatId,
          `${translations.RU.welcome}\n${translations.ARM.welcome}`,
          keyboard
        );
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const lang = session.language || 'RU';
      const t = translations[lang];

      if (session.step === 'enter_name' && text) {
        const nameParts = text.trim().split(' ');
        session.firstName = nameParts[0];
        session.lastName = nameParts.slice(1).join(' ') || undefined;
        session.step = 'share_phone';
        userSessions.set(userId, session);

        const keyboard = {
          keyboard: [[{ text: t.sharePhoneButton, request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        };

        await sendTelegramMessage(botToken, chatId, t.sharePhone, keyboard);
      } else if (message.contact) {
        session.phone = message.contact.phone_number;
        session.step = 'choose_service';
        userSessions.set(userId, session);

        // Get services
        const { data: services } = await supabase
          .from('services')
          .select('*')
          .eq('doctor_id', doctor.id)
          .eq('is_active', true)
          .order('sort_order');

        const serviceButtons = (services || []).map(s => [{
          text: lang === 'ARM' ? s.name_arm : s.name_ru,
          callback_data: `service_${s.id}`,
        }]);

        serviceButtons.push([{ text: t.otherService, callback_data: 'service_other' }]);

        const keyboard = { inline_keyboard: serviceButtons };

        // Remove custom keyboard
        await sendTelegramMessage(botToken, chatId, t.chooseService, { 
          ...keyboard,
          remove_keyboard: true 
        });
      } else if (session.step === 'choose_date' && session.serviceId === 'other' && text) {
        // Custom reason entered - try LLM classification
        session.customReason = text;
        
        // Get services for classification
        const { data: services } = await supabase
          .from('services')
          .select('id, name_arm, name_ru, default_duration_minutes')
          .eq('doctor_id', doctor.id)
          .eq('is_active', true);

        // Try to classify with LLM if enabled
        const llmResult = await classifyWithLLM(
          text,
          services || [],
          doctor,
          lang
        );

        if (llmResult && llmResult.serviceId) {
          // LLM successfully classified the reason
          console.log(`LLM classified custom reason to service: ${llmResult.serviceName}`);
          session.serviceId = llmResult.serviceId;
          session.serviceName = `${llmResult.serviceName} (AI)`;
          session.duration = llmResult.duration;
          
          // Proceed to date selection
          const dates = getAvailableDates();
          const keyboard = {
            inline_keyboard: dates.map(date => [{
              text: formatDateForDisplay(date, lang),
              callback_data: `date_${date}`,
            }]).reduce((acc, curr, idx) => {
              const rowIdx = Math.floor(idx / 3);
              if (!acc[rowIdx]) acc[rowIdx] = [];
              acc[rowIdx].push(curr[0]);
              return acc;
            }, [] as { text: string; callback_data: string }[][]),
          };

          await sendTelegramMessage(botToken, chatId, t.chooseDate, keyboard);
        } else {
          // Fallback: Ask patient to choose service manually
          console.log("LLM classification failed or disabled, falling back to manual selection");
          session.serviceName = text;
          session.duration = 30;
          
          // Show service selection again
          const serviceButtons = (services || []).map(s => [{
            text: lang === 'ARM' ? s.name_arm : s.name_ru,
            callback_data: `service_${s.id}`,
          }]);

          // Add option to keep as "Other"
          serviceButtons.push([{ 
            text: lang === 'ARM' ? '📝 Paheq ibrev "Ayl"' : '📝 Оставить как "Другое"', 
            callback_data: 'service_keep_other' 
          }]);

          const keyboard = { inline_keyboard: serviceButtons };
          const fallbackMsg = lang === 'ARM' 
            ? 'Yntreq tsarrayutyuny kamarts shdpvel dzez aytselutyuny:'
            : 'Выберите услугу или оставьте как "Другое":';

          await sendTelegramMessage(botToken, chatId, fallbackMsg, keyboard);
        }
        
        userSessions.set(userId, session);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
