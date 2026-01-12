// Centralized error sanitization utility
// Prevents internal error details from being exposed to clients

export interface SafeError {
  message: string;
  status: number;
}

/**
 * Sanitizes error messages for safe client-side consumption.
 * Logs the full error server-side while returning a generic message to clients.
 */
export function sanitizeError(error: unknown, context?: string): SafeError {
  // Always log the full error server-side for debugging
  console.error(`[${context || 'Error'}]:`, error);
  
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    
    // Database errors - don't reveal column names or constraints
    if (msg.includes('not found') || msg.includes('does not exist')) {
      return { message: 'Resource not found', status: 404 };
    }
    if (msg.includes('permission') || msg.includes('forbidden') || msg.includes('unauthorized')) {
      return { message: 'Access denied', status: 403 };
    }
    if (msg.includes('duplicate') || msg.includes('unique constraint') || 
        msg.includes('violates') || msg.includes('invalid input syntax')) {
      return { message: 'Invalid request data', status: 400 };
    }
    if (msg.includes('foreign key')) {
      return { message: 'Invalid reference in request', status: 400 };
    }
    
    // External API errors - don't reveal integration details
    if (msg.includes('telegram') || msg.includes('google') || 
        msg.includes('api') || msg.includes('oauth') || msg.includes('token')) {
      return { message: 'External service unavailable', status: 503 };
    }
    
    // Network/timeout errors
    if (msg.includes('timeout') || msg.includes('network') || msg.includes('fetch')) {
      return { message: 'Service temporarily unavailable', status: 503 };
    }
    
    // JSON parsing errors
    if (msg.includes('json') || msg.includes('parse') || msg.includes('syntax')) {
      return { message: 'Invalid request format', status: 400 };
    }
  }
  
  // Default: generic error message
  return { message: 'An error occurred', status: 500 };
}

/**
 * Creates a standardized error response with CORS headers.
 */
export function createErrorResponse(
  error: unknown, 
  context: string,
  corsHeaders: Record<string, string>
): Response {
  const safeError = sanitizeError(error, context);
  return new Response(
    JSON.stringify({ error: safeError.message }), 
    {
      status: safeError.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
