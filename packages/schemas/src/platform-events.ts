/**
 * Platform events (SW-334): the feed posted to the StreamWizard Discord log
 * channels and stored in `platform_events`. Two kinds share it:
 *   - platform events (signups, Discord links, plans, dashboard changes)
 *   - Discord server events the bot sees on the gateway (joins, bans,
 *     message edits and deletes, role and channel changes, ...)
 *
 * Adding an event type: add it to PLATFORM_EVENTS here and its payload to
 * PlatformEventPayloads in `@repo/types/platform-events`, emit it
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
  | "eventsub"
  | "tickets"
  | "content"
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
  {
    id: "eventsub",
    label: "EventSub",
    hint: "The bot's Twitch EventSub connection: outages, reconnects, session moves and revoked subscriptions.",
  },
  { id: "tickets", label: "Tickets", hint: "Tickets opened, claimed, closed, rated and replied to from the dashboard." },
  { id: "content", label: "Blog and guides", hint: "Posts and guides published, scheduled, updated, taken down or moved to the trash." },
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
  "user.banned": { label: "User banned", group: "platform", defaultEnabled: true },
  "user.unbanned": { label: "User unbanned", group: "platform", defaultEnabled: true },
  "user.twitch_conflict": { label: "Twitch account already linked", group: "platform", defaultEnabled: true },
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

  "eventsub.connected": { label: "EventSub connected", group: "eventsub", defaultEnabled: true },
  "eventsub.connection_lost": { label: "EventSub connection lost", group: "eventsub", defaultEnabled: true },
  "eventsub.reconnected": { label: "EventSub reconnected", group: "eventsub", defaultEnabled: true },
  "eventsub.session_migrated": { label: "EventSub session moved by Twitch", group: "eventsub", defaultEnabled: false },
  "eventsub.subscription_revoked": { label: "EventSub subscription revoked", group: "eventsub", defaultEnabled: true },
  "eventsub.conduit_update_failed": { label: "EventSub conduit update failed", group: "eventsub", defaultEnabled: true },

  "ticket.opened": { label: "Ticket opened", group: "tickets", defaultEnabled: true },
  "ticket.claimed": { label: "Ticket claimed", group: "tickets", defaultEnabled: true },
  "ticket.closed": { label: "Ticket closed", group: "tickets", defaultEnabled: true },
  "ticket.replied": { label: "Ticket reply from dashboard", group: "tickets", defaultEnabled: true },
  "ticket.updated": { label: "Ticket changed by staff", group: "tickets", defaultEnabled: false },
  "ticket.feedback": { label: "Ticket rated by the opener", group: "tickets", defaultEnabled: true },

  "content.published": { label: "Post published", group: "content", defaultEnabled: true },
  "content.updated": { label: "Live post updated", group: "content", defaultEnabled: true },
  "content.unpublished": { label: "Post unpublished", group: "content", defaultEnabled: true },
  "content.archived": { label: "Post archived", group: "content", defaultEnabled: true },
  "content.trashed": { label: "Post moved to the trash", group: "content", defaultEnabled: true },
  "content.scheduled": { label: "Post scheduled", group: "content", defaultEnabled: true },
  "content.unscheduled": { label: "Schedule cancelled", group: "content", defaultEnabled: true },
  "content.schedule_failed": { label: "Scheduled publish failed", group: "content", defaultEnabled: true },

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

export type PlatformEventStatus = "pending" | "delivered" | "skipped" | "failed";

export const PLATFORM_EVENT_STATUSES: readonly PlatformEventStatus[] = ["pending", "delivered", "skipped", "failed"];

export const PLATFORM_EVENT_STATUS_LABELS: Record<PlatformEventStatus, string> = {
  pending: "Pending",
  delivered: "Posted",
  skipped: "Skipped",
  failed: "Failed",
};
