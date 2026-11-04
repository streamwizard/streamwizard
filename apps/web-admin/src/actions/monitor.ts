"use server";

import { hasServiceSigningKey, signServiceToken } from "@repo/service-token";
import { reportError } from "@repo/sentry";
import { assertAdmin } from "@/lib/assert-admin";

/**
 * A 60-second service token (scope `monitor`) for one dial of ws-server's
 * monitor socket. Same admin check as the monitor pages; the signing key
 * (WS_SERVICE_SIGNING_JWK) never leaves the server. Clients call this right
 * before every connect and reconnect (lib/monitor-token.ts) and never keep
 * the token.
 */
export async function mintMonitorTokenAction(): Promise<{ data: { token: string } | null; error: string | null }> {
  try {
    await assertAdmin();
  } catch {
    return { data: null, error: "Forbidden" };
  }
  if (!hasServiceSigningKey()) return { data: null, error: "The live monitor isn't set up here." };

  try {
    return { data: { token: await signServiceToken("monitor") }, error: null };
  } catch (err) {
    reportError(err, "monitor-token");
    return { data: null, error: "Couldn't authorize this request." };
  }
}
