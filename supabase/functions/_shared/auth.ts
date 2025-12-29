import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthResult {
  userId: string;
  error?: never;
}

export interface AuthError {
  userId?: never;
  error: Response;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Verifies the JWT from the Authorization header and returns the user ID.
 * Returns an error Response if authentication fails.
 */
export async function verifyAuth(req: Request): Promise<AuthResult | AuthError> {
  const authHeader = req.headers.get("Authorization");
  
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      error: new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  const token = authHeader.replace("Bearer ", "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  
  // Create a client with the user's token to verify it
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      error: new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  return { userId: user.id };
}

/**
 * Verifies that the authenticated user owns the specified doctor profile.
 */
export async function verifyDoctorOwnership(
  userId: string,
  doctorId: string
): Promise<{ isOwner: boolean; error?: Response }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: doctor } = await supabase
    .from("doctor")
    .select("id")
    .eq("id", doctorId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!doctor) {
    return {
      isOwner: false,
      error: new Response(
        JSON.stringify({ error: "Forbidden: You don't have access to this doctor profile" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  return { isOwner: true };
}

/**
 * Verifies that the authenticated user owns the doctor associated with an appointment.
 */
export async function verifyAppointmentOwnership(
  userId: string,
  appointmentId: string
): Promise<{ isOwner: boolean; doctorId?: string; error?: Response }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: appointment } = await supabase
    .from("appointments")
    .select("doctor_id")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) {
    return {
      isOwner: false,
      error: new Response(
        JSON.stringify({ error: "Appointment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  const { isOwner, error } = await verifyDoctorOwnership(userId, appointment.doctor_id);
  return { isOwner, doctorId: appointment.doctor_id, error };
}
