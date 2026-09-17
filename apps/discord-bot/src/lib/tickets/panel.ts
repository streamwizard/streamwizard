import type { Guild, SendableChannels } from "discord.js";
import { parseTicketPanel } from "@repo/discord-message";
import type { DiscordTicketSettings } from "@repo/supabase/queries/tickets";
import { guildVariableValues, publishBuiltMessage, type BuiltMessageChannel } from "../built-message";
import { env } from "../env";
import { activeCategories, getTicketConfig } from "./config";
import { panelRows } from "./panel-rows";

// The panel members open tickets from: the message an admin designed in
// web-admin, with the bot's own Create Ticket controls underneath.

type PanelLocation = Pick<DiscordTicketSettings, "panel_channel_id" | "panel_message_id" | "panel_message_ids">;

/** Every message of a posted panel. Panels from before they could span messages only have panel_message_id. */
const panelMessageIds = (location: PanelLocation | null): string[] => {
  if (!location) return [];
  if (location.panel_message_ids.length > 0) return location.panel_message_ids;
  return location.panel_message_id ? [location.panel_message_id] : [];
};

const asMessageChannel = (channel: unknown): BuiltMessageChannel | null =>
  channel && typeof channel === "object" && "messages" in channel && "send" in channel
    ? (channel as BuiltMessageChannel)
    : null;

// Removes a previously posted panel. Errors are swallowed: the messages or
// their channel may already be gone.
export async function deleteTicketPanel(guild: Guild, previous: PanelLocation | null): Promise<void> {
  if (!previous?.panel_channel_id) return;
  const oldChannel = await guild.channels.fetch(previous.panel_channel_id).catch(() => null);
  if (!oldChannel?.isTextBased()) return;
  for (const id of panelMessageIds(previous)) await oldChannel.messages.delete(id).catch(() => {});
}

export interface PostedPanel {
  /** Top to bottom. */
  messageIds: string[];
  /** The message carrying the Create Ticket controls: the last one. */
  controlsMessageId: string | null;
}

/** What to store after a post, so the next one finds every message of this panel. */
export const panelLocation = (channelId: string, posted: PostedPanel) => ({
  panel_channel_id: channelId,
  panel_message_id: posted.controlsMessageId,
  panel_message_ids: posted.messageIds,
});

export const NO_PANEL = { panel_channel_id: null, panel_message_id: null, panel_message_ids: [] };

/**
 * Posts the panel, or brings the one already there in line with the current
 * design and categories: same channel edits in place, another channel posts
 * fresh and removes the old one. Throws BuiltMessageError when the design
 * can't be sent; the message is written for the admin.
 */
export async function postTicketPanel(
  guild: Guild,
  channel: SendableChannels,
  previous: PanelLocation | null,
): Promise<PostedPanel> {
  const config = await getTicketConfig(guild.id);
  const panel = parseTicketPanel(config.settings?.panel);

  const previousChannel = previous?.panel_channel_id
    ? previous.panel_channel_id === channel.id
      ? channel
      : await guild.channels.fetch(previous.panel_channel_id).catch(() => null)
    : null;

  const { messageIds } = await publishBuiltMessage({
    channel: channel as unknown as BuiltMessageChannel,
    message: panel.message,
    values: guildVariableValues(guild),
    previous: { channel: asMessageChannel(previousChannel), messageIds: panelMessageIds(previous) },
    extraRows: panelRows(panel, activeCategories(config)),
    allowedUploadBase: env.NEXT_PUBLIC_CDN_URL,
  });
  return { messageIds, controlsMessageId: messageIds.at(-1) ?? null };
}
