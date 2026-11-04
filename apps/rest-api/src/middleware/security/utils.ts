// middleware/security/utils.ts
import type { Context, Next } from "hono";
import { createHash } from "crypto";
import { supabase } from "@repo/supabase";

/**
 * Security Event Metadata Interface
 */
export interface SecurityEventMetadata {
  ip?: string;
  client_ip?: string;
  origin?: string;
  attempts?: number;
  blocked_until?: string;
  endpoint?: string;
  request_id?: string;
  error_message?: string;
  [key: string]: any;
}

/**
 * Log Security Event
 *
 * Logs security events for monitoring and compliance.
 * Handles errors gracefully to prevent logging failures from breaking the application.
 */
export async function logSecurityEvent(
  eventType: string,
  metadata: SecurityEventMetadata,
): Promise<void> {
  try {
    // TODO: Uncomment when audit_logs table is added to Supabase
    /*
    await supabase.from("audit_logs").insert({
      event_type: eventType,
      user_id: null, // Security events are system-level
      metadata: metadata as any,
      ip_address: metadata.ip || metadata.client_ip,
      created_at: new Date().toISOString()
    });
    */
    console.log(`[Security Event] ${eventType}:`, metadata);
  } catch (error) {
    // Don't let logging errors break the application
    console.error("Failed to log security event:", error);
  }
}

/**
 * Request ID Middleware
 *
 * Generates a unique request ID for each request to aid in debugging and tracing.
 */
export function requestId() {
  return async (c: Context, next: Next) => {
    const reqId = createHash("sha256")
      .update(`${Date.now()}-${Math.random()}`)
      .digest("hex")
      .substring(0, 16);

    c.set("requestId", reqId);
    c.header("X-Request-ID", reqId);

    await next();
  };
}
