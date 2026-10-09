import { trackServer } from "@repo/posthog/server";
import { reportError } from "@repo/sentry";
import { resolveUserId } from "./resolveUserId";

/*
 * Counts chat commands the bot answered, per channel.
 *
 * Chat is the one place where an event per use would be a mistake: a popular
 * command in a busy channel fires hundreds of times an hour. So uses are
 * added up and sent as one event per channel and command every five minutes,
 * carrying the count. The totals stay exact; only the timing is coarse.
 *
 * Filed under the channel owner's account. Nothing about who typed it.
 */

export type ChatCommandType = "custom" | "default";

const WINDOW_MS = 5 * 60 * 1000;
// Far more open windows than channels x commands will ever need. Past it,
// something is feeding this garbage and the oldest window is sent early.
const MAX_OPEN_WINDOWS = 5000;

interface Window {
  broadcasterId: string;
  commandType: ChatCommandType;
  command: string | null;
  count: number;
  sendAt: number;
}

export function createChatCommandCounter(options: {
  send: (window: Window) => void | Promise<void>;
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
  const open = new Map<string, Window>();

  async function close(key: string) {
    const window = open.get(key);
    if (!window) return;
    open.delete(key);
    await options.send(window);
  }

  return {
    /**
     * `command` is kept for our own default commands only. A custom command's
     * name is something the streamer typed, and there is no end to them.
     */
    record(broadcasterId: string, commandType: ChatCommandType, command: string) {
      const name = commandType === "default" ? command : null;
      const key = `${broadcasterId} ${commandType} ${name ?? ""}`;
      const existing = open.get(key);
      if (existing) {
        existing.count++;
        return;
      }
      if (open.size >= MAX_OPEN_WINDOWS) {
        const oldest = open.keys().next();
        if (!oldest.done) void close(oldest.value);
      }
      open.set(key, { broadcasterId, commandType, command: name, count: 1, sendAt: now() + WINDOW_MS });
    },
    /** Sends every window whose five minutes are up; all of them when `everything` is set. */
    async flush(everything = false) {
      const due = [...open].filter(([, window]) => everything || window.sendAt <= now()).map(([key]) => key);
      for (const key of due) await close(key);
    },
    get openWindows() {
      return open.size;
    },
  };
}

const counter = createChatCommandCounter({
  async send(window) {
    try {
      const userId = await resolveUserId(window.broadcasterId);
      if (!userId) return;
      // No browser is behind a chat command, so PostHog files these under
      // "Automation"; charts on them must not use the bot filter.
      trackServer(userId, "chat_command_used", {
        command_type: window.commandType,
        ...(window.command ? { command: window.command } : {}),
        count: window.count,
      });
    } catch (error) {
      reportError(error, "chat-command.tracking", { broadcaster_user_id: window.broadcasterId });
    }
  },
});

// One timer for the whole process, not one per window. unref'd: it must
// never be what keeps the bot alive.
setInterval(() => void counter.flush(), 60_000).unref?.();

export function recordChatCommand(broadcasterId: string, commandType: ChatCommandType, command: string): void {
  counter.record(broadcasterId, commandType, command);
}

/** For shutdown: send what has been counted so far, or it is lost with the process. */
export function flushChatCommands(): Promise<void> {
  return counter.flush(true);
}
