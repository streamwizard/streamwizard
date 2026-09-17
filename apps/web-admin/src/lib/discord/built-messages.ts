import { MESSAGE_PRESETS, SERVER_VARIABLES, type BuiltMessage, type ValidateOptions } from "@repo/discord-message";
import type { ChannelKind } from "./channel-kind";

// What the Messages pages share: a server builds as many messages as it likes
// and posts each in a channel of its choice. Safe to import from client
// components: data only.

export const MESSAGE_NAME_MAX = 60;

/** Where a built message can go. */
export const MESSAGE_CHANNEL_KINDS: ChannelKind[] = ["text", "announcement"];

export const MESSAGE_BUILDER_PRESETS = MESSAGE_PRESETS;

// A standing message has no member in context, so only server values.
export const MESSAGE_VARIABLES = SERVER_VARIABLES;

/** The same checks the builder shows, for the Publish button and the publish action. */
export const MESSAGE_VALIDATE_OPTIONS: ValidateOptions = {
  allowedVariables: MESSAGE_VARIABLES.map((v) => v.key),
};

/** Channel name for "Create a channel for me", from the message's name: "Server rules" gives "server-rules". */
export function channelNameFor(messageName: string): string {
  const slug = messageName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return slug || "messages";
}

export type BuiltMessageStatus = "draft" | "live" | "changed";

/** Draft: never published. Changed: what's in Discord is older than what's saved here. */
export function builtMessageStatus(row: {
  draft: BuiltMessage | null;
  published: BuiltMessage | null;
  draftChannelId: string | null;
  createChannel: boolean;
  channelId: string | null;
}): BuiltMessageStatus {
  if (!row.published) return "draft";
  const same =
    !row.createChannel && row.channelId === row.draftChannelId && JSON.stringify(row.published) === JSON.stringify(row.draft);
  return same ? "live" : "changed";
}
