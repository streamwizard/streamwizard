/**
 * Platform events (SW-334): the feed posted to the StreamWizard Discord log
 * channels and stored in `platform_events`. Two kinds share it:
 *   - platform events (signups, Discord links, plans, dashboard changes)
 *   - Discord server events the bot sees on the gateway (joins, bans,
 *     message edits and deletes, role and channel changes, ...)
 *
 * Adding an event type: add it to PLATFORM_EVENTS with its payload, emit it
 * once (SQL `emit_platform_event`, `emitPlatformEvent` in TS, or
 * `emitServerEvent` in the bot), and add a formatter in
 * apps/discord-bot/src/lib/log-channel/formatters.ts. The formatter map is
 * keyed by this union, so the bot won't type-check until it exists.
 *
 * Keep PII minimal: Twitch username and id, Discord user id and name. Never
 * emails. Message text only on message.* events, blanked after 30 days.
 */

export type PlatformEventGroup =
  | "platform"
  | "twitch"
  | "tickets"
  | "members"
  | "messages"
  | "roles"
  | "channels"
  | "server"
  | "invites"
  | "voice";

export const PLATFORM_EVENT_GROUPS: { id: PlatformEventGroup; label: string; hint: string }[] = [
  {
    id: "platform",
    label: "StreamWizard",
    hint: "Signups, Discord links, plans, admin roles, feedback and dashboard changes.",
  },
  { id: "twitch", label: "Twitch", hint: "Clip syncs, token problems and stream events that went wrong." },
  { id: "tickets", label: "Tickets", hint: "Tickets opened, claimed, closed and replied to from the dashboard." },
  { id: "members", label: "Members", hint: "Joins, leaves, kicks, bans, timeouts, nicknames and roles." },
  { id: "messages", label: "Messages", hint: "Edited and deleted messages, including their text." },
  { id: "roles", label: "Roles", hint: "Roles created, changed or deleted." },
  { id: "channels", label: "Channels", hint: "Channels created, changed or deleted." },
  { id: "server", label: "Server", hint: "Server name, icon and safety settings." },
  { id: "invites", label: "Invites", hint: "Invite links created or deleted." },
  { id: "voice", label: "Voice", hint: "Members joining, leaving or switching voice channels. Busy." },
];

interface EventMeta {
  label: string;
  group: PlatformEventGroup;
  /** Posted when there's no per-event setting. Busy events start off. */
  defaultEnabled: boolean;
  /** Can't be turned off (the test button must always post). */
  alwaysOn?: boolean;
}

