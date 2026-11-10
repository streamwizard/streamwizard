import { hasServiceSigningKey } from "@repo/service-token";
import { env } from "@/lib/env";

/**
 * The ws-server URL the monitor pages dial, or null when this environment
 * can't run the live monitor (no ws-server URL, or no service signing key
 * for mintMonitorTokenAction). Server-only: pages pass the result to their
 * client providers.
 */
export function monitorWsUrl(): string | null {
  return env.NEXT_PUBLIC_WS_SERVER_URL && hasServiceSigningKey() ? env.NEXT_PUBLIC_WS_SERVER_URL : null;
}
