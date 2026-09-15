import { escapeMarkdown, type APIEmbedField, type EmbedBuilder } from "discord.js";
import type { DiscordChannelRef, DiscordRoleRef, DiscordUserRef } from "@repo/types";
import type { PlatformEvent } from "@repo/supabase/queries/platform-events";
import {
  DESCRIPTION_MAX,
  FIELD_MAX,
  base,
  bold,
  changeLines,
  channelMention,
  code,
  discordDate,
  discordMention,
  field,
  httpsUrl,
  quote,
  roleMention,
  setAuthor,
  truncate,
  twitchLink,
  type Formatter,
} from "./embed-kit";

// Discord server events: members, messages, roles, channels, server, invites,
// voice. Author and thumbnail show the member's Discord avatar; mentions are
// safe because the worker posts with allowedMentions: { parse: [] }.

interface Linked {
  discord_user_id?: string | null;
  twitch_username?: string | null;
}

interface Moderation {
  moderator?: DiscordUserRef | null;
  reason?: string | null;
}

function memberName(member?: DiscordUserRef | null): string | null {
  return member ? (member.display_name ?? member.username ?? null) : null;
}

/** "<@id>", or the name when the id isn't usable. */
function who(member: DiscordUserRef | null | undefined, fallback: string): string {
  return discordMention(member?.id) ?? bold(memberName(member), fallback);
}

function withMember(embed: EmbedBuilder, member?: DiscordUserRef | null): EmbedBuilder {
  if (!member) return embed;
  setAuthor(embed, member.username ? `${memberName(member) ?? member.username} (@${member.username})` : memberName(member), member.avatar_url);
  const avatar = httpsUrl(member.avatar_url);
  if (avatar) embed.setThumbnail(avatar);
  return embed;
}

function memberFields(member: DiscordUserRef | null | undefined, payload: Linked): APIEmbedField[] {
  return [...field("Discord ID", code(member?.id)), ...field("StreamWizard", twitchLink(payload.twitch_username))];
}

function moderationFields(payload: Moderation, label = "Moderator"): APIEmbedField[] {
  return [
    ...field(label, payload.moderator ? who(payload.moderator, "Unknown") : "Unknown"),
    ...field("Reason", payload.reason ? escapeMarkdown(payload.reason) : null, false),
  ];
}

function roleList(roles?: DiscordRoleRef[] | null): string | null {
  if (!roles?.length) return null;
  return truncate(roles.map((role) => roleMention(role.id) ?? bold(role.name, "role")).join(" "), FIELD_MAX);
}

function channelLabel(channel?: DiscordChannelRef | null): string {
  if (!channel) return "a channel";
  return channelMention(channel.id) ?? bold(channel.name ? `#${channel.name}` : null, "a channel");
}

/** Deleted channels and roles can't be mentioned any more; use their name. */
function goneChannel(channel?: DiscordChannelRef | null): string {
  return bold(channel?.name ? `#${channel.name}` : null, "A channel");
}

const summary = (embed: EmbedBuilder, lines: string[]) => embed.setDescription(truncate(lines.filter(Boolean).join("\n"), DESCRIPTION_MAX));

type ServerType =
  | "member.joined"
  | "member.left"
  | "member.kicked"
  | "member.banned"
  | "member.unbanned"
  | "member.timed_out"
  | "member.timeout_removed"
  | "member.nickname_changed"
  | "member.roles_changed"
  | "message.edited"
  | "message.deleted"
  | "message.bulk_deleted"
  | "role.created"
  | "role.updated"
  | "role.deleted"
  | "channel.created"
  | "channel.updated"
  | "channel.deleted"
  | "server.updated"
  | "invite.created"
  | "invite.deleted"
  | "voice.joined"
  | "voice.left"
  | "voice.moved";

const permissionList = (names?: string[]) => (names?.length ? truncate(names.map((n) => code(n)).join(", "), FIELD_MAX) : null);