export const PLATFORM_EVENTS = {
  "user.created": { label: "New user", group: "platform", defaultEnabled: true },
  "user.deleted": { label: "Account deleted", group: "platform", defaultEnabled: true },
  "discord.linked": { label: "Discord linked", group: "platform", defaultEnabled: true },
  "discord.unlinked": { label: "Discord unlinked", group: "platform", defaultEnabled: true },
  "subscription.granted": { label: "Plan granted", group: "platform", defaultEnabled: true },
  "subscription.changed": { label: "Plan changed", group: "platform", defaultEnabled: true },
  "subscription.revoked": { label: "Plan revoked", group: "platform", defaultEnabled: true },
  "discord_settings.changed": { label: "Dashboard setting changed", group: "platform", defaultEnabled: true },
  "admin.role_granted": { label: "Admin role granted", group: "platform", defaultEnabled: true },
  "admin.role_revoked": { label: "Admin role revoked", group: "platform", defaultEnabled: true },
  "feedback.submitted": { label: "Feedback submitted", group: "platform", defaultEnabled: true },
  "log.test": { label: "Test event", group: "platform", defaultEnabled: true, alwaysOn: true },

  "clips.sync_started": { label: "Clip sync started", group: "twitch", defaultEnabled: true },
  "clips.sync_completed": { label: "Clip sync completed", group: "twitch", defaultEnabled: true },
  "clips.sync_failed": { label: "Clip sync failed", group: "twitch", defaultEnabled: true },
  "twitch.token_refresh_failed": { label: "Twitch token refresh failed", group: "twitch", defaultEnabled: true },
  "stream.online_failed": { label: "Stream online failed", group: "twitch", defaultEnabled: true },

  "ticket.opened": { label: "Ticket opened", group: "tickets", defaultEnabled: true },
  "ticket.claimed": { label: "Ticket claimed", group: "tickets", defaultEnabled: true },
  "ticket.closed": { label: "Ticket closed", group: "tickets", defaultEnabled: true },
  "ticket.replied": { label: "Ticket reply from dashboard", group: "tickets", defaultEnabled: true },

  "member.joined": { label: "Member joined", group: "members", defaultEnabled: true },
  "member.left": { label: "Member left", group: "members", defaultEnabled: true },
  "member.kicked": { label: "Member kicked", group: "members", defaultEnabled: true },
  "member.banned": { label: "Member banned", group: "members", defaultEnabled: true },
  "member.unbanned": { label: "Member unbanned", group: "members", defaultEnabled: true },
  "member.timed_out": { label: "Member timed out", group: "members", defaultEnabled: true },
  "member.timeout_removed": { label: "Timeout removed", group: "members", defaultEnabled: true },
  "member.nickname_changed": { label: "Nickname changed", group: "members", defaultEnabled: true },
  "member.roles_changed": { label: "Member roles changed", group: "members", defaultEnabled: true },

  "message.edited": { label: "Message edited", group: "messages", defaultEnabled: true },
  "message.deleted": { label: "Message deleted", group: "messages", defaultEnabled: true },
  "message.bulk_deleted": { label: "Messages bulk deleted", group: "messages", defaultEnabled: true },

  "role.created": { label: "Role created", group: "roles", defaultEnabled: true },
  "role.updated": { label: "Role changed", group: "roles", defaultEnabled: true },
  "role.deleted": { label: "Role deleted", group: "roles", defaultEnabled: true },

  "channel.created": { label: "Channel created", group: "channels", defaultEnabled: true },
  "channel.updated": { label: "Channel changed", group: "channels", defaultEnabled: true },
  "channel.deleted": { label: "Channel deleted", group: "channels", defaultEnabled: true },

  "server.updated": { label: "Server settings changed", group: "server", defaultEnabled: true },

  "invite.created": { label: "Invite created", group: "invites", defaultEnabled: false },
  "invite.deleted": { label: "Invite deleted", group: "invites", defaultEnabled: false },

  "voice.joined": { label: "Joined voice", group: "voice", defaultEnabled: false },
  "voice.left": { label: "Left voice", group: "voice", defaultEnabled: false },
  "voice.moved": { label: "Switched voice channel", group: "voice", defaultEnabled: false },
} as const satisfies Record<string, EventMeta>;

export type PlatformEventType = keyof typeof PLATFORM_EVENTS;

export const PLATFORM_EVENT_TYPES = Object.keys(PLATFORM_EVENTS) as PlatformEventType[];

export const PLATFORM_EVENT_LABELS = Object.fromEntries(
  PLATFORM_EVENT_TYPES.map((type) => [type, PLATFORM_EVENTS[type].label]),
) as Record<PlatformEventType, string>;

export function isPlatformEventType(value: string): value is PlatformEventType {
  return Object.prototype.hasOwnProperty.call(PLATFORM_EVENTS, value);
}

export function platformEventMeta(type: PlatformEventType): EventMeta {
  return PLATFORM_EVENTS[type];
}

export function platformEventTypesInGroup(group: PlatformEventGroup): PlatformEventType[] {
  return PLATFORM_EVENT_TYPES.filter((type) => PLATFORM_EVENTS[type].group === group);
}

export type UserDeletedReason = "requested" | "twitch_revoked";
export type StreamOnlineFailureReason = "stream_not_found" | "vod_not_found";
export type TicketEventSource = "discord" | "dashboard";

// ── Payloads ────────────────────────────────────────────────────────────────

