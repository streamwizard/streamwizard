import { Hono } from "hono";
import { z } from "zod";
import { ChannelType, PermissionFlagsBits, type GuildBasedChannel, type NewsChannel, type TextChannel } from "discord.js";
import { parseBuiltMessage } from "@repo/discord-message";
import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { deleteBuiltMessage, getBuiltMessage, recordBuiltMessagePublication } from "@repo/supabase/queries/discord-built-messages";
import {
  BuiltMessageError,
  BuiltMessageSendError,
  guildVariableValues,
  publishBuiltMessage,
} from "../../lib/built-message";
import { env } from "../../lib/env";
import type { AppEnv } from "../types";
import { readJson, snowflake } from "../validation";

export const builtMessageRoutes = new Hono<AppEnv>();

// One publish or delete per message at a time, keyed `guildId:messageId`.
const publishing = new Set<string>();

const isMessageChannel = (channel: GuildBasedChannel | null): channel is TextChannel | NewsChannel =>
  channel?.type === ChannelType.GuildText || channel?.type === ChannelType.GuildAnnouncement;

const PUBLISH_PERMISSIONS = [
  [PermissionFlagsBits.ViewChannel, "View Channel"],
  [PermissionFlagsBits.SendMessages, "Send Messages"],
  [PermissionFlagsBits.EmbedLinks, "Embed Links"],
  [PermissionFlagsBits.AttachFiles, "Attach Files"],
] as const;

// Publishes a message from web-admin's message builder: sends the saved
// draft to `channelId`, or updates what an earlier publish left there. Owns
// published, channel_id and message_ids, like the ticket panel owns its
// location. Placeholders are filled from the guild only; these are standing
// messages with no member in context.
builtMessageRoutes.post("/built-messages/:id/publish", async (c) => {
  const body = z.object({ channelId: snowflake }).safeParse(await readJson(c));
  const id = z.string().uuid().safeParse(c.req.param("id"));
  if (!body.success || !id.success) return c.json({ error: "Invalid body" }, 400);

  const guild = c.get("guild");
  const row = await getBuiltMessage(supabase, guild.id, id.data);
  const message = parseBuiltMessage(row?.draft);
  if (!row || !message) return c.json({ error: "There's no saved message to publish yet" }, 404);

  const channel = await guild.channels.fetch(body.data.channelId).catch(() => null);
  if (!isMessageChannel(channel)) return c.json({ error: "That channel is gone, or it isn't a text channel" }, 409);
  const permissions = guild.members.me ? channel.permissionsFor(guild.members.me) : null;
  const missing = PUBLISH_PERMISSIONS.filter(([flag]) => !permissions?.has(flag)).map(([, name]) => name);
  if (missing.length > 0) {
    return c.json({ error: `The bot is missing ${missing.join(", ")} in #${channel.name}` }, 409);
  }

  // Two publishes at once would both see the old ids and post twice.
  const lock = `${guild.id}:${id.data}`;
  if (publishing.has(lock)) return c.json({ error: "A publish is already running. Give it a moment." }, 409);
  publishing.add(lock);
  try {
    const previousChannel =
      row.channel_id === channel.id ? channel : row.channel_id ? await guild.channels.fetch(row.channel_id).catch(() => null) : null;
    const { messageIds } = await publishBuiltMessage({
      channel,
      message,
      values: guildVariableValues(guild),
      previous: {
        channel: isMessageChannel(previousChannel) ? previousChannel : null,
        messageIds: row.message_ids,
      },
      allowedUploadBase: env.NEXT_PUBLIC_CDN_URL,
    });
    await recordBuiltMessagePublication(supabase, guild.id, id.data, {
      published: message,
      channel_id: channel.id,
      message_ids: messageIds,
    });
    return c.json({ ok: true, channelId: channel.id, messageIds });
  } catch (error) {
    if (error instanceof BuiltMessageError) return c.json({ error: error.message, issues: error.issues }, 422);
    if (error instanceof BuiltMessageSendError) {
      // Remember what made it into the channel so the next publish updates it instead of doubling up.
      await recordBuiltMessagePublication(supabase, guild.id, id.data, {
        published: message,
        channel_id: channel.id,
        message_ids: error.messageIds,
      }).catch((e) => reportError(e, "discord-bot built-message: record partial", { guildId: guild.id }));
      reportError(error.cause, "discord-bot built-message: publish", { guildId: guild.id, messageId: id.data });
      return c.json({ error: "Discord rejected part of the message. Publish again to finish it." }, 502);
    }
    throw error;
  } finally {
    publishing.delete(lock);
  }
});

// Deleting a message in the dashboard takes it out of Discord too. Messages
// a mod already removed, or a channel that is gone, don't stand in the way.
builtMessageRoutes.post("/built-messages/:id/delete", async (c) => {
  const id = z.string().uuid().safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "Invalid body" }, 400);

  const guild = c.get("guild");
  const row = await getBuiltMessage(supabase, guild.id, id.data);
  if (!row) return c.json({ ok: true });

  const lock = `${guild.id}:${id.data}`;
  if (publishing.has(lock)) return c.json({ error: "A publish is running. Give it a moment." }, 409);
  publishing.add(lock);
  try {
    const channel = row.channel_id ? await guild.channels.fetch(row.channel_id).catch(() => null) : null;
    if (isMessageChannel(channel)) {
      for (const messageId of row.message_ids) {
        try {
          await channel.messages.delete(messageId);
        } catch (error) {
          if ((error as { code?: unknown } | null)?.code === 10008) continue; // Unknown Message: already gone
          reportError(error, "discord-bot built-message: delete", { guildId: guild.id, messageId: id.data });
          return c.json({ error: `The bot couldn't remove the message from #${channel.name}. Check its permissions there.` }, 409);
        }
      }
    }
    await deleteBuiltMessage(supabase, guild.id, id.data);
    return c.json({ ok: true });
  } finally {
    publishing.delete(lock);
  }
});
