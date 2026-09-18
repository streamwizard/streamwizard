import {
  ChannelType,
  PermissionsBitField,
  type GuildMember,
  type PartialGuildMember,
  type PartialUser,
  type Role,
  type User,
} from "discord.js";
import type { DiscordChannelRef, DiscordRoleRef, DiscordUserRef } from "@repo/types";
import { truncate } from "../log-channel/embed-kit";

// Plain, serialisable snapshots of Discord objects for event payloads, plus
// the diff helpers the server log uses. No env, no network: tested directly.

const AVATAR_SIZE = 128;

export function userRef(
  user: User | PartialUser | null | undefined,
  member?: GuildMember | PartialGuildMember | null,
): DiscordUserRef | null {
  const source = user ?? member?.user;
  if (!source) return member ? { id: member.id } : null;
  return {
    id: source.id,
    username: source.username ?? null,
    display_name: member?.nickname ?? source.globalName ?? null,
    avatar_url: member?.displayAvatarURL({ size: AVATAR_SIZE }) ?? source.displayAvatarURL({ size: AVATAR_SIZE }),
    bot: source.bot ?? false,
  };
}

export function memberRef(member: GuildMember | PartialGuildMember): DiscordUserRef {
  return userRef(member.user, member) ?? { id: member.id };
}

/** What Discord shows for them in this server: nickname, then global name, then username. */
export function displayNameOf(
  user: User | PartialUser,
  member?: GuildMember | PartialGuildMember | null,
): string | null {
  return member?.nickname ?? user.globalName ?? user.username ?? null;
}

const CHANNEL_TYPE_LABELS: Partial<Record<ChannelType, string>> = {
  [ChannelType.GuildText]: "text",
  [ChannelType.GuildVoice]: "voice",
  [ChannelType.GuildCategory]: "category",
  [ChannelType.GuildAnnouncement]: "announcement",
  [ChannelType.GuildStageVoice]: "stage",
  [ChannelType.GuildForum]: "forum",
  [ChannelType.GuildMedia]: "media",
  [ChannelType.PublicThread]: "thread",
  [ChannelType.PrivateThread]: "private thread",
  [ChannelType.AnnouncementThread]: "announcement thread",
};

interface ChannelLike {
  id: string;
  name?: string | null;
  type: ChannelType;
  parent?: { name: string } | null;
}

export function channelRef(
  channel: ChannelLike | null | undefined,
  fallbackId?: string | null,
): DiscordChannelRef | null {
  if (!channel) return fallbackId ? { id: fallbackId } : null;
  return {
    id: channel.id,
    name: channel.name ?? null,
    type: CHANNEL_TYPE_LABELS[channel.type] ?? null,
    parent_name: channel.parent?.name ?? null,
  };
}

export function hexColor(color: number): string | null {
  return color ? `#${color.toString(16).padStart(6, "0")}` : null;
}

export function roleRef(role: Pick<Role, "id" | "name" | "color">): DiscordRoleRef {
  return { id: role.id, name: role.name, color: hexColor(role.color) };
}

/** Roles added and removed between two role id lists (the @everyone role is ignored). */
export function diffRoleIds(before: Iterable<string>, after: Iterable<string>, everyoneId: string) {
  const old = new Set(before);
  const next = new Set(after);
  old.delete(everyoneId);
  next.delete(everyoneId);
  return {
    added: [...next].filter((id) => !old.has(id)),
    removed: [...old].filter((id) => !next.has(id)),
  };
}

/** Permission names (e.g. "ManageMessages") added and removed. */
export function diffPermissions(before: bigint, after: bigint) {
  const old = new Set(new PermissionsBitField(before).toArray());
  const next = new Set(new PermissionsBitField(after).toArray());
  return {
    added: [...next].filter((name) => !old.has(name)),
    removed: [...old].filter((name) => !next.has(name)),
  };
}

export type Changes = Record<string, { from: unknown; to: unknown }>;

/** Changed keys between two plain snapshots. Values compare by JSON. */
export function diffFields<T extends Record<string, unknown>>(before: T, after: T): Changes {
  const changes: Changes = {};
  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null)) {
      changes[key] = { from: before[key] ?? null, to: after[key] ?? null };
    }
  }
  return changes;
}

/** Ignored channels match the channel itself or its category. */
export function isIgnoredChannel(ignoredIds: Iterable<string>, channelId: string, parentId?: string | null): boolean {
  const ignored = new Set(ignoredIds);
  return ignored.has(channelId) || (!!parentId && ignored.has(parentId));
}

const MAX_TEXT = 1900;

/** Message text for a payload: trimmed and capped. Null stays null (not cached). */
export function messageText(content: string | null | undefined): string | null {
  if (content === null || content === undefined) return null;
  return truncate(content, MAX_TEXT);
}