/** Who a platform event is about. Every field is optional: older rows or a user without Twitch. */
interface SubjectIdentity {
  /** StreamWizard display name, only when there's no Twitch username. Never an email. */
  display_name?: string | null;
  twitch_username?: string | null;
  twitch_user_id?: string | null;
  discord_user_id?: string | null;
  /** Twitch profile picture, else the StreamWizard avatar. https only. */
  avatar_url?: string | null;
}

/** The admin behind a dashboard action, by Twitch username (users.name can hold an email). */
interface ActorIdentity {
  actor_twitch_username?: string | null;
  actor_avatar_url?: string | null;
}

interface SubscriptionFields {
  subscription_id?: string | null;
  product_id: string;
  plan_id: string;
  plan_name?: string | null;
  status?: string | null;
  expires_at?: string | null;
}

/** A Discord user as seen by the bot. */
export interface DiscordUserRef {
  id: string;
  username?: string | null;
  /** Server nickname or global display name. */
  display_name?: string | null;
  avatar_url?: string | null;
  bot?: boolean;
}

export interface DiscordChannelRef {
  id: string;
  name?: string | null;
  type?: string | null;
  parent_name?: string | null;
}

export interface DiscordRoleRef {
  id: string;
  name?: string | null;
  /** Hex, e.g. "#9146ff". */
  color?: string | null;
}

/** From the audit log. Null when the bot can't read it or found no entry. */
interface Moderation {
  moderator?: DiscordUserRef | null;
  reason?: string | null;
}

type Change<T = unknown> = { from: T; to: T };

/**
 * Every Discord server event. `discord_user_id` repeats `member.id` so the
 * dashboard and account deletion can match rows the same way as platform
 * events; the Twitch fields are set when the member linked StreamWizard.
 */
interface ServerEvent extends SubjectIdentity {
  guild_id: string;
}

interface MemberEvent extends ServerEvent {
  member: DiscordUserRef;
}

/** A ticket as the log sees it. `channel` is gone after close; the embed links the dashboard page. */
interface TicketEvent extends ServerEvent {
  ticket_id: string;
  ticket_number: number;
  /** Truncated to 100 characters. */
  subject: string;
  category: string;
  product?: string | null;
  opener: DiscordUserRef;
  channel: DiscordChannelRef;
  /** Where the action was taken: a Discord button, or the web-admin dashboard. */
  source: TicketEventSource;
  /** web-admin page for the ticket, when the bot knows the dashboard URL. */
  dashboard_url?: string | null;
}

export interface PlatformEventPayloads {
  "user.created": SubjectIdentity;
  "user.deleted": SubjectIdentity & { reason?: UserDeletedReason | null };
  "admin.role_granted": SubjectIdentity & { role: string };
  "admin.role_revoked": SubjectIdentity & { role: string };
  "feedback.submitted": SubjectIdentity & {
    feedback_id: string;
    title: string;
    category?: string | null;
    priority?: string | null;
    /** First 300 characters. */
    description?: string | null;
    /** The free-text contact field. Shown as plain text, never a mention. */
    contact?: string | null;
  };

  "clips.sync_started": SubjectIdentity & { sync_id: string; last_sync?: string | null };
  "clips.sync_completed": SubjectIdentity & { sync_id: string; clip_count: number; duration_seconds?: number | null };
  "clips.sync_failed": SubjectIdentity & { sync_id: string; duration_seconds?: number | null; error?: string | null };
  "twitch.token_refresh_failed": SubjectIdentity & { error: string; status?: number | null };
  "stream.online_failed": SubjectIdentity & { reason: StreamOnlineFailureReason; stream_id?: string | null };

