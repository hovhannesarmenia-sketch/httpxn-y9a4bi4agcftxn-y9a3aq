import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { botTranslations, type Language } from "../_shared/translations.ts";
import { verifyAuth, verifyAppointmentOwnership } from "../_shared/auth.ts";
import { validateCancellationRequest } from "../_shared/validation.ts";
import { createErrorResponse } from "../_shared/errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_API = "https://api.telegram.org/bot";

// Use shared translations
const translations = botTranslations;

async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string
) {
  const cleanToken = botToken.replace(/^bot/i, '');
  const url = `${TELEGRAM_API}${cleanToken}/sendMessage`;
  const body = { chat_id: chatId, text, parse_mode: "HTML" };

  console.log("[TG] Sending cancellation:", { chatId, text: text.substring(0, 60) });
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  console.log("[TG] Response:", data);
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authResult = await verifyAuth(req);
    if (authResult.error) {
      return authResult.error;
    }

    // Parse and validate input
    const body = await req.json();
    const validation = validateCancellationRequest(body);
    if (!validation.success) {
      return validation.response!;
    }
    const { appointmentId, reason } = validation.data!;
    console.log(`[Cancellation] Processing for appointment ${appointmentId}, reason: ${reason || 'none'}`);

    // Verify the user owns the doctor associated with this appointment
    const { isOwner, error: ownershipError } = await verifyAppointmentOwnership(authResult.userId, appointmentId);
    if (!isOwner) {
      return ownershipError!;
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get appointment with patient info
    const { data: appointment, error: aptError } = await supabase
      .from("appointments")
      .select("*, patients(*), services(name_arm, name_ru)")
      .eq("id", appointmentId)
      .single();

    if (aptError || !appointment) {
      console.error("[Cancellation] Appointment not found:", aptError);
      return new Response(
        JSON.stringify({ success: false, error: "Appointment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get doctor for bot token
    const { data: doctor } = await supabase
      .from("doctor")
      .select("telegram_bot_token, first_name, last_name")
      .eq("id", appointment.doctor_id)
      .single();

    if (!doctor?.telegram_bot_token) {
      console.log("[Cancellation] No bot token configured");
      return new Response(
        JSON.stringify({ success: true, message: "No bot token, skipped notification" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const patient = appointment.patients;
    if (!patient?.telegram_user_id) {
      console.log("[Cancellation] Patient has no telegram_user_id");
      return new Response(
        JSON.stringify({ success: true, message: "Patient has no Telegram ID, skipped notification" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build message based on patient's language
    const lang = (patient.language as 'ARM' | 'RU') || 'RU';
    const t = translations[lang];
    const startDT = new Date(appointment.start_date_time);
    const dateTimeStr = startDT.toLocaleString(lang === 'ARM' ? 'hy-AM' : 'ru-RU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });

    const serviceName = appointment.services 
      ? (lang === 'ARM' ? appointment.services.name_arm : appointment.services.name_ru)
      : '';

    let message = `${t.cancelledByDoctor}\n\n`;
    message += `📅 ${dateTimeStr}`;
    if (serviceName) {
      message += `\n🩺 ${serviceName}`;
    }
    if (reason && reason.trim()) {
      message += `\n\n${t.reason}: ${reason}`;
    }
    message += `\n\n${t.rebookMessage}`;

    // Send notification
    const result = await sendTelegramMessage(
      doctor.telegram_bot_token,
      patient.telegram_user_id,
      message
    );

    if (result.ok) {
      console.log(`[Cancellation] Successfully notified patient ${patient.telegram_user_id}`);
      return new Response(
        JSON.stringify({ success: true, message: "Patient notified" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      console.error("[Cancellation] Telegram API error:", result);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to send Telegram message" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    return createErrorResponse(error, "Cancellation", corsHeaders);
  }
});
