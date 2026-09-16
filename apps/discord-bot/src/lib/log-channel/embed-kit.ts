import { EmbedBuilder, escapeMarkdown, type APIEmbedField } from "discord.js";
import {
  PLATFORM_EVENT_LABELS,
  type DiscordUserRef,
  type PlatformEventPayloads,
  type PlatformEventType,
} from "@repo/types";
import type { PlatformEvent } from "@repo/supabase/queries/platform-events";
import { formatDuration, formatNumber } from "../activity-format";
import { DANGER_RED, DISCORD_BLURPLE, TWITCH_PURPLE } from "../branding";

export { formatNumber };

// Shared pieces for log embeds. Pure: no env, no Discord or DB calls.
// Wording follows docs/tone_of_voice.md (sentence case, no em dashes, one
// emoji per message). Colours follow docs/branding.md: StreamWizard events are
// Twitch purple, Discord server events blurple, destructive ones red.

export const FIELD_MAX = 1024;
export const DESCRIPTION_MAX = 4096;
const AUTHOR_MAX = 256;

export type Formatter<T extends PlatformEventType> = (
  payload: Partial<PlatformEventPayloads[T]>,
  event: PlatformEvent,
) => EmbedBuilder;

export const STYLE: Record<PlatformEventType, { emoji: string; color: number }> = {
  "user.created": { emoji: "👋", color: TWITCH_PURPLE },
  "user.deleted": { emoji: "🗑️", color: DANGER_RED },
  "discord.linked": { emoji: "🔗", color: TWITCH_PURPLE },
  "discord.unlinked": { emoji: "✂️", color: DANGER_RED },
  "subscription.granted": { emoji: "🎟️", color: TWITCH_PURPLE },
  "subscription.changed": { emoji: "🔁", color: TWITCH_PURPLE },
  "subscription.revoked": { emoji: "🚫", color: DANGER_RED },
  "discord_settings.changed": { emoji: "⚙️", color: TWITCH_PURPLE },
  "admin.role_granted": { emoji: "🛡️", color: TWITCH_PURPLE },
  "admin.role_revoked": { emoji: "🛡️", color: DANGER_RED },
  "feedback.submitted": { emoji: "💬", color: TWITCH_PURPLE },
  "log.test": { emoji: "🧪", color: TWITCH_PURPLE },

  "clips.sync_started": { emoji: "🎬", color: TWITCH_PURPLE },
  "clips.sync_completed": { emoji: "✅", color: TWITCH_PURPLE },
  "clips.sync_failed": { emoji: "❌", color: DANGER_RED },
  "twitch.token_refresh_failed": { emoji: "🔑", color: DANGER_RED },
  "stream.online_failed": { emoji: "📡", color: DANGER_RED },

  "ticket.opened": { emoji: "🎫", color: TWITCH_PURPLE },
  "ticket.claimed": { emoji: "🙋", color: TWITCH_PURPLE },
  "ticket.closed": { emoji: "✅", color: TWITCH_PURPLE },
  "ticket.replied": { emoji: "💬", color: TWITCH_PURPLE },

  "member.joined": { emoji: "📥", color: DISCORD_BLURPLE },
  "member.left": { emoji: "📤", color: DANGER_RED },
  "member.kicked": { emoji: "👢", color: DANGER_RED },
  "member.banned": { emoji: "🔨", color: DANGER_RED },
  "member.unbanned": { emoji: "🕊️", color: DISCORD_BLURPLE },
  "member.timed_out": { emoji: "⏳", color: DANGER_RED },
  "member.timeout_removed": { emoji: "⌛", color: DISCORD_BLURPLE },
  "member.nickname_changed": { emoji: "✏️", color: DISCORD_BLURPLE },
  "member.roles_changed": { emoji: "🏷️", color: DISCORD_BLURPLE },

  "message.edited": { emoji: "📝", color: DISCORD_BLURPLE },
  "message.deleted": { emoji: "🗑️", color: DANGER_RED },
  "message.bulk_deleted": { emoji: "🧹", color: DANGER_RED },

  "role.created": { emoji: "✨", color: DISCORD_BLURPLE },
  "role.updated": { emoji: "🎨", color: DISCORD_BLURPLE },
  "role.deleted": { emoji: "🗑️", color: DANGER_RED },

  "channel.created": { emoji: "📁", color: DISCORD_BLURPLE },
  "channel.updated": { emoji: "🛠️", color: DISCORD_BLURPLE },
  "channel.deleted": { emoji: "🗑️", color: DANGER_RED },

  "server.updated": { emoji: "🏰", color: DISCORD_BLURPLE },

  "invite.created": { emoji: "💌", color: DISCORD_BLURPLE },
  "invite.deleted": { emoji: "✉️", color: DISCORD_BLURPLE },

  "voice.joined": { emoji: "🔊", color: DISCORD_BLURPLE },
  "voice.left": { emoji: "🔇", color: DISCORD_BLURPLE },
  "voice.moved": { emoji: "🔀", color: DISCORD_BLURPLE },
};

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function field(name: string, value: string | null | undefined, inline = true): APIEmbedField[] {
  return value ? [{ name, value: truncate(value, FIELD_MAX), inline }] : [];
}

export const isTwitchLogin = (name?: string | null): name is string => !!name && /^\w+$/.test(name);
export const twitchUrl = (name?: string | null) => (isTwitchLogin(name) ? `https://twitch.tv/${name}` : undefined);
export const httpsUrl = (url?: string | null) => (url && /^https:\/\/\S+$/.test(url) ? url : undefined);