  "ticket.opened": TicketEvent;
  "ticket.claimed": TicketEvent & { actor: DiscordUserRef };
  "ticket.closed": TicketEvent & {
    actor: DiscordUserRef;
    claimer?: DiscordUserRef | null;
    duration_seconds?: number | null;
    message_count?: number | null;
  };
  "ticket.replied": TicketEvent & { author_name: string };
  "discord.linked": SubjectIdentity & { discord_username?: string | null; previous_discord_user_id?: string | null };
  "discord.unlinked": SubjectIdentity;
  "subscription.granted": SubjectIdentity & ActorIdentity & SubscriptionFields & { replaced_plan_ids?: string[] };
  "subscription.changed": SubjectIdentity &
    ActorIdentity &
    SubscriptionFields & {
      changes: Record<string, { from: string | null; to: string | null }>;
    };
  "subscription.revoked": SubjectIdentity & ActorIdentity & SubscriptionFields;
  "discord_settings.changed": ActorIdentity & {
    guild_id: string;
    section: string;
    action: string;
    /** Changed fields only. Values are channel ids, role ids, flags and lists of those. */
    changes: Record<string, { from: unknown; to: unknown }>;
  };
  "log.test": ActorIdentity;

  "member.joined": MemberEvent & { account_created_at?: string | null; member_count?: number | null };
  "member.left": MemberEvent & { joined_at?: string | null; roles?: DiscordRoleRef[]; member_count?: number | null };
  "member.kicked": MemberEvent & Moderation & { joined_at?: string | null; roles?: DiscordRoleRef[] };
  "member.banned": MemberEvent & Moderation;
  "member.unbanned": MemberEvent & Moderation;
  "member.timed_out": MemberEvent & Moderation & { until: string };
  "member.timeout_removed": MemberEvent & Moderation;
  "member.nickname_changed": MemberEvent & Moderation & { before: string | null; after: string | null };
  "member.roles_changed": MemberEvent & Moderation & { added: DiscordRoleRef[]; removed: DiscordRoleRef[] };

  "message.edited": MemberEvent & {
    channel: DiscordChannelRef;
    message_id: string;
    url: string;
    /** Null when the old version wasn't cached. */
    before: string | null;
    after: string | null;
  };
  "message.deleted": ServerEvent &
    Moderation & {
      /** Missing when the message wasn't cached. */
      member?: DiscordUserRef | null;
      channel: DiscordChannelRef;
      message_id: string;
      content: string | null;
      attachments?: string[];
      sent_at?: string | null;
    };
  "message.bulk_deleted": ServerEvent &
    Moderation & {
      channel: DiscordChannelRef;
      count: number;
      /** Cached messages only, oldest first, as "name: text". */
      lines: string[];
    };

  "role.created": ServerEvent & Moderation & { role: DiscordRoleRef; permissions?: string[] };
  "role.updated": ServerEvent &
    Moderation & {
      role: DiscordRoleRef;
      changes: Record<string, Change>;
      permissions_added?: string[];
      permissions_removed?: string[];
    };
  "role.deleted": ServerEvent & Moderation & { role: DiscordRoleRef };

  "channel.created": ServerEvent & Moderation & { channel: DiscordChannelRef };
  "channel.updated": ServerEvent &
    Moderation & { channel: DiscordChannelRef; changes: Record<string, Change>; overwrites_changed?: boolean };
  "channel.deleted": ServerEvent & Moderation & { channel: DiscordChannelRef };

  "server.updated": ServerEvent & Moderation & { changes: Record<string, Change> };

  "invite.created": ServerEvent & {
    code: string;
    channel?: DiscordChannelRef | null;
    inviter?: DiscordUserRef | null;
    max_uses?: number | null;
    expires_at?: string | null;
    temporary?: boolean;
  };
  "invite.deleted": ServerEvent & { code: string; channel?: DiscordChannelRef | null };

  "voice.joined": MemberEvent & { channel: DiscordChannelRef };
  "voice.left": MemberEvent & { channel: DiscordChannelRef };
  "voice.moved": MemberEvent & { from: DiscordChannelRef; to: DiscordChannelRef };
}

export type PlatformEventStatus = "pending" | "delivered" | "skipped" | "failed";

export const PLATFORM_EVENT_STATUSES: readonly PlatformEventStatus[] = ["pending", "delivered", "skipped", "failed"];

export const PLATFORM_EVENT_STATUS_LABELS: Record<PlatformEventStatus, string> = {
  pending: "Pending",
  delivered: "Posted",
  skipped: "Skipped",
  failed: "Failed",
};
