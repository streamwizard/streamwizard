import { supabase } from "@repo/supabase";
import axios from "axios";

// Posts twitch.token_refresh_failed to the Discord log channel (SW-334) when a
// user's refresh token is dead, so support sees it before the user does.
// Deduplicated per user in SQL (emit_twitch_token_refresh_failed, 6 hours).

const ERROR_MAX = 500;

/** Twitch answered 400/401 (invalid_grant: revoked, password changed), or there's no refresh token at all. */
function isPermanent(error: unknown, status: number | null): boolean {
  if (status === 400 || status === 401) return true;
  return error instanceof Error && /No refresh token/i.test(error.message);
}

function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { message?: string; error?: string } | undefined;
    if (body?.message) return body.message;
    if (body?.error) return body.error;
  }
  return error instanceof Error ? error.message : String(error);
}

/** Never throws, never awaited by the caller: a log row must not change how the refresh fails. */
export async function logTokenRefreshFailure(broadcasterId: string, error: unknown): Promise<void> {
  try {
    const status = axios.isAxiosError(error) ? (error.response?.status ?? null) : null;
    if (!isPermanent(error, status)) return;

    const { error: rpcError } = await supabase.rpc("emit_twitch_token_refresh_failed", {
      p_twitch_user_id: broadcasterId,
      p_error: errorMessage(error).slice(0, ERROR_MAX),
      p_status: status ?? undefined,
    });
    if (rpcError) throw rpcError;
  } catch (logError) {
    console.error("❌ Couldn't log the token refresh failure:", logError);
  }
}
