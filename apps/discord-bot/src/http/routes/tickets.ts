import { Hono } from "hono";
import { z } from "zod";
import { ChannelType, EmbedBuilder, type Guild } from "discord.js";
import { supabase } from "@repo/supabase";
import { getTicketByChannelId, getTicketSettings, upsertTicketSettings } from "@repo/supabase/queries/tickets";
import { TWITCH_PURPLE } from "../../lib/branding";
import {
  CLOSE_RESULT_MESSAGES,
  claimTicketAs,
  closeTicketChannel,
  deleteTicketPanel,
  logTicketReply,
  postTicketPanel,
} from "../../lib/tickets";
import type { AppEnv } from "../types";
import { readJson, snowflake } from "../validation";

export const ticketRoutes = new Hono<AppEnv>();

// Owns panel_channel_id + panel_message_id so the stored location always
// matches Discord. `channelId` moves the panel (null removes it); omitted,
// the panel is re-posted where it is. The old message is found through the
// stored location, so callers must not write panel_channel_id themselves.
ticketRoutes.post("/ticket-panel", async (c) => {
  const body = z.object({ channelId: snowflake.nullable().optional() }).safeParse(await readJson(c, {}));
  if (!body.success) return c.json({ error: "Invalid body" }, 400);

  const guild = c.get("guild");
  const settings = await getTicketSettings(supabase, guild.id);
  const targetChannelId = body.data.channelId === undefined ? settings?.panel_channel_id : body.data.channelId;

  if (!targetChannelId) {
    await deleteTicketPanel(guild, settings);
    await upsertTicketSettings(supabase, guild.id, { panel_channel_id: null, panel_message_id: null });
    return c.json({ ok: true, channelId: null, messageId: null });
  }

  const channel = await guild.channels.fetch(targetChannelId).catch(() => null);
  if (!channel?.isSendable()) {
    return c.json({ error: "The panel channel is gone or the bot can't post in it" }, 409);
  }

  const panelMessageId = await postTicketPanel(guild, channel, settings);
  await upsertTicketSettings(supabase, guild.id, { panel_channel_id: channel.id, panel_message_id: panelMessageId });
  return c.json({ ok: true, channelId: channel.id, messageId: panelMessageId });
});

// Claim or close a ticket from the dashboard, acting as the admin's linked
// Discord account. web-admin has already checked they're an admin.
const ticketAction = z.object({ discordUserId: snowflake });

async function resolveTicketActor(guild: Guild, channelId: string, body: unknown) {
  const parsed = ticketAction.safeParse(body);
  if (!parsed.success) return { error: "Invalid body", status: 400 as const };
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (channel?.type !== ChannelType.GuildText) return { error: "The ticket channel is gone", status: 404 as const };
  const member = await guild.members.fetch(parsed.data.discordUserId).catch(() => null);
  if (!member) return { error: "Your Discord account isn't in the server", status: 403 as const };
  return { channel, member };
}

ticketRoutes.post("/tickets/:channelId/claim", async (c) => {
  const actor = await resolveTicketActor(c.get("guild"), c.req.param("channelId"), await readJson(c));
  if ("error" in actor) return c.json({ error: actor.error }, actor.status);
  const result = await claimTicketAs(actor.channel, actor.member, "dashboard");
  if (result.status === "not_a_ticket") return c.json({ error: "That channel isn't a tracked ticket" }, 404);
  if (result.status === "already_claimed") return c.json({ error: `Already claimed by ${result.claimedBy}` }, 409);
  return c.json({ ok: true });
});

ticketRoutes.post("/tickets/:channelId/close", async (c) => {
  const actor = await resolveTicketActor(c.get("guild"), c.req.param("channelId"), await readJson(c));
  if ("error" in actor) return c.json({ error: actor.error }, actor.status);
  const result = await closeTicketChannel(actor.channel, actor.member, "dashboard");
  if (result !== "closed") {
    const status = result === "not_a_ticket" ? 404 : result === "already_closed" ? 409 : 500;
    return c.json({ error: CLOSE_RESULT_MESSAGES[result] }, status);
  }
  return c.json({ ok: true });
});

// A staff reply typed in the dashboard. Discord has no way to post as the
// user, so the bot posts it with the sender's name and avatar as credit.
const ticketMessage = z.object({
  authorName: z.string().min(1).max(80),
  authorAvatarUrl: z.string().url().nullable(),
  content: z.string().trim().min(1).max(2000),
});

ticketRoutes.post("/tickets/:channelId/message", async (c) => {
  const body = ticketMessage.safeParse(await readJson(c));
  if (!body.success) return c.json({ error: "Invalid message" }, 400);

  const guild = c.get("guild");
  const channel = await guild.channels.fetch(c.req.param("channelId")).catch(() => null);
  if (channel?.type !== ChannelType.GuildText) return c.json({ error: "The ticket channel is gone" }, 404);
  const ticket = await getTicketByChannelId(supabase, channel.id);
  if (!ticket || ticket.status !== "open") return c.json({ error: "That channel isn't an open ticket" }, 404);

  const embed = new EmbedBuilder()
    .setColor(TWITCH_PURPLE)
    .setAuthor({ name: `${body.data.authorName} (via dashboard)`, iconURL: body.data.authorAvatarUrl ?? undefined })
    .setDescription(body.data.content)
    .setTimestamp();
  const message = await channel.send({ embeds: [embed] });
  void logTicketReply(guild, ticket, body.data.authorName);
  return c.json({ ok: true, messageId: message.id });
});
