import Link from "next/link";
import { Settings } from "lucide-react";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import {
  getTwitchUsernames,
  listPlatformEvents,
  type PlatformEvent,
  type PlatformEventListFilters,
} from "@repo/supabase/queries/platform-events";
import {
  PLATFORM_EVENT_GROUPS,
  PLATFORM_EVENT_LABELS,
  PLATFORM_EVENT_STATUS_LABELS,
  PLATFORM_EVENT_STATUSES,
  PLATFORM_EVENT_TYPES,
  isPlatformEventType,
  platformEventTypesInGroup,
  type PlatformEventGroup,
  type PlatformEventStatus,
} from "@repo/types";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  NativeSelect,
  NativeSelectOption,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui";
import { PageHeader } from "@/components/widgets/page-header";
import { formatDateTime } from "@/lib/discord/tickets";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DESTRUCTIVE = new Set([
  "user.deleted",
  "discord.unlinked",
  "subscription.revoked",
  "member.left",
  "member.kicked",
  "member.banned",
  "member.timed_out",
  "message.deleted",
  "message.bulk_deleted",
  "role.deleted",
  "channel.deleted",
]);

type Params = { group?: string; type?: string; status?: string; from?: string; to?: string; page?: string };

const isGroup = (value?: string): value is PlatformEventGroup => PLATFORM_EVENT_GROUPS.some((group) => group.id === value);

type Payload = Record<string, unknown>;

function parseFilters(params: Params): PlatformEventListFilters {
  return {
    type: params.type && isPlatformEventType(params.type) ? params.type : undefined,
    types: isGroup(params.group) ? platformEventTypesInGroup(params.group) : undefined,
    status: PLATFORM_EVENT_STATUSES.includes(params.status as PlatformEventStatus) ? (params.status as PlatformEventStatus) : undefined,
    from: params.from && DATE.test(params.from) ? `${params.from}T00:00:00.000Z` : undefined,
    to: params.to && DATE.test(params.to) ? `${params.to}T23:59:59.999Z` : undefined,
  };
}

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
      title={id ?? undefined}
    >
      {username}
    </a>
  );
}

type UserRef = { id?: unknown; username?: unknown; display_name?: unknown; avatar_url?: unknown };
const refOf = (value: unknown): UserRef | null => (value && typeof value === "object" && !Array.isArray(value) ? (value as UserRef) : null);