// Twitch logins are [a-z0-9_], so they're safe in a markdown link. Anything
// else is escaped and shown as plain text.
export function twitchLink(name?: string | null): string | null {
  if (!name) return null;
  return isTwitchLogin(name) ? `[${name}](https://twitch.tv/${name})` : escapeMarkdown(name);
}

const isSnowflake = (id?: string | null): id is string => !!id && /^\d{17,20}$/.test(id);

export function discordMention(id?: string | null): string | null {
  return isSnowflake(id) ? `<@${id}>` : null;
}

export function channelMention(id?: string | null): string | null {
  return isSnowflake(id) ? `<#${id}>` : null;
}

export function roleMention(id?: string | null): string | null {
  return isSnowflake(id) ? `<@&${id}>` : null;
}

export function code(value?: string | null): string | null {
  return value ? `\`${value.replace(/`/g, "")}\`` : null;
}

/** Comma-separated code spans, capped for a field. Null when empty. */
export function codeList(items?: string[] | null): string | null {
  return items?.length ? truncate(items.map((item) => code(item)).join(", "), FIELD_MAX) : null;
}

/** User-written text as plain text: escaped, or null when empty. */
export function plain(text?: string | null): string | null {
  return text ? escapeMarkdown(text) : null;
}

export function bold(name: string | null | undefined, fallback: string): string {
  return name ? `**${escapeMarkdown(name)}**` : fallback;
}

/** Quoted block for user-written text, safe inside a field. */
export function quote(text: string | null | undefined, empty: string): string {
  if (text === null || text === undefined) return `*${empty}*`;
  if (!text.trim()) return "*No text*";
  return truncate(
    text
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n"),
    FIELD_MAX,
  );
}

export function discordDate(iso: string | null | undefined, fallback = "Never"): string {
  if (!iso) return fallback;
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return iso;
  const unix = Math.floor(ms / 1000);
  return `<t:${unix}:D> (<t:${unix}:R>)`;
}

/** "1h 4m", "2m 13s", "45s" (activity-format's rule). Null for missing or negative values. */
export function duration(seconds?: number | null): string | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return null;
  return formatDuration(Math.round(seconds));
}

export function sentenceCase(value?: string | null): string | null {
  if (!value) return null;
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function base(event: PlatformEvent, type: PlatformEventType | null): EmbedBuilder {
  const style = type ? STYLE[type] : { emoji: "📌", color: TWITCH_PURPLE };
  const label = type ? PLATFORM_EVENT_LABELS[type] : event.event_type;
  return new EmbedBuilder()
    .setColor(style.color)
    .setTitle(`${style.emoji} ${label}`)
    .setFooter({ text: `StreamWizard log · Event #${event.id}` })
    .setTimestamp(new Date(event.created_at));
}

export function setAuthor(
  embed: EmbedBuilder,
  name: string | null | undefined,
  iconUrl?: string | null,
  url?: string,
): EmbedBuilder {
  if (name) embed.setAuthor({ name: truncate(name, AUTHOR_MAX), iconURL: httpsUrl(iconUrl), url });
  return embed;
}

/** The description as lines; empty lines are dropped and the whole is capped. */
export function describeLines(embed: EmbedBuilder, lines: string[]): EmbedBuilder {
  return embed.setDescription(truncate(lines.filter(Boolean).join("\n"), DESCRIPTION_MAX));
}

// ── Discord members in payloads ─────────────────────────────────────────────

export function memberName(member?: DiscordUserRef | null): string | null {
  return member ? (member.display_name ?? member.username ?? null) : null;
}

/** "<@id>", or the bold name when the id isn't usable. */
export function discordUser(member: DiscordUserRef | null | undefined, fallback: string): string {
  return discordMention(member?.id) ?? bold(memberName(member), fallback);
}

/** Author line "Name (@username)" and thumbnail from a member's Discord avatar. */
export function withMember(embed: EmbedBuilder, member?: DiscordUserRef | null): EmbedBuilder {
  if (!member) return embed;
  const name = memberName(member);
  const label = name && member.username && name !== member.username ? `${name} (@${member.username})` : name;
  setAuthor(embed, label, member.avatar_url);
  const avatar = httpsUrl(member.avatar_url);
  if (avatar) embed.setThumbnail(avatar);
  return embed;
}

/** Renders a changed value: channel and role ids as mentions, flags as on/off, links as links. */
export function formatSettingValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "none";
  if (typeof value === "boolean") return value ? "on" : "off";
  if (Array.isArray(value))
    return value.length ? value.map((item) => formatSettingValue(key, item)).join(", ") : "none";
  if (typeof value === "string" && isSnowflake(value)) {
    if (/channel/.test(key)) return `<#${value}>`;
    if (/role/.test(key)) return `<@&${value}>`;
  }
  if (typeof value === "string" && httpsUrl(value)) return `[link](${value})`;
  return code(typeof value === "string" ? value : JSON.stringify(value)) ?? "none";
}

/** "**Name** before → after" lines for a changes map. */
export function changeLines(changes: Record<string, { from: unknown; to: unknown }> | undefined): string[] {
  return Object.entries(changes ?? {}).map(
    ([key, change]) =>
      `**${sentenceCase(key)}** ${formatSettingValue(key, change.from)} → ${formatSettingValue(key, change.to)}`,
  );
}
