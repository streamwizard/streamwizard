import type { ChannelChatMessageEvent, ChannelChatNotificationEvent } from "@repo/schemas";
import { chatNoticeKind, type ChatWidgetItemConfig } from "./chat-widget-config";

/**
 * The chat box's buffer: which lines are on screen, folded from socket frames.
 *
 * Deliberately not the deck's reducer. The deck is a moderation surface, so a
 * deleted message stays as a struck-through row and a timeout leaves a note.
 * On stream a removed message should simply be gone, which is the whole
 * behaviour here.
 */

export type ChatWidgetRow =
  | { kind: "message"; id: string; at: number; chatterId: string; message: ChannelChatMessageEvent }
  | {
      kind: "notice";
      id: string;
      at: number;
      chatterId: string;
      notification: ChannelChatNotificationEvent;
    };

export interface ChatWidgetFrame {
  type?: string;
  payload?: unknown;
}

/** The filter half of the config; rows already on screen don't re-check it. */
export type ChatWidgetFeedOptions = Pick<
  ChatWidgetItemConfig,
  "maxMessages" | "hiddenUsers" | "hideCommands" | "showGifs" | "notices"
>;

/** Every type the reducer reacts to, e.g. for a ws `channels` filter. */
export const CHAT_WIDGET_FRAME_TYPES = [
  "channel.chat.message",
  "channel.chat.notification",
  "channel.chat.message_delete",
  "channel.chat.clear",
  "channel.chat.clear_user_messages",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasFragments(value: unknown): boolean {
  return isRecord(value) && Array.isArray(value.fragments);
}

/** Whether a chat message passes the streamer's hide rules. */
export function chatWidgetShowsMessage(
  message: Pick<ChannelChatMessageEvent, "chatter_user_login" | "message">,
  options: Pick<ChatWidgetFeedOptions, "hiddenUsers" | "hideCommands" | "showGifs">,
): boolean {
  const login = message.chatter_user_login?.toLowerCase() ?? "";
  if (options.hiddenUsers.includes(login)) return false;
  if (options.hideCommands && message.message.text.trimStart().startsWith("!")) return false;
  // A GIF is the whole message, so hiding the GIF means hiding the line.
  if (!options.showGifs && message.message.fragments.some((f) => f.type === "gif")) return false;
  return true;
}

function append(rows: ChatWidgetRow[], row: ChatWidgetRow, max: number): ChatWidgetRow[] {
  // A Live test and a real echo never share an id, but a reconnect can replay.
  if (rows.some((existing) => existing.id === row.id)) return rows;
  const next = [...rows, row];
  return next.length > max ? next.slice(next.length - max) : next;
}

/**
 * Folds one socket frame into the rows. Returns the same array when nothing
 * changed, so ignored frames (alerts, geo, anything else in the room) cost no
 * re-render.
 */
export function applyChatWidgetFrame(
  rows: ChatWidgetRow[],
  frame: ChatWidgetFrame,
  options: ChatWidgetFeedOptions,
  now: number,
): ChatWidgetRow[] {
  const payload = frame.payload;
  if (!isRecord(payload)) return rows;

  switch (frame.type) {
    case "channel.chat.message": {
      if (typeof payload.message_id !== "string" || !hasFragments(payload.message)) return rows;
      const message = payload as unknown as ChannelChatMessageEvent;
      if (typeof message.message.text !== "string") return rows;
      if (!chatWidgetShowsMessage(message, options)) return rows;
      return append(
        rows,
        {
          kind: "message",
          id: message.message_id,
          at: now,
          chatterId: String(message.chatter_user_id ?? ""),
          message,
        },
        options.maxMessages,
      );
    }

    case "channel.chat.notification": {
      if (typeof payload.message_id !== "string" || typeof payload.notice_type !== "string") {
        return rows;
      }
      const notification = payload as unknown as ChannelChatNotificationEvent;
      const kind = chatNoticeKind(notification.notice_type);
      if (!kind || !options.notices[kind]) return rows;
      // Bots post announcements too; a hidden bot stays hidden there.
      const login = notification.chatter_user_login?.toLowerCase() ?? "";
      if (options.hiddenUsers.includes(login)) return rows;
      return append(
        rows,
        {
          kind: "notice",
          id: notification.message_id,
          at: now,
          chatterId: String(notification.chatter_user_id ?? ""),
          notification,
        },
        options.maxMessages,
      );
    }

    case "channel.chat.message_delete": {
      const id = payload.message_id;
      if (typeof id !== "string") return rows;
      const next = rows.filter((row) => row.id !== id);
      return next.length === rows.length ? rows : next;
    }

    case "channel.chat.clear_user_messages": {
      const userId = payload.target_user_id;
      if (typeof userId !== "string") return rows;
      const next = rows.filter((row) => row.chatterId !== userId);
      return next.length === rows.length ? rows : next;
    }

    case "channel.chat.clear":
      return rows.length === 0 ? rows : [];

    default:
      return rows;
  }
}

/** Drops rows older than the fade window. 0 keeps everything. */
export function pruneChatWidgetRows(
  rows: ChatWidgetRow[],
  now: number,
  fadeAfterSeconds: number,
): ChatWidgetRow[] {
  if (fadeAfterSeconds <= 0 || rows.length === 0) return rows;
  const cutoff = now - fadeAfterSeconds * 1000;
  const next = rows.filter((row) => row.at > cutoff);
  return next.length === rows.length ? rows : next;
}

/** Re-applies the cap after the streamer lowers it mid-session. */
export function capChatWidgetRows(rows: ChatWidgetRow[], max: number): ChatWidgetRow[] {
  return rows.length > max ? rows.slice(rows.length - max) : rows;
}
