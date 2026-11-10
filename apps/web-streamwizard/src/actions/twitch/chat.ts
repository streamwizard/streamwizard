"use server";

import { TwitchApi } from "@repo/twitch-api";
import { track } from "@/lib/tracking/track";
import { reportError } from "@repo/sentry";
import { tryAuthContext } from "@/lib/auth";
import { deckChatMessageSchema } from "@/schemas/twitch";

/**
 * Sending chat from the deck, always as the broadcaster — the deck is the
 * streamer's own phone, so a message typed there reads as them. Speaking as
 * the bot is the bot's own job and not something this surface offers.
 */

interface SendDeckChatResult {
  ok: boolean;
  /** Helix's id for the sent message; the socket echo arrives under the same id. */
  messageId?: string;
  error?: string;
}

export async function sendDeckChatMessage(
  message: string,
  opts: { replyToMessageId?: string | null } = {},
): Promise<SendDeckChatResult> {
  const ctx = await tryAuthContext();
  if (!ctx) return { ok: false, error: "Not signed in" };
  const parsed = deckChatMessageSchema.safeParse({ message, replyToMessageId: opts.replyToMessageId });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Couldn't send that message" };

  try {
    const api = new TwitchApi(ctx.broadcasterId);
    const response = await api.chat.sendMessage({
      message: parsed.data.message,
      sender: "broadcaster",
      replyToMessageId: parsed.data.replyToMessageId ?? null,
    });

    // Twitch answers 200 with is_sent:false when AutoMod holds a message, so a
    // successful HTTP call is not on its own proof that chat saw anything.
    const sent = response?.data?.[0];
    if (sent && sent.is_sent === false) {
      return {
        ok: false,
        error: sent.drop_reason?.message ?? "Twitch held that message back",
      };
    }

    await track("deck_chat_sent", {}, ctx.user);
    return { ok: true, messageId: sent?.message_id };
  } catch (error) {
    reportError(error, "sendDeckChatMessage");
    return { ok: false, error: "Couldn't send that message" };
  }
}
