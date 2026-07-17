import { supabase } from "@repo/supabase";
import { getTwitchUserIdByUserIdMaybe } from "@repo/supabase/queries/user";
import { TwitchApi } from "@repo/twitch-api";

// Chat notices ride the app token + the StreamWizard bot sender (see
// packages/twitch-api/src/chat.ts) — works in any channel where the bot is
// authorized, no per-user token. Failures are soft: a chat hiccup must never
// affect switching.

const RATE_LIMIT_MS = 30_000;

const broadcasterIdCache = new Map<string, string | null>();
const lastSentAt = new Map<string, number>();

export interface ChatTemplateVars {
  bitrate?: number;
  rtt?: number;
  loss?: number;
  scene?: string;
}

export function renderChatTemplate(
  template: string,
  vars: ChatTemplateVars,
): string {
  return template
    .replaceAll(
      "{bitrate}",
      vars.bitrate !== undefined ? String(Math.round(vars.bitrate)) : "?",
    )
    .replaceAll(
      "{rtt}",
      vars.rtt !== undefined ? String(Math.round(vars.rtt)) : "?",
    )
    .replaceAll("{loss}", vars.loss !== undefined ? vars.loss.toFixed(1) : "?")
    .replaceAll("{scene}", vars.scene ?? "?");
}

async function getBroadcasterId(userId: string): Promise<string | null> {
  if (broadcasterIdCache.has(userId))
    return broadcasterIdCache.get(userId) ?? null;
  const broadcasterId = await getTwitchUserIdByUserIdMaybe(supabase, userId);
  broadcasterIdCache.set(userId, broadcasterId);
  return broadcasterId;
}

/** Sends a chat notice; silently no-ops without a Twitch link or inside the per-user rate limit. */
export async function sendChatNotice(
  userId: string,
  template: string,
  vars: ChatTemplateVars,
): Promise<void> {
  const now = Date.now();
  const last = lastSentAt.get(userId) ?? 0;
  if (now - last < RATE_LIMIT_MS) return;

  try {
    const broadcasterId = await getBroadcasterId(userId);
    if (!broadcasterId) return;

    lastSentAt.set(userId, now);
    await new TwitchApi(broadcasterId).chat.sendMessage({
      message: renderChatTemplate(template, vars),
      sender: "broadcaster",
    });
  } catch (err) {
    console.warn(
      `[chat] notice failed user=${userId}:`,
      (err as Error).message,
    );
  }
}