export const SERVER_FORMATTERS: { [T in ServerType]: Formatter<T> } = {
  "member.joined": (payload, event: PlatformEvent) =>
    withMember(base(event, "member.joined"), payload.member)
      .setDescription(
        `${who(payload.member, "Someone")} joined the server.${payload.member_count ? ` Member ${payload.member_count.toLocaleString("en-US")}.` : ""}`
      )
      .addFields([...field("Account created", discordDate(payload.account_created_at, "Unknown")), ...memberFields(payload.member, payload)]),

  "member.left": (payload, event) =>
    withMember(base(event, "member.left"), payload.member)
      .setDescription(`${who(payload.member, "Someone")} left the server.`)
      .addFields([
        ...field("Joined", discordDate(payload.joined_at, "Unknown")),
        ...memberFields(payload.member, payload),
        ...field("Roles", roleList(payload.roles), false),
      ]),

  "member.kicked": (payload, event) =>
    withMember(base(event, "member.kicked"), payload.member)
      .setDescription(`${who(payload.member, "Someone")} was kicked.`)
      .addFields([
        ...moderationFields(payload),
        ...memberFields(payload.member, payload),
        ...field("Roles", roleList(payload.roles), false),
      ]),

  "member.banned": (payload, event) =>
    withMember(base(event, "member.banned"), payload.member)
      .setDescription(`${who(payload.member, "Someone")} was banned.`)
      .addFields([...moderationFields(payload), ...memberFields(payload.member, payload)]),

  "member.unbanned": (payload, event) =>
    withMember(base(event, "member.unbanned"), payload.member)
      .setDescription(`${who(payload.member, "Someone")} was unbanned.`)
      .addFields([...moderationFields(payload), ...memberFields(payload.member, payload)]),

  "member.timed_out": (payload, event) =>
    withMember(base(event, "member.timed_out"), payload.member)
      .setDescription(`${who(payload.member, "Someone")} is timed out until ${discordDate(payload.until, "later")}.`)
      .addFields([...moderationFields(payload), ...memberFields(payload.member, payload)]),

  "member.timeout_removed": (payload, event) =>
    withMember(base(event, "member.timeout_removed"), payload.member)
      .setDescription(`${who(payload.member, "Someone")} can talk again.`)
      .addFields([...moderationFields(payload, "Removed by"), ...memberFields(payload.member, payload)]),

  "member.nickname_changed": (payload, event) =>
    withMember(base(event, "member.nickname_changed"), payload.member)
      .setDescription(`${who(payload.member, "Someone")} has a new nickname.`)
      .addFields([
        ...field("Before", payload.before ? escapeMarkdown(payload.before) : "*No nickname*"),
        ...field("After", payload.after ? escapeMarkdown(payload.after) : "*No nickname*"),
        ...moderationFields(payload, "Changed by"),
      ]),

  "member.roles_changed": (payload, event) =>
    withMember(base(event, "member.roles_changed"), payload.member)
      .setDescription(`${who(payload.member, "Someone")}'s roles changed.`)
      .addFields([
        ...field("Added", roleList(payload.added)),
        ...field("Removed", roleList(payload.removed)),
        ...moderationFields(payload, "Changed by"),
      ]),

  "message.edited": (payload, event) =>
    withMember(base(event, "message.edited"), payload.member)
      .setDescription(
        `${who(payload.member, "Someone")} edited a message in ${channelLabel(payload.channel)}.${payload.url ? ` [Jump to message](${payload.url})` : ""}`
      )
      .addFields([
        ...field("Before", quote(payload.before, "Not cached, the bot restarted since it was sent"), false),
        ...field("After", quote(payload.after, "Unknown"), false),
        ...memberFields(payload.member, payload),
      ]),

  "message.deleted": (payload, event) =>
    withMember(base(event, "message.deleted"), payload.member)
      .setDescription(
        payload.member
          ? `A message by ${who(payload.member, "someone")} was deleted in ${channelLabel(payload.channel)}.`
          : `A message was deleted in ${channelLabel(payload.channel)}.`
      )
      .addFields([
        ...field("Text", quote(payload.content, "Not available, the bot didn't see this message"), false),
        ...field("Attachments", payload.attachments?.length ? truncate(payload.attachments.map((name) => code(name)).join(", "), FIELD_MAX) : null, false),
        ...field("Sent", discordDate(payload.sent_at, "Unknown")),
        ...(payload.moderator ? moderationFields(payload, "Deleted by") : []),
        ...field("Message ID", code(payload.message_id)),
      ]),

  "message.bulk_deleted": (payload, event) => {
    const lines = payload.lines?.length ? `\`\`\`\n${truncate(payload.lines.join("\n").replace(/`/g, "'"), DESCRIPTION_MAX - 200)}\n\`\`\`` : "";
    return summary(base(event, "message.bulk_deleted"), [
      `${payload.count ?? "Several"} messages were deleted in ${channelLabel(payload.channel)}.`,
      lines,
    ]).addFields(moderationFields(payload));
  },

  "role.created": (payload, event) =>
    base(event, "role.created")
      .setDescription(`${roleMention(payload.role?.id) ?? bold(payload.role?.name, "A role")} was created.`)
      .addFields([
        ...field("Name", payload.role?.name ? escapeMarkdown(payload.role.name) : null),
        ...field("Colour", code(payload.role?.color)),
        ...field("Permissions", permissionList(payload.permissions), false),
        ...moderationFields(payload, "Created by"),
      ]),

  "role.updated": (payload, event) =>
    summary(base(event, "role.updated"), [
      `${roleMention(payload.role?.id) ?? bold(payload.role?.name, "A role")} changed.`,
      ...changeLines(payload.changes),
    ]).addFields([
      ...field("Permissions added", permissionList(payload.permissions_added), false),
      ...field("Permissions removed", permissionList(payload.permissions_removed), false),
      ...moderationFields(payload, "Changed by"),
    ]),

  "role.deleted": (payload, event) =>
    base(event, "role.deleted")
      .setDescription(`The ${bold(payload.role?.name, "unnamed")} role was deleted.`)
      .addFields([...field("Role ID", code(payload.role?.id)), ...moderationFields(payload, "Deleted by")]),

  "channel.created": (payload, event) =>
    base(event, "channel.created")
      .setDescription(`${channelLabel(payload.channel)} was created.`)
      .addFields([
        ...field("Type", payload.channel?.type ?? null),
        ...field("Category", payload.channel?.parent_name ? escapeMarkdown(payload.channel.parent_name) : null),
        ...moderationFields(payload, "Created by"),
      ]),

  "channel.updated": (payload, event) =>
    summary(base(event, "channel.updated"), [
      `${channelLabel(payload.channel)} changed.`,
      ...changeLines(payload.changes),
      payload.overwrites_changed ? "**Permissions** overrides changed" : "",
    ]).addFields(moderationFields(payload, "Changed by")),

  "channel.deleted": (payload, event) =>
    base(event, "channel.deleted")
      .setDescription(`${goneChannel(payload.channel)} was deleted.`)
      .addFields([
        ...field("Type", payload.channel?.type ?? null),
        ...field("Category", payload.channel?.parent_name ? escapeMarkdown(payload.channel.parent_name) : null),
        ...moderationFields(payload, "Deleted by"),
      ]),

  "server.updated": (payload, event) =>
    summary(base(event, "server.updated"), ["The server settings changed.", ...changeLines(payload.changes)]).addFields(
      moderationFields(payload, "Changed by")
    ),

  "invite.created": (payload, event) =>
    base(event, "invite.created")
      .setDescription(`New invite ${code(`discord.gg/${payload.code ?? "?"}`)} for ${channelLabel(payload.channel)}.`)
      .addFields([
        ...field("Created by", payload.inviter ? who(payload.inviter, "Unknown") : "Unknown"),
        ...field("Max uses", payload.max_uses ? String(payload.max_uses) : "No limit"),
        ...field("Expires", discordDate(payload.expires_at)),
        ...field("Temporary", payload.temporary ? "Yes, members leave when they go offline" : null, false),
      ]),

  "invite.deleted": (payload, event) =>
    base(event, "invite.deleted").setDescription(
      `Invite ${code(`discord.gg/${payload.code ?? "?"}`)} for ${channelLabel(payload.channel)} was deleted or expired.`
    ),

  "voice.joined": (payload, event) =>
    withMember(base(event, "voice.joined"), payload.member).setDescription(`${who(payload.member, "Someone")} joined ${channelLabel(payload.channel)}.`),

  "voice.left": (payload, event) =>
    withMember(base(event, "voice.left"), payload.member).setDescription(`${who(payload.member, "Someone")} left ${channelLabel(payload.channel)}.`),

  "voice.moved": (payload, event) =>
    withMember(base(event, "voice.moved"), payload.member).setDescription(
      `${who(payload.member, "Someone")} moved from ${channelLabel(payload.from)} to ${channelLabel(payload.to)}.`
    ),
};
