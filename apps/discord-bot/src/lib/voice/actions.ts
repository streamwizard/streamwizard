import {
  DiscordAPIError,
  escapeMarkdown,
  PermissionFlagsBits,
  RESTJSONErrorCodes,
  time,
  TimestampStyles,
  type GuildMember,
  type User,
  type VoiceChannel,
} from "discord.js";
import { reportError } from "@repo/sentry";
import { applyTempPermissions, presentGuestIds } from "./channel";
import { reasonFor, targetCheck, type VoiceContext, type VoiceInteraction } from "./command";
import { addPendingInvite, countChannelInvites, INVITE_MAX_AGE_SECONDS, INVITES_PER_CHANNEL_MAX } from "./invites";
import { targetRefusal } from "./rules";
import { renameTempChannel } from "./rename";
import { forgetOwnerPrefs, getHubs, rememberOwnerPrefs, updateTempChannel } from "./store";
import { renderChannelName } from "./template";

// What lock, unlock, hide and reveal share: flip one flag, recompute the
// channel's permissions, store the flag.

export type ChannelFlag = "locked" | "hidden";

export async function setChannelFlag(
  ctx: VoiceContext,
  flag: ChannelFlag,
  value: boolean,
  messages: { already: string; done: string; reason: string },
): Promise<string> {
  if (ctx.temp[flag] === value) return messages.already;
  const next = { ...ctx.temp, [flag]: value };
  // Discord first: if the bot lacks a permission nothing is stored, so the
  // flag never claims a lock the channel doesn't have.
  await applyTempPermissions(ctx.channel, next, {
    add: value ? presentGuestIds(ctx.channel, next.ownerId) : [],
    reason: reasonFor(ctx, messages.reason),
  });
  await updateTempChannel(ctx.channel.id, { [flag]: value });
  await rememberOwnerPrefs(ctx.temp, ctx.member.id, { [flag]: value });
  return messages.done;
}

/** The database turned down a second channel for one owner (discord_voice_channels_guild_owner_key). */
export function isOwnerTaken(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "23505";
}

/**
 * /voice-reset and the Reset button: the channel goes back to its lobby's
 * defaults (open, visible, nobody banned, the lobby's name for its owner and
 * user limit) and the owner's saved settings for that lobby are forgotten.
 * Voice staff resetting someone else's channel leave those saved settings
 * alone. People already let in as guests stay in. A lobby that's gone leaves
 * the name and limit alone, there's nothing to go back to.
 */
export async function resetChannel(ctx: VoiceContext<VoiceInteraction>): Promise<string> {
  const { channel, temp } = ctx;
  const byOwner = ctx.member.id === temp.ownerId;
  const hub = temp.hubId ? (await getHubs(temp.guildId)).find((h) => h.id === temp.hubId) : null;
  const reason = reasonFor(ctx, "Reset to the lobby's defaults");

  // Discord first, like every other change: nothing is stored for a
  // permission rewrite that didn't go through.
  if (temp.locked || temp.hidden || temp.bannedUserIds.length > 0) {
    const next = { ...temp, locked: false, hidden: false, bannedUserIds: [] };
    await applyTempPermissions(channel, next, { reason });
    await updateTempChannel(channel.id, { locked: false, hidden: false, bannedUserIds: [] });
  }
  if (hub && byOwner) await forgetOwnerPrefs(hub.id, temp.ownerId);
  if (!hub) return "Opened it up and cleared the bans. Its lobby is gone, so the name and limit stay.";

  if (channel.userLimit !== hub.default_user_limit) await channel.setUserLimit(hub.default_user_limit, reason);

  const limit = hub.default_user_limit === 0 ? "no limit" : `a limit of ${hub.default_user_limit}`;
  const done = `Back to the lobby's defaults: open, visible, nobody banned, ${limit}.`;
  const forgot = hub.remember_owner_settings && byOwner ? " Your saved settings are gone too." : "";

  // The name comes from the owner, whoever pressed reset.
  const owner = byOwner ? ctx.member : await channel.guild.members.fetch(temp.ownerId).catch(() => null);
  if (!owner) return `${done} The owner isn't in the server anymore, so the name stays.${forgot}`;
  const name = renderChannelName(hub.name_template, { username: owner.user.username, displayname: owner.displayName });
  if (channel.name === name) return `${done}${forgot}`;

  const renamed = await renameTempChannel(channel, name, reason);
  if (renamed.ok) return `${done} Renamed to **${escapeMarkdown(name)}**.${forgot}`;
  const when = time(Math.ceil(renamed.retryAt / 1000), TimestampStyles.RelativeTime);
  return `${done} The name stays for now: Discord allows 2 renames every 10 minutes. Reset again ${when} to change it back.${forgot}`;
}

