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
      ? "✅ MedBook\u0589 \u0583\u0578\u0580\u0571\u0576\u0561\u056F\u0561\u0576 \u0570\u0561\u0572\u0578\u0580\u0564\u0561\u0563\u0580\u0578\u0582\u0569\u0575\u0578\u0582\u0576\u0568 \u0570\u0561\u057B\u0578\u0572 \u0561\u0577\u056D\u0561\u057F\u0565\u0581\u0589"
      : "✅ MedBook: Тестовое сообщение успешно отправлено!";

    // Remove "bot" prefix if user accidentally included it
    const botToken = doctor.telegram_bot_token.replace(/^bot/i, '');

    let response: Response;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: doctor.telegram_chat_id,
            text: testMessage,
            parse_mode: "HTML",
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);
    } catch (e) {
      console.error("Telegram sendMessage network error:", e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      return new Response(
        JSON.stringify({
          error:
            "Telegram API unreachable (timeout or network block). " +
            "Please retry in a minute; if it persists, outbound access to api.telegram.org is failing from the backend.",
          details: errorMessage,
        }),
        {
          status: 504,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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
