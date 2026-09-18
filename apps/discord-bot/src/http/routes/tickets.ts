import { Hono } from "hono";
import { z } from "zod";
import { ChannelType, EmbedBuilder, type Guild, type GuildMember, type TextChannel } from "discord.js";
import { supabase } from "@repo/supabase";
import { TICKET_PRIORITIES } from "@repo/supabase/queries/ticket-lifecycle";
import { getTicketByChannelId, getTicketSettings } from "@repo/supabase/queries/tickets";
import { TWITCH_PURPLE } from "../../lib/branding";
import { BuiltMessageError, BuiltMessageSendError } from "../../lib/built-message";
import {
  addMember,
  archiveNewMessage,
  changePriority,
  changeSubject,
  CLOSE_REASON_MAX,
  CLOSE_RESULT_MESSAGES,
  claimTicketAs,
  closeTicketChannel,
  deleteTicketPanel,
  describeDiscordError,
  invalidateTicketConfig,
  logTicketReply,
  moveTicket,
  releaseTicket,
  removeMember,
  transferTicket,
  type TicketActionResult,
  NO_PANEL,
  panelLocation,
  postTicketPanel,
  saveTicketSettings,
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
    await saveTicketSettings(guild.id, NO_PANEL);
    return c.json({ ok: true, channelId: null, messageId: null });
  }

  const channel = await guild.channels.fetch(targetChannelId).catch(() => null);
  if (!channel?.isSendable()) {
    return c.json({ error: "The panel channel is gone or the bot can't post in it" }, 409);
  }

  // web-admin may have just saved a new design or category list: post from what is stored now.
  invalidateTicketConfig(guild.id);
  try {
    const posted = await postTicketPanel(guild, channel, settings);
    await saveTicketSettings(guild.id, panelLocation(channel.id, posted));
    return c.json({ ok: true, channelId: channel.id, messageId: posted.controlsMessageId });
  } catch (error) {
    // The design can't be sent as it is; the message says what to change.
    if (error instanceof BuiltMessageError) return c.json({ error: error.message, issues: error.issues }, 422);
    if (error instanceof BuiltMessageSendError) {
      // Remember what made it into the channel, so the next post cleans up instead of doubling.
      await saveTicketSettings(guild.id, {
        panel_channel_id: channel.id,
        panel_message_id: error.messageIds.at(-1) ?? null,
        panel_message_ids: error.messageIds,
      });
      return c.json({ error: "Discord rejected the panel. Check the bot's permissions in that channel." }, 502);
    }
    throw error;
  }
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
  const body = await readJson(c);
  const actor = await resolveTicketActor(c.get("guild"), c.req.param("channelId"), body);
  if ("error" in actor) return c.json({ error: actor.error }, actor.status);
  const reason = z.object({ reason: z.string().trim().max(CLOSE_REASON_MAX).nullish() }).safeParse(body);
  if (!reason.success) return c.json({ error: "Invalid body" }, 400);

  const result = await closeTicketChannel(actor.channel, actor.member, "dashboard", reason.data.reason || null);
  if (result !== "closed") {
    const status = result === "not_a_ticket" ? 404 : result === "already_closed" ? 409 : 500;
    return c.json({ error: CLOSE_RESULT_MESSAGES[result] }, status);
  }
  return c.json({ ok: true });
});

// The rest of what staff can do to an open ticket, from the dashboard. Each
// takes the acting admin's Discord id plus its own fields, runs the same
// action the slash command does, and answers 409 with the action's own
// sentence when it couldn't be done.
function ticketActionRoute<T extends z.ZodRawShape>(
  path: string,
  shape: T,
  run: (channel: TextChannel, actor: GuildMember, input: z.infer<z.ZodObject<T>>, guild: Guild) => Promise<TicketActionResult>,
): void {
  const schema = z.object(shape);
  ticketRoutes.post(`/tickets/:channelId/${path}`, async (c) => {
    const body = await readJson(c);
    const guild = c.get("guild");
    const actor = await resolveTicketActor(guild, c.req.param("channelId"), body);
    if ("error" in actor) return c.json({ error: actor.error }, actor.status);
    const input = schema.safeParse(body);
    if (!input.success) return c.json({ error: "Invalid body" }, 400);

    try {
      const result = await run(actor.channel, actor.member, input.data, guild);
      return result.ok ? c.json({ ok: true }) : c.json({ error: result.message }, 409);
    } catch (error) {
      const known = describeDiscordError(error);
      if (!known) throw error;
      return c.json({ error: known }, 409);
    }
  });
}

const NOT_IN_SERVER: TicketActionResult = { ok: false, message: "That person isn't in the server." };

ticketActionRoute("release", {}, (channel, actor) => releaseTicket(channel, actor, "dashboard"));

ticketActionRoute("priority", { priority: z.enum(TICKET_PRIORITIES).nullable() }, (channel, actor, input) =>
  changePriority(channel, actor, input.priority, "dashboard"),
);

ticketActionRoute("subject", { subject: z.string().trim().min(1).max(100) }, (channel, actor, input) =>
  changeSubject(channel, actor, input.subject, "dashboard"),
);

ticketActionRoute("move", { category: z.string().regex(/^[a-z0-9_]{1,32}$/) }, (channel, actor, input) =>
  moveTicket(channel, actor, input.category, "dashboard"),
);

ticketActionRoute("members/add", { targetDiscordUserId: snowflake }, async (channel, actor, input, guild) => {
  const target = await guild.members.fetch(input.targetDiscordUserId).catch(() => null);
  return target ? addMember(channel, actor, target, "dashboard") : NOT_IN_SERVER;
});

ticketActionRoute(
  "members/remove",
  { targetDiscordUserId: snowflake, targetName: z.string().max(100).optional() },
  (channel, actor, input) =>
    removeMember(channel, actor, { id: input.targetDiscordUserId, displayName: input.targetName || "them" }, "dashboard"),
);

ticketActionRoute("transfer", { targetDiscordUserId: snowflake }, async (channel, actor, input, guild) => {
  const target = await guild.members.fetch(input.targetDiscordUserId).catch(() => null);
  return target ? transferTicket(channel, actor, target, "dashboard") : NOT_IN_SERVER;
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
  // Posted by the bot, but it is a staff reply: it counts for response times.
  void archiveNewMessage(message, { counts: true, byStaff: true });
  void logTicketReply(guild, ticket, body.data.authorName);
  return c.json({ ok: true, messageId: message.id });
});