/** Discord's "can't DM them" answers: DMs turned off or the bot blocked, and no shared server with DMs allowed. */
const DM_CLOSED = new Set<number>([
  RESTJSONErrorCodes.CannotSendMessagesToThisUser,
  RESTJSONErrorCodes.CannotSendMessagesToThisUserDueToHavingNoMutualGuilds,
]);

/**
 * /voice-invite @member and the Invite button's member picker: lets a server
 * member in past a lock or hide, then tells them: a DM, or a ping in the chat
 * when their DMs are closed.
 */
export async function inviteMember(ctx: VoiceContext<VoiceInteraction>, user: User, member: GuildMember | null): Promise<string> {
  const refusal = targetRefusal("invite", ctx.temp, targetCheck(ctx, user, member));
  if (refusal) return refusal;

  if (ctx.temp.locked || ctx.temp.hidden) {
    await applyTempPermissions(ctx.channel, ctx.temp, { add: [user.id], reason: reasonFor(ctx, "Invited") });
  }

  const name = escapeMarkdown(ctx.channel.name);
  const dm = await user
    .send({
      content: `${escapeMarkdown(ctx.member.displayName)} invited you to **${name}** in ${escapeMarkdown(ctx.channel.guild.name)}. Hop in: ${ctx.channel.url}`,
      allowedMentions: { parse: [] },
    })
    .then(
      () => true,
      (error: unknown) => {
        if (!(error instanceof DiscordAPIError && DM_CLOSED.has(Number(error.code)))) {
          reportError(error, "discord-bot voice: invite DM", { channelId: ctx.channel.id });
        }
        return false;
      },
    );
  if (dm) return `Invited ${user}. I sent them a DM with a link.`;

  await ctx.channel.send({ content: `${user}, ${ctx.member} invited you in. Hop in whenever.`, allowedMentions: { users: [user.id] } });
  return `Invited ${user}. Their DMs are closed, so I pinged them in this channel's chat.`;
}

export type InviteLinkResult = { ok: true; url: string } | { ok: false; refusal: string };

/**
 * A one-time server invite that lands in this channel, for someone outside the
 * server. Used by /voice-invite without a member and the Invite button.
 */
export async function makeInviteLink(channel: VoiceChannel, member: GuildMember, reason: string): Promise<InviteLinkResult> {
  // The bot makes the link with its own permissions, so check the owner's:
  // a server that keeps invites to staff stays that way.
  if (!member.permissionsIn(channel).has(PermissionFlagsBits.CreateInstantInvite)) {
    return { ok: false, refusal: "This server doesn't let you make invite links. You can still invite people who are already in the server." };
  }
  if (countChannelInvites(channel.id) >= INVITES_PER_CHANNEL_MAX) {
    return { ok: false, refusal: `This channel has ${INVITES_PER_CHANNEL_MAX} open links already. Wait for one to be used or run out.` };
  }

  const invite = await channel.createInvite({ maxAge: INVITE_MAX_AGE_SECONDS, maxUses: 1, unique: true, temporary: false, reason });
  addPendingInvite({ code: invite.code, guildId: channel.guild.id, channelId: channel.id, expiresAt: Date.now() + INVITE_MAX_AGE_SECONDS * 1000 });
  return { ok: true, url: invite.url };
}
