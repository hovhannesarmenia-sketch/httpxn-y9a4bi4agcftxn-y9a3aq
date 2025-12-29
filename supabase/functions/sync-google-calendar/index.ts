import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth, verifyAppointmentOwnership } from "../_shared/auth.ts";

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
  auth_uri: string;
  token_uri: string;
}

async function getAccessToken(serviceAccountKey: GoogleServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;

  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({
    iss: serviceAccountKey.client_email,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: "https://oauth2.googleapis.com/token",
    exp,
    iat: now,
  }));

  // Simple JWT signing for RS256
  const encoder = new TextEncoder();
  const data = encoder.encode(`${header}.${payload}`);

  // Import the private key
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
    console.error("Failed to get access token:", tokenData);
    throw new Error("Failed to get Google access token");
  }

  return tokenData.access_token;
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

    const { appointmentId, action } = await req.json();
    console.log("Calendar sync request:", { appointmentId, action });

    // Verify the user owns the doctor associated with this appointment
    const { isOwner, error: ownershipError } = await verifyAppointmentOwnership(authResult.userId, appointmentId);
    if (!isOwner) {
      return ownershipError!;
    }

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
    if (!doctor?.google_calendar_id) {
      console.log("No Google Calendar ID configured for doctor");
      return new Response(JSON.stringify({ error: "Calendar not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getAccessToken(serviceAccountKey);
    const calendarId = doctor.google_calendar_id;
    const patient = appointment.patients;

    if (action === "create") {
      const startTime = new Date(appointment.start_date_time);
      const endTime = new Date(startTime.getTime() + appointment.duration_minutes * 60000);

      const serviceName = appointment.services
        ? (doctor.interface_language === "ARM" ? appointment.services.name_arm : appointment.services.name_ru)
        : appointment.custom_reason || "Прием";

      const event = {
        summary: `${patient?.first_name} ${patient?.last_name || ""} - ${serviceName}`,
        description: `Пациент: ${patient?.first_name} ${patient?.last_name || ""}\nТелефон: ${patient?.phone_number || "Не указан"}\nУслуга: ${serviceName}\nИсточник: ${appointment.source || "Web"}`,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: "Asia/Yerevan",
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: "Asia/Yerevan",
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 60 },
            { method: "popup", minutes: 15 },
          ],
        },
      };

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        }
      );

      const eventData = await response.json();
      console.log("Calendar event created:", eventData);

      if (eventData.id) {
        await supabase
          .from("appointments")
          .update({ google_calendar_event_id: eventData.id })
          .eq("id", appointmentId);
      }

      return new Response(JSON.stringify({ success: true, eventId: eventData.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "delete" && appointment.google_calendar_event_id) {
      await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${appointment.google_calendar_event_id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      console.log("Calendar event deleted");

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Calendar sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
