"use server";

import { hasServiceSigningKey, signServiceToken } from "@repo/service-token";
import { toDataError, type DataResult } from "@/lib/actions/action-error";
import { FORBIDDEN, requireAdmin } from "@/lib/auth/admin-context";

/**
 * A 60-second service token (scope `monitor`) for one dial of ws-server's
 * monitor socket. Same admin check as the monitor pages; the signing key
 * (WS_SERVICE_SIGNING_JWK) never leaves the server. Clients call this right
 * before every connect and reconnect (lib/monitor/monitor-socket.ts) and
 * never keep the token.
 */
export async function mintMonitorTokenAction(): Promise<DataResult<{ token: string }>> {
  try {
    await requireAdmin();
  } catch {
    return { data: null, error: FORBIDDEN };
  }
  if (!hasServiceSigningKey()) return { data: null, error: "The live monitor isn't set up here." };

  try {
    return { data: { token: await signServiceToken("monitor") }, error: null };
  } catch (err) {
    return toDataError(err, "monitor-token.sign", "Couldn't authorize this request.");
  }
}