/** A Discord member on server events: avatar, name, @username, and the Twitch link when linked. */
function DiscordMember({ member, twitch }: { member: UserRef; twitch: string | null }) {
  const name = str(member.display_name) ?? str(member.username) ?? str(member.id) ?? "Unknown";
  return (
    <div className="flex items-center gap-2.5">
      <Avatar url={str(member.avatar_url)} />
      <div className="min-w-0 space-y-0.5">
        <div className="truncate font-medium" title={str(member.id) ?? undefined}>
          {name}
        </div>
        <div className="truncate text-xs text-muted-foreground">
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
  const member = refOf(payload.member);
  if (member) return <DiscordMember member={member} twitch={str(payload.twitch_username)} />;
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
        <TwitchName username={twitch} id={twitchId} />
        {fallback && (
          <div className={fallback === event.subject_user_id ? "font-mono text-xs" : "font-medium"} title={event.subject_user_id ?? undefined}>
            {fallback}
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
    default:
      return serverDetails(event, payload);
  }
}

const channelName = (value: unknown) => {
  const channel = refOf(value) as { name?: unknown; id?: unknown } | null;
  return channel ? `#${str(channel.name) ?? str(channel.id) ?? "?"}` : null;
};
const snippet = (value: unknown) => {
  const text = str(value);
  return text ? `"${text.length > 80 ? `${text.slice(0, 79)}…` : text}"` : null;
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

function Delivery({ event }: { event: PlatformEvent }) {
  const status = event.status as PlatformEventStatus;
  const retrying = status === "pending" && event.attempts > 0 && event.last_error;
  const label = retrying ? `Retrying (${event.attempts})` : (PLATFORM_EVENT_STATUS_LABELS[status] ?? event.status);
  const variant = status === "failed" ? "destructive" : status === "delivered" ? "secondary" : "outline";
  return (
    <Badge variant={variant} title={event.last_error ?? undefined}>
      {label}
    </Badge>
  );
}

export default async function DiscordLogPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const { events, total } = await listPlatformEvents(supabaseAdmin, parseFilters(params), page, PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Older rows or actors without a stored name: look them up.
  const actorNames = await getTwitchUsernames(
    supabaseAdmin,
    events.filter((e) => e.actor_user_id && !str(payloadOf(e).actor_twitch_username)).map((e) => e.actor_user_id as string)
  );
  const filtered = Object.entries(params).some(([key, value]) => key !== "page" && value);

  const pageHref = (target: number) => {
    const next = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    next.set("page", String(target));
    return `/discord/logs?${next}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Log" description="Platform and Discord server events, including ones the bot skipped.">
        <Button variant="outline" size="sm" asChild>
          <Link href="/discord/logs/settings">
            <Settings className="size-4" aria-hidden />
            Settings
          </Link>
        </Button>
      </PageHeader>

      <form method="get" className="flex flex-wrap items-center gap-2 [&_[data-slot=native-select-wrapper]]:w-full sm:[&_[data-slot=native-select-wrapper]]:w-auto">
        <NativeSelect name="group" defaultValue={params.group ?? ""} aria-label="Group" className="w-full sm:w-44">
          <NativeSelectOption value="">Any group</NativeSelectOption>
          {PLATFORM_EVENT_GROUPS.map((group) => (
            <NativeSelectOption key={group.id} value={group.id}>
              {group.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect name="type" defaultValue={params.type ?? ""} aria-label="Event type" className="w-full sm:w-56">
          <NativeSelectOption value="">Any event</NativeSelectOption>
          {PLATFORM_EVENT_TYPES.map((type) => (
            <NativeSelectOption key={type} value={type}>
              {PLATFORM_EVENT_LABELS[type]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect name="status" defaultValue={params.status ?? ""} aria-label="Delivery" className="w-full sm:w-40">
          <NativeSelectOption value="">Any delivery</NativeSelectOption>
          {PLATFORM_EVENT_STATUSES.map((status) => (
            <NativeSelectOption key={status} value={status}>
              {PLATFORM_EVENT_STATUS_LABELS[status]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <span className="flex w-full items-center gap-2 sm:w-auto">
          <Input name="from" type="date" defaultValue={params.from} aria-label="From" className="flex-1 sm:w-40" />
          <span className="text-sm text-muted-foreground">to</span>
          <Input name="to" type="date" defaultValue={params.to} aria-label="Until" className="flex-1 sm:w-40" />
        </span>
        <Button type="submit" size="sm">
          Filter
        </Button>
        {filtered && (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/discord/logs">Clear filters</Link>
          </Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground tabular-nums">
          {total} event{total === 1 ? "" : "s"}
        </span>
      </form>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Event</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>By</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Delivery</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => {
                const payload = payloadOf(event);
                const actor = str(payload.actor_twitch_username) ?? (event.actor_user_id ? actorNames.get(event.actor_user_id) : null);
                const moderator = refOf(payload.moderator) ?? refOf(payload.inviter);
                return (
                  <TableRow key={event.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">#{event.id}</TableCell>
                    <TableCell>
                      <Badge variant={DESTRUCTIVE.has(event.event_type) ? "destructive" : "outline"}>
                        {isPlatformEventType(event.event_type) ? PLATFORM_EVENT_LABELS[event.event_type] : event.event_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Subject event={event} payload={payload} />
                    </TableCell>
                    <TableCell className="max-w-72 truncate text-muted-foreground">{details(event, payload)}</TableCell>
                    <TableCell className="truncate">
                      {moderator ? (
                        <span className="flex items-center gap-2" title={str(moderator.id) ?? undefined}>
                          <Avatar url={str(moderator.avatar_url)} size="size-5" />
                          <span className="truncate">{str(moderator.display_name) ?? str(moderator.username) ?? "Unknown"}</span>
                        </span>
                      ) : actor ? (
                        <span className="flex items-center gap-2">
                          <Avatar url={str(payload.actor_avatar_url)} size="size-5" />
                          <TwitchName username={actor} />
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{event.actor_user_id ? "Unknown" : ""}</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">{formatDateTime(event.created_at)}</TableCell>
                    <TableCell>
                      <Delivery event={event} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {events.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="p-8 text-center text-muted-foreground">
                    {filtered ? "No events match these filters." : "Nothing logged yet. Sign-ups and Discord links show up here."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {pages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          <Button variant="outline" size="sm" asChild={page > 1} disabled={page <= 1}>
            {page > 1 ? <Link href={pageHref(page - 1)}>Newer</Link> : <span>Newer</span>}
          </Button>
          <span className="text-muted-foreground tabular-nums">
            Page {page} of {pages}
          </span>
          <Button variant="outline" size="sm" asChild={page < pages} disabled={page >= pages}>
            {page < pages ? <Link href={pageHref(page + 1)}>Older</Link> : <span>Older</span>}
          </Button>
        </nav>
      )}
    </div>
  );
}
