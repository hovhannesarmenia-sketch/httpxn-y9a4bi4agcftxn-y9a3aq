import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_API = "https://api.telegram.org/bot";

const translations = {
  ARM: {
    reminder24h: "🔔 Hishdelays! Vaxe ek granchum Dr. {doctorName}-i mot:\n📅 {dateTime}\n\nKhtoroshum em dzez tesnelun!",
    reminder2h: "⏰ Hishdelays! 2 zham hetoy dukh granchum uneq Dr. {doctorName}-i mot.\n📅 Zham: {time}",
  },
  RU: {
    reminder24h: "🔔 Напоминание! Завтра у вас запись к Dr. {doctorName}:\n📅 {dateTime}\n\nЖдём вас!",
    reminder2h: "⏰ Напоминание! Через 2 часа у вас приём у Dr. {doctorName}.\n📅 Время: {time}",
  },
};

async function sendTelegramMessage(botToken: string, chatId: number, text: string) {
  const url = `${TELEGRAM_API}${botToken}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  });
  return response.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Running reminder check...");

    // Get current time in Yerevan timezone
    const now = new Date();
    const yerevanOffset = 4 * 60 * 60 * 1000; // UTC+4
    const yerevanNow = new Date(now.getTime() + yerevanOffset);

    // Calculate time windows
    const in24Hours = new Date(yerevanNow.getTime() + 24 * 60 * 60 * 1000);
    const in2Hours = new Date(yerevanNow.getTime() + 2 * 60 * 60 * 1000);

    // Get doctor
    const { data: doctor } = await supabase
      .from("doctor")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!doctor?.telegram_bot_token) {
      console.log("No doctor or bot token configured");
      return new Response(JSON.stringify({ message: "No bot configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const botToken = doctor.telegram_bot_token;
    const doctorName = `${doctor.first_name} ${doctor.last_name}`;

    // Get confirmed appointments that need reminders
    const { data: appointments, error } = await supabase
      .from("appointments")
      .select(`
        *,
        patients (*)
      `)
      .eq("status", "CONFIRMED")
      .gte("start_date_time", now.toISOString());

    if (error) {
      console.error("Error fetching appointments:", error);
      throw error;
    }

    console.log(`Found ${appointments?.length || 0} confirmed appointments`);

    let sentCount = 0;

    for (const appointment of appointments || []) {
      const patient = appointment.patients;
      if (!patient?.telegram_user_id) continue;

      const appointmentTime = new Date(appointment.start_date_time);
      const lang: "ARM" | "RU" = patient.language === "ARM" ? "ARM" : "RU";
      const t = translations[lang];

      // Check if 24h reminder is needed
      const hoursDiff = (appointmentTime.getTime() - yerevanNow.getTime()) / (1000 * 60 * 60);

      // 24h reminder (between 23-25 hours before)
      if (hoursDiff >= 23 && hoursDiff <= 25) {
        // Check if already sent
        const { data: existingLog } = await supabase
          .from("reminder_logs")
          .select("id")
          .eq("appointment_id", appointment.id)
          .eq("reminder_type", "BEFORE_24H")
          .maybeSingle();

        if (!existingLog) {
          const dateTime = appointmentTime.toLocaleString(lang === "ARM" ? "hy-AM" : "ru-RU", {
            weekday: "long",
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
          });

          const message = t.reminder24h
            .replace("{doctorName}", doctorName)
            .replace("{dateTime}", dateTime);

          const result = await sendTelegramMessage(botToken, patient.telegram_user_id, message);
          console.log("24h reminder sent:", result);

          await supabase.from("reminder_logs").insert({
            appointment_id: appointment.id,
            reminder_type: "BEFORE_24H",
          });

          sentCount++;
        }
      }

      // 2h reminder (between 1.5-2.5 hours before)
      if (hoursDiff >= 1.5 && hoursDiff <= 2.5) {
        const { data: existingLog } = await supabase
          .from("reminder_logs")
          .select("id")
          .eq("appointment_id", appointment.id)
          .eq("reminder_type", "BEFORE_2H")
          .maybeSingle();

        if (!existingLog) {
          const time = appointmentTime.toLocaleTimeString(lang === "ARM" ? "hy-AM" : "ru-RU", {
            hour: "2-digit",
            minute: "2-digit",
          });

          const message = t.reminder2h
            .replace("{doctorName}", doctorName)
            .replace("{time}", time);

          const result = await sendTelegramMessage(botToken, patient.telegram_user_id, message);
          console.log("2h reminder sent:", result);

          await supabase.from("reminder_logs").insert({
            appointment_id: appointment.id,
            reminder_type: "BEFORE_2H",
          });

          sentCount++;
        }
      }
    }

    console.log(`Sent ${sentCount} reminders`);

    return new Response(
      JSON.stringify({ success: true, remindersSent: sentCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Reminder error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
