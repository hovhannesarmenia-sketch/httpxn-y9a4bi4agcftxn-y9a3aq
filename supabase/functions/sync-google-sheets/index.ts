import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GoogleServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
}

async function getAccessToken(serviceAccountKey: GoogleServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;

  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({
    iss: serviceAccountKey.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp,
    iat: now,
  }));

  const encoder = new TextEncoder();
  const data = encoder.encode(`${header}.${payload}`);

  const pemContents = serviceAccountKey.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, data);
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const jwt = `${header}.${payload}.${signatureBase64}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await response.json();
  
  if (!tokenData.access_token) {
    throw new Error("Failed to get Google access token");
  }

  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceAccountKeyJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");

    if (!serviceAccountKeyJson) {
      console.log("Google service account key not configured");
      return new Response(JSON.stringify({ error: "Google integration not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceAccountKey: GoogleServiceAccountKey = JSON.parse(serviceAccountKeyJson);
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { appointmentId, action } = await req.json();
    console.log("Sheets sync request:", { appointmentId, action });

    // Get appointment with related data
    const { data: appointment, error: aptError } = await supabase
      .from("appointments")
      .select(`
        *,
        patients (*),
        services (name_arm, name_ru),
        doctor:doctor_id (*)
      `)
      .eq("id", appointmentId)
      .single();

    if (aptError || !appointment) {
      console.error("Appointment not found:", aptError);
      return new Response(JSON.stringify({ error: "Appointment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const doctor = appointment.doctor;
    if (!doctor?.google_sheet_id) {
      console.log("No Google Sheet ID configured for doctor");
      return new Response(JSON.stringify({ error: "Sheets not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getAccessToken(serviceAccountKey);
    const sheetId = doctor.google_sheet_id;
    const patient = appointment.patients;

    if (action === "log") {
      const startTime = new Date(appointment.start_date_time);
      const serviceName = appointment.services
        ? (doctor.interface_language === "ARM" ? appointment.services.name_arm : appointment.services.name_ru)
        : appointment.custom_reason || "Прием";

      // Prepare row data
      const rowData = [
        appointment.id,
        startTime.toLocaleDateString("ru-RU"),
        startTime.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
        `${patient?.first_name || ""} ${patient?.last_name || ""}`.trim(),
        patient?.phone_number || "",
        serviceName,
        `${appointment.duration_minutes} мин`,
        appointment.status || "PENDING",
        appointment.source || "Telegram",
        new Date().toISOString(),
      ];

      // Append row to sheet
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A:J:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            values: [rowData],
          }),
        }
      );

      const result = await response.json();
      console.log("Sheets append result:", result);

      return new Response(JSON.stringify({ success: true, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Sheets sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
