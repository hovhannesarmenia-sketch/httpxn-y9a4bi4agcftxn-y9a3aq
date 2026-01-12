import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth, verifyDoctorOwnership } from "../_shared/auth.ts";
import { validateDoctorRequest } from "../_shared/validation.ts";
import { createErrorResponse } from "../_shared/errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const validation = validateDoctorRequest(body);
    if (!validation.success) {
      return validation.response!;
    }
    const { doctorId } = validation.data!;
    console.log("Checking connections for doctor:", doctorId);

    // Verify the user owns this doctor profile
    const { isOwner, error: ownershipError } = await verifyDoctorOwnership(authResult.userId, doctorId);
    if (!isOwner) {
      return ownershipError!;
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get doctor info (non-sensitive data)
    const { data: doctor } = await supabase
      .from("doctor")
      .select("google_calendar_id, google_sheet_id")
      .eq("id", doctorId)
      .maybeSingle();

    if (!doctor) {
      return new Response(JSON.stringify({ 
        telegram: false, 
        googleCalendar: false, 
        googleSheets: false 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get credentials from secure credentials table
    const { data: credentials } = await supabase
      .from("doctor_credentials")
      .select("telegram_bot_token")
      .eq("doctor_id", doctorId)
      .maybeSingle();

    let telegramConnected = false;
    let googleCalendarConnected = false;
    let googleSheetsConnected = false;

    // Check Telegram
    if (credentials?.telegram_bot_token) {
      try {
        // Remove "bot" prefix if it was accidentally included
        const cleanToken = credentials.telegram_bot_token.replace(/^bot/i, "");

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(
          `https://api.telegram.org/bot${cleanToken}/getMe`,
          { signal: controller.signal }
        );

        clearTimeout(timeout);

        const data = await response.json();
        telegramConnected = data?.ok === true;
        console.log("Telegram check:", telegramConnected);
      } catch (e) {
        console.error("Telegram check error:", e);
        telegramConnected = false;
      }
    }

    // Check Google integrations
    const serviceAccountKeyJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    
    if (serviceAccountKeyJson && doctor.google_calendar_id) {
      // For now, just check if the config exists
      googleCalendarConnected = true;
    }

    if (serviceAccountKeyJson && doctor.google_sheet_id) {
      googleSheetsConnected = true;
    }

    return new Response(
      JSON.stringify({
        telegram: telegramConnected,
        googleCalendar: googleCalendarConnected,
        googleSheets: googleSheetsConnected,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    return createErrorResponse(error, "Connection check", corsHeaders);
  }
});
