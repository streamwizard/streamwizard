import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { PlatformEvent } from "@repo/supabase/queries/platform-events";
import { PLATFORM_EVENT_LABELS, PLATFORM_EVENT_STATUS_LABELS, isPlatformEventType, type PlatformEventStatus } from "@repo/types";
import { Badge } from "@repo/ui";
import { DataList, type DataColumn } from "@/components/widgets/data-list";
import { formatDateTime } from "@/lib/discord/tickets";

// The rows of the event log. No hooks and no data fetching, so the log page
// (a server component) renders it as is.

const DESTRUCTIVE = new Set([
  "user.deleted",
  "user.banned",
  "discord.unlinked",
  "subscription.revoked",
  "eventsub.connection_lost",
  "eventsub.subscription_revoked",
  "eventsub.conduit_update_failed",
  "member.left",
  "member.kicked",
  "member.banned",
  "member.timed_out",
  "message.deleted",
  "message.bulk_deleted",
  "role.deleted",
  "channel.deleted",
]);

type Payload = Record<string, unknown>;

function payloadOf(event: PlatformEvent): Payload {
  return event.payload && typeof event.payload === "object" && !Array.isArray(event.payload) ? (event.payload as Payload) : {};
}

const str = (value: unknown) => (typeof value === "string" && value ? value : null);

function TwitchName({ username, id }: { username: string | null; id?: string | null }) {
  if (!username) return id ? <span className="font-mono text-xs">{id}</span> : null;
  return (
    <a
      href={`https://twitch.tv/${encodeURIComponent(username)}`}
      target="_blank"
      rel="noreferrer"
      className="font-medium underline-offset-4 hover:underline"
    >
      {username}
    </a>
  );
}

/** The StreamWizard user page, when the row knows the user. A deleted user has no page left to open. */
function userHref(event: PlatformEvent): string | null {
  return event.subject_user_id && event.event_type !== "user.deleted" ? `/users/${event.subject_user_id}` : null;
}

function UserLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}

type UserRef = { id?: unknown; username?: unknown; display_name?: unknown; avatar_url?: unknown };
const refOf = (value: unknown): UserRef | null => (value && typeof value === "object" && !Array.isArray(value) ? (value as UserRef) : null);

