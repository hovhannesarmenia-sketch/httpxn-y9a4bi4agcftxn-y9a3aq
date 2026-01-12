/**
 * Shared input validation utilities for edge functions.
 * Uses native regex-based validation to avoid external dependencies.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// UUID v4 regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
  response?: Response;
}

/**
 * Validates a UUID string
 */
export function isValidUUID(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

/**
 * Validates a string with max length
 */
export function isValidString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length <= maxLength;
}

/**
 * Validates action enum values
 */
export function isValidAction(value: unknown, allowedValues: string[]): boolean {
  return typeof value === "string" && allowedValues.includes(value);
}

/**
 * Creates a validation error response
 */
export function validationErrorResponse(errors: ValidationError[]): Response {
  return new Response(
    JSON.stringify({ error: "Invalid input", details: errors }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * Validates doctor-related requests (doctorId required)
 */
export function validateDoctorRequest(body: unknown): ValidationResult<{ doctorId: string }> {
  const errors: ValidationError[] = [];
  
  if (!body || typeof body !== "object") {
    errors.push({ field: "body", message: "Request body is required" });
    return { success: false, errors, response: validationErrorResponse(errors) };
  }

  const { doctorId } = body as { doctorId?: unknown };

  if (!doctorId) {
    errors.push({ field: "doctorId", message: "doctorId is required" });
  } else if (!isValidUUID(doctorId)) {
    errors.push({ field: "doctorId", message: "doctorId must be a valid UUID" });
  }

  if (errors.length > 0) {
    return { success: false, errors, response: validationErrorResponse(errors) };
  }

  return { success: true, data: { doctorId: doctorId as string } };
}

/**
 * Validates appointment-related requests (appointmentId required)
 */
export function validateAppointmentRequest(body: unknown): ValidationResult<{ 
  appointmentId: string; 
  action?: "create" | "delete" | "log";
  reason?: string;
}> {
  const errors: ValidationError[] = [];
  
  if (!body || typeof body !== "object") {
    errors.push({ field: "body", message: "Request body is required" });
    return { success: false, errors, response: validationErrorResponse(errors) };
  }

  const { appointmentId, action, reason } = body as { 
    appointmentId?: unknown; 
    action?: unknown;
    reason?: unknown;
  };

  if (!appointmentId) {
    errors.push({ field: "appointmentId", message: "appointmentId is required" });
  } else if (!isValidUUID(appointmentId)) {
    errors.push({ field: "appointmentId", message: "appointmentId must be a valid UUID" });
  }

  if (action !== undefined) {
    const allowedActions = ["create", "delete", "log"];
    if (!isValidAction(action, allowedActions)) {
      errors.push({ field: "action", message: `action must be one of: ${allowedActions.join(", ")}` });
    }
  }

  if (reason !== undefined) {
    if (!isValidString(reason, 500)) {
      errors.push({ field: "reason", message: "reason must be a string with max 500 characters" });
    }
  }

  if (errors.length > 0) {
    return { success: false, errors, response: validationErrorResponse(errors) };
  }

  return { 
    success: true, 
    data: { 
      appointmentId: appointmentId as string,
      action: action as "create" | "delete" | "log" | undefined,
      reason: reason as string | undefined,
    } 
  };
}

/**
 * Validates cancellation requests
 */
export function validateCancellationRequest(body: unknown): ValidationResult<{
  appointmentId: string;
  reason?: string;
}> {
  const errors: ValidationError[] = [];
  
  if (!body || typeof body !== "object") {
    errors.push({ field: "body", message: "Request body is required" });
    return { success: false, errors, response: validationErrorResponse(errors) };
  }

  const { appointmentId, reason } = body as { appointmentId?: unknown; reason?: unknown };

  if (!appointmentId) {
    errors.push({ field: "appointmentId", message: "appointmentId is required" });
  } else if (!isValidUUID(appointmentId)) {
    errors.push({ field: "appointmentId", message: "appointmentId must be a valid UUID" });
  }

  if (reason !== undefined && reason !== null) {
    if (!isValidString(reason, 500)) {
      errors.push({ field: "reason", message: "reason must be a string with max 500 characters" });
    }
  }

  if (errors.length > 0) {
    return { success: false, errors, response: validationErrorResponse(errors) };
  }

  return { 
    success: true, 
    data: { 
      appointmentId: appointmentId as string,
      reason: reason as string | undefined,
    } 
  };
}
