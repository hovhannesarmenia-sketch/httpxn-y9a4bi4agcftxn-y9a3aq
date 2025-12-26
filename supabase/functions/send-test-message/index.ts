import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { doctorId } = await req.json();
    console.log("Sending test message for doctor:", doctorId);

    // Get doctor info
    const { data: doctor } = await supabase
      .from("doctor")
      .select("*")
      .eq("id", doctorId)
      .maybeSingle();

    if (!doctor?.telegram_bot_token || !doctor?.telegram_chat_id) {
      return new Response(
        JSON.stringify({ error: "Telegram not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lang = doctor.interface_language || "RU";
    const testMessage = lang === "ARM"
      ? "✅ MedBook: Թdelays haghordagirutyuny hajox ashxатецй!"
      : "✅ MedBook: Тестовое сообщение успешно отправлено!";

    // Remove "bot" prefix if user accidentally included it
    const botToken = doctor.telegram_bot_token.replace(/^bot/i, '');

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: doctor.telegram_chat_id,
          text: testMessage,
          parse_mode: "HTML",
        }),
      }
    );

    const data = await response.json();
    console.log("Test message result:", data);

    if (!data.ok) {
      throw new Error(data.description || "Failed to send message");
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Test message error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