/** A Discord member on server events: avatar, name, @username, and the Twitch link when linked. */
function DiscordMember({ member, twitch, href }: { member: UserRef; twitch: string | null; href: string | null }) {
  const name = str(member.display_name) ?? str(member.username) ?? str(member.id) ?? "Unknown";
  return (
    <div className="flex items-center gap-2.5">
      <Avatar url={str(member.avatar_url)} />
      <div className="min-w-0 space-y-0.5">
        <div className="font-medium break-words">{href ? <UserLink href={href}>{name}</UserLink> : name}</div>
        <div className="text-xs break-words text-muted-foreground">
          {str(member.username) ? `@${member.username}` : str(member.id)}
          {twitch && (
            <>
              {" · "}
              <TwitchName username={twitch} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Subject({ event, payload }: { event: PlatformEvent; payload: Payload }) {
  const href = userHref(event);
  const member = refOf(payload.member);
  if (member) return <DiscordMember member={member} twitch={str(payload.twitch_username)} href={href} />;
  const twitch = str(payload.twitch_username);
  const twitchId = str(payload.twitch_user_id);
  const discord = str(payload.discord_user_id);
  // Users without Twitch: display name, else the StreamWizard user id.
  const fallback = !twitch && !twitchId ? (str(payload.display_name) ?? event.subject_user_id) : null;
  if (!twitch && !twitchId && !discord && !fallback) return <span className="text-muted-foreground">None</span>;
  return (
    <div className="flex items-center gap-2.5">
      <Avatar url={str(payload.avatar_url)} />
      <div className="min-w-0 space-y-0.5">
        {/* The name opens the user's page here; without a user it falls back to their Twitch channel. */}
        {href && (twitch || twitchId) ? (
          <UserLink href={href}>{twitch ?? <span className="font-mono text-xs">{twitchId}</span>}</UserLink>
        ) : (
          <TwitchName username={twitch} id={twitchId} />
        )}
        {fallback && (
          <div className={fallback === event.subject_user_id ? "font-mono text-xs break-all" : "font-medium"}>
            {href ? <UserLink href={href}>{fallback}</UserLink> : fallback}
          </div>
        )}
        {discord && <div className="font-mono text-xs text-muted-foreground">Discord {discord}</div>}
      </div>
    </div>
  );
}

function Avatar({ url, size = "size-8" }: { url: string | null; size?: string }) {
  if (!url?.startsWith("https://")) return <span className={`${size} shrink-0 rounded-full bg-muted`} aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element -- Twitch CDN avatar, same as the ticket page
  return <img src={url} alt="" className={`${size} shrink-0 rounded-full object-cover`} />;
}

function details(event: PlatformEvent, payload: Payload): string {
  switch (event.event_type) {
    case "subscription.granted":
    case "subscription.changed":
    case "subscription.revoked": {
      const plan = str(payload.plan_name) ?? str(payload.plan_id) ?? "Unknown plan";
      const changes = payload.changes && typeof payload.changes === "object" ? Object.keys(payload.changes) : [];
      return `${plan} (${str(payload.product_id) ?? "?"})${changes.length ? `: ${changes.join(", ")}` : ""}`;
    }
    case "discord_settings.changed": {
      const keys = payload.changes && typeof payload.changes === "object" ? Object.keys(payload.changes) : [];
      return `${str(payload.section) ?? "?"}: ${keys.length ? keys.join(", ") : (str(payload.action) ?? "")}`;
    }
    case "discord.linked":
      return str(payload.previous_discord_user_id) ? `Replaced ${payload.previous_discord_user_id}` : "";
    case "eventsub.connected":
    case "eventsub.session_migrated":
      return str(payload.session_id) ? `Session ${payload.session_id}` : "";
    case "eventsub.connection_lost":
      return [str(payload.reason), typeof payload.close_code === "number" ? `code ${payload.close_code}` : null]
        .filter(Boolean)
        .join(", ");
    case "eventsub.reconnected": {
      const seconds = typeof payload.downtime_ms === "number" ? Math.round(payload.downtime_ms / 1000) : null;
      const attempts = typeof payload.attempts === "number" ? `${payload.attempts} attempt${payload.attempts === 1 ? "" : "s"}` : null;
      return [seconds !== null ? `${seconds}s down` : null, attempts].filter(Boolean).join(", ");
    }
    case "eventsub.subscription_revoked":
      return [str(payload.subscription_type), str(payload.status)].filter(Boolean).join(" ");
    case "eventsub.conduit_update_failed":
      return snippet(payload.error) ?? "";
    default:
      return serverDetails(event, payload);
  }
}

const channelName = (value: unknown) => {
  const channel = refOf(value) as { name?: unknown; id?: unknown } | null;
  return channel ? `#${str(channel.name) ?? str(channel.id) ?? "?"}` : null;
};
/** Message text and error text are cut to this in the summary; "More" on the row has the rest. */
const SNIPPET_MAX = 80;
const isCut = (value: unknown) => (str(value)?.length ?? 0) > SNIPPET_MAX;
const snippet = (value: unknown) => {
  const text = str(value);
  return text ? `"${text.length > SNIPPET_MAX ? `${text.slice(0, SNIPPET_MAX - 1)}…` : text}"` : null;
};
const roleNames = (value: unknown) =>
  Array.isArray(value) ? value.map((role) => str(refOf(role)?.display_name) ?? str((role as { name?: unknown })?.name)).filter(Boolean).join(", ") : "";

function serverDetails(event: PlatformEvent, payload: Payload): string {
  const changes = payload.changes && typeof payload.changes === "object" ? Object.keys(payload.changes) : [];
  const parts: (string | null | undefined)[] = [];
  switch (event.event_type) {
    case "message.edited":
      parts.push(channelName(payload.channel), snippet(payload.after));
      break;
    case "message.deleted":
      parts.push(channelName(payload.channel), payload.text_purged ? "text removed" : (snippet(payload.content) ?? "text not cached"));
      break;
    case "message.bulk_deleted":
      parts.push(channelName(payload.channel), typeof payload.count === "number" ? `${payload.count} messages` : null);
      break;
    case "member.roles_changed": {
      const added = roleNames(payload.added);
      const removed = roleNames(payload.removed);
      parts.push(added ? `+ ${added}` : null, removed ? `- ${removed}` : null);
      break;
    }
    case "member.nickname_changed":
      parts.push(`${str(payload.before) ?? "none"} → ${str(payload.after) ?? "none"}`);
      break;
    case "member.timed_out":
      parts.push(str(payload.until) ? `until ${formatDateTime(payload.until as string)}` : null);
      break;
    case "role.created":
    case "role.updated":
    case "role.deleted":
      parts.push(str(refOf(payload.role) && (payload.role as { name?: unknown }).name), changes.join(", ") || null);
      break;
    case "channel.created":
    case "channel.updated":
    case "channel.deleted":
      parts.push(channelName(payload.channel), changes.join(", ") || null);
      break;
    case "server.updated":
      parts.push(changes.join(", ") || null);
      break;
    case "invite.created":
    case "invite.deleted":
      parts.push(str(payload.code) ? `discord.gg/${payload.code}` : null, channelName(payload.channel));
      break;
    case "voice.joined":
    case "voice.left":
      parts.push(channelName(payload.channel));
      break;
    case "voice.moved":
      parts.push(`${channelName(payload.from) ?? "?"} → ${channelName(payload.to) ?? "?"}`);
      break;
  }
  parts.push(str(payload.reason) ? `reason: ${payload.reason}` : null);
  return parts.filter(Boolean).join(" · ");
}

function deliveryOf(event: PlatformEvent) {
  const status = event.status as PlatformEventStatus;
  const retrying = status === "pending" && event.attempts > 0 && event.last_error;
  return {
    label: retrying ? `Retrying (${event.attempts})` : (PLATFORM_EVENT_STATUS_LABELS[status] ?? event.status),
    variant: status === "failed" ? ("destructive" as const) : status === "delivered" ? ("secondary" as const) : ("outline" as const),
  };
}

/**
 * What the row leaves out: text the summary had to cut, and the ids that used
 * to sit in hover titles. Shown behind "More", so a phone can read them too.
 */
function moreOf(event: PlatformEvent, payload: Payload): { label: string; value: string }[] {
  const rows: { label: string; value: string | null }[] = [];
  switch (event.event_type) {
    case "message.edited":
      if (isCut(payload.before) || isCut(payload.after)) {
        rows.push({ label: "Before", value: str(payload.before) }, { label: "After", value: str(payload.after) });
      }
      break;
    case "message.deleted":
      if (!payload.text_purged && isCut(payload.content)) rows.push({ label: "Message", value: str(payload.content) });
      break;
    case "eventsub.conduit_update_failed":
      if (isCut(payload.error)) rows.push({ label: "Error", value: str(payload.error) });
      break;
  }
  const member = refOf(payload.member);
  const moderator = refOf(payload.moderator) ?? refOf(payload.inviter);
  rows.push(
    // Without a member the Discord id is already on the row.
    { label: "Discord id", value: member ? str(member.id) : null },
    // Without a username the Twitch id is already shown as the name.
    { label: "Twitch id", value: str(payload.twitch_username) ? str(payload.twitch_user_id) : null },
    { label: "User id", value: event.subject_user_id },
    { label: "By, Discord id", value: moderator ? str(moderator.id) : null },
  );
  return rows.filter((row): row is { label: string; value: string } => !!row.value);
}

interface EventRow {
  event: PlatformEvent;
  payload: Payload;
  /** Twitch name of the admin behind it, when there is one. */
  actor: string | null;
  moderator: UserRef | null;
}

function EventDetails({ event, payload }: EventRow) {
  const summary = details(event, payload);
  const more = moreOf(event, payload);
  return (
    <div className="space-y-1">
      {summary ? <p className="break-words">{summary}</p> : more.length === 0 && <span className="sm:hidden">—</span>}
      {/* Why delivery failed or is retrying, as text: it used to sit in the badge's hover title. */}
      {event.last_error && <p className="text-xs break-words text-destructive">Delivery: {event.last_error}</p>}
      {more.length > 0 && (
        <details className="group -my-1.5 text-xs md:my-0">
          <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1 underline-offset-4 hover:underline md:min-h-6 [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" aria-hidden />
            More
          </summary>
          <dl className="space-y-1.5 pb-1">
            {more.map((row) => (
              <div key={row.label}>
                <dt className="font-medium text-foreground">{row.label}</dt>
                <dd className="break-words whitespace-pre-wrap">{row.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </div>
  );
}

const COLUMNS: DataColumn<EventRow>[] = [
  {
    key: "type",
    header: "Event",
    mobile: "title",
    // The event number rides along with the type: a column of its own cost the details their room.
    cell: ({ event }) => (
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:flex-col sm:items-start">
        <Badge variant={DESTRUCTIVE.has(event.event_type) ? "destructive" : "outline"}>
          {isPlatformEventType(event.event_type) ? PLATFORM_EVENT_LABELS[event.event_type] : event.event_type}
        </Badge>
        <span className="font-mono text-xs font-normal text-muted-foreground">#{event.id}</span>
      </span>
    ),
  },
  {
    key: "user",
    header: "User",
    className: "min-w-44 whitespace-normal",
    cell: ({ event, payload }) => <Subject event={event} payload={payload} />,
  },
  {
    key: "details",
    header: "Details",
    // Wraps instead of cutting off: there is no hover on a phone to read the rest.
    className: "max-w-md min-w-56 whitespace-normal text-muted-foreground",
    cell: (row) => <EventDetails {...row} />,
  },
  {
    key: "by",
    header: "By",
    cell: ({ event, payload, actor, moderator }) =>
      moderator ? (
        <span className="flex items-center gap-2">
          <Avatar url={str(moderator.avatar_url)} size="size-5" />
          <span>{str(moderator.display_name) ?? str(moderator.username) ?? "Unknown"}</span>
        </span>
      ) : actor ? (
        <span className="flex items-center gap-2">
          <Avatar url={str(payload.actor_avatar_url)} size="size-5" />
          <TwitchName username={actor} />
        </span>
      ) : event.actor_user_id ? (
        <span className="text-muted-foreground">Unknown</span>
      ) : (
        <span className="text-muted-foreground sm:hidden">—</span>
      ),
  },
  {
    key: "when",
    header: "When",
    className: "whitespace-nowrap text-muted-foreground tabular-nums",
    cell: ({ event }) => formatDateTime(event.created_at),
  },
  {
    key: "delivery",
    header: "Delivery",
    mobile: "badge",
    cell: ({ event }) => {
      const delivery = deliveryOf(event);
      return <Badge variant={delivery.variant}>{delivery.label}</Badge>;
    },
  },
];

/** Actors whose name isn't stored on the row (older rows), for the page to look up. */
export function actorIdsToLookUp(events: PlatformEvent[]): string[] {
  return events.filter((event) => event.actor_user_id && !str(payloadOf(event).actor_twitch_username)).map((event) => event.actor_user_id as string);
}

/** A table from 640px up, a card per event on a phone. `actorNames` maps user ids to Twitch names. */
export function EventLogList({ events, actorNames }: { events: PlatformEvent[]; actorNames: Map<string, string> }) {
  const rows: EventRow[] = events.map((event) => {
    const payload = payloadOf(event);
    return {
      event,
      payload,
      actor: str(payload.actor_twitch_username) ?? (event.actor_user_id ? (actorNames.get(event.actor_user_id) ?? null) : null),
      moderator: refOf(payload.moderator) ?? refOf(payload.inviter),
    };
  });

  return <DataList rows={rows} rowKey={(row) => String(row.event.id)} columns={COLUMNS} />;
}
