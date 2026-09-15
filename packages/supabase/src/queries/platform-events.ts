import {
  isPlatformEventType,
  platformEventMeta,
  type PlatformEventPayloads,
  type PlatformEventStatus,
  type PlatformEventType,
} from "@repo/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../types/supabase";

// Platform event log (SW-334). Every emitter and the bot's delivery worker go
// through here; the event types and payload shapes live in @repo/types.

type DBClient = SupabaseClient<Database>;

export type PlatformEvent = Database["public"]["Tables"]["platform_events"]["Row"];

export type EmitPlatformEventInput = {
  [T in PlatformEventType]: {
    type: T;
    payload: PlatformEventPayloads[T];
    subjectUserId?: string | null;
    actorUserId?: string | null;
  };
}[PlatformEventType];

/**
 * Queues an event for the log channel and the dashboard viewer. Needs a
 * service-role client. Never throws, because the action that caused the
 * event has already happened; callers report the returned error.
 */
export async function emitPlatformEvent(
  client: DBClient,
  event: EmitPlatformEventInput,
): Promise<{ error: Error | null }> {
  try {
    const { data, error } = await client.rpc("emit_platform_event", {
      p_event_type: event.type,
      p_payload: event.payload as Json,
      p_subject_user_id: event.subjectUserId ?? undefined,
      p_actor_user_id: event.actorUserId ?? undefined,
    });
    if (error) return { error: new Error(error.message) };
    // The SQL function swallows insert errors (so triggers never fail) and returns NULL.
    if (data === null) return { error: new Error(`emit_platform_event(${event.type}) did not insert a row`) };
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }
}

/** Claims up to `limit` due events and leases them for `leaseSeconds`. */
export async function claimPlatformEvents(
  client: DBClient,
  limit: number,
  leaseSeconds: number,
): Promise<PlatformEvent[]> {
  const { data, error } = await client.rpc("claim_platform_events", { p_limit: limit, p_lease_seconds: leaseSeconds });
  if (error) throw error;
  return data ?? [];
}

export type PlatformEventOutcome =
  | { status: "delivered"; discordMessageId: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

export async function completePlatformEvent(
  client: DBClient,
  id: number,
  outcome: PlatformEventOutcome,
): Promise<void> {
  const { error } = await client.rpc("complete_platform_event", {
    p_id: id,
    p_status: outcome.status,
    p_discord_message_id: outcome.status === "delivered" ? outcome.discordMessageId : undefined,
    p_error: outcome.status === "skipped" ? outcome.reason : outcome.status === "failed" ? outcome.error : undefined,
  });
  if (error) throw error;
}

export async function releasePlatformEventLocks(client: DBClient): Promise<number> {
  const { data, error } = await client.rpc("release_platform_event_locks");
  if (error) throw error;
  return data ?? 0;
}

export interface LogEventRoute {
  enabled: boolean;
  /** Null: the default log channel. */
  channelId: string | null;
}

/** Where each event type goes for one guild. `events` holds overrides only. */
export interface LogRouting {
  guildId: string;
  defaultChannelId: string | null;
  ignoredChannelIds: string[];
  events: Partial<Record<string, LogEventRoute>>;
}

/** The effective route: the per-event override, else the type's default and the default channel. */
export function resolveLogRoute(routing: LogRouting, type: string): { enabled: boolean; channelId: string | null } {
  const meta = isPlatformEventType(type) ? platformEventMeta(type) : null;
  const override = routing.events[type];
  const enabled = meta?.alwaysOn ? true : (override?.enabled ?? meta?.defaultEnabled ?? true);
  return { enabled, channelId: override?.channelId ?? routing.defaultChannelId };
}

/**
 * Whether an event of this type would actually be posted: turned on, and a
 * channel to post to. The bot checks this before storing server events, so a
 * guild with settings but no log channel doesn't accumulate message text.
 */
export function isLogRouteActive(routing: LogRouting | null | undefined, type: string): boolean {
  if (!routing) return false;
  const route = resolveLogRoute(routing, type);
  return route.enabled && !!route.channelId;
}

async function loadRoutings(client: DBClient, guildId?: string): Promise<LogRouting[]> {
  let settingsQuery = client.from("discord_guild_settings").select("guild_id, log_channel_id, log_ignored_channel_ids");
  let eventsQuery = client.from("discord_log_event_settings").select("guild_id, event_type, enabled, channel_id");
  if (guildId) {
    settingsQuery = settingsQuery.eq("guild_id", guildId);
    eventsQuery = eventsQuery.eq("guild_id", guildId);
  }
  const [settings, events] = await Promise.all([settingsQuery.order("updated_at", { ascending: false }), eventsQuery]);
  if (settings.error) throw settings.error;
  if (events.error) throw events.error;

  const routings = new Map<string, LogRouting>();
  const routingFor = (id: string) => {
    let routing = routings.get(id);
    if (!routing) {
      routing = { guildId: id, defaultChannelId: null, ignoredChannelIds: [], events: {} };
      routings.set(id, routing);
    }
    return routing;
  };
  for (const row of settings.data) {
    const routing = routingFor(row.guild_id);
    routing.defaultChannelId = row.log_channel_id;
    routing.ignoredChannelIds = row.log_ignored_channel_ids;
  }
  for (const row of events.data) {
    routingFor(row.guild_id).events[row.event_type] = { enabled: row.enabled, channelId: row.channel_id };
  }
  return [...routings.values()];
}

export async function getLogRouting(client: DBClient, guildId: string): Promise<LogRouting> {
  const [routing] = await loadRoutings(client, guildId);
  return routing ?? { guildId, defaultChannelId: null, ignoredChannelIds: [], events: {} };
}

/** Routing for every guild with settings. The bot only serves the StreamWizard server, so in practice one. */
export async function listLogRoutings(client: DBClient): Promise<LogRouting[]> {
  return loadRoutings(client);
}

/**
 * Saves the whole log configuration for a guild. Event rows are replaced:
 * types left out fall back to their defaults.
 */
export async function saveLogRouting(
  client: DBClient,
  guildId: string,
  config: { defaultChannelId: string | null; ignoredChannelIds: string[]; events: Record<string, LogEventRoute> },
): Promise<void> {
  const { error: settingsError } = await client
    .from("discord_guild_settings")
    .upsert(
      { guild_id: guildId, log_channel_id: config.defaultChannelId, log_ignored_channel_ids: config.ignoredChannelIds },
      { onConflict: "guild_id" },
    );
  if (settingsError) throw settingsError;

  const rows = Object.entries(config.events).map(([event_type, route]) => ({
    guild_id: guildId,
    event_type,
    enabled: route.enabled,
    channel_id: route.channelId,
    updated_at: new Date().toISOString(),
  }));
  const keep = rows.map((row) => row.event_type);
  let remove = client.from("discord_log_event_settings").delete().eq("guild_id", guildId);
  if (keep.length) remove = remove.not("event_type", "in", `(${keep.map((t) => `"${t}"`).join(",")})`);
  const { error: deleteError } = await remove;
  if (deleteError) throw deleteError;
  if (rows.length) {
    const { error } = await client
      .from("discord_log_event_settings")
      .upsert(rows, { onConflict: "guild_id,event_type" });
    if (error) throw error;
  }
}

export interface PlatformEventListFilters {
  type?: PlatformEventType;
  /** Any of these types (a group filter). Ignored when `type` is set. */
  types?: PlatformEventType[];
  status?: PlatformEventStatus;
  /** ISO timestamps, inclusive, on created_at. */
  from?: string;
  to?: string;
}

export async function listPlatformEvents(
  client: DBClient,
  filters: PlatformEventListFilters,
  page: number,
  pageSize: number,
): Promise<{ events: PlatformEvent[]; total: number }> {
  let query = client.from("platform_events").select("*", { count: "exact" });

  if (filters.type) query = query.eq("event_type", filters.type);
  else if (filters.types?.length) query = query.in("event_type", filters.types);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", filters.to);

  const start = (page - 1) * pageSize;
  const { data, error, count } = await query.order("id", { ascending: false }).range(start, start + pageSize - 1);
  if (error) throw error;
  return { events: data, total: count ?? 0 };
}

export interface PlatformEventIdentity {
  display_name: string | null;
  avatar_url: string | null;
  twitch_username: string | null;
  twitch_user_id: string | null;
  discord_user_id: string | null;
}

/**
 * The PII-minimal identity events carry for a user: Twitch username and id,
 * Discord id. Users without Twitch (admin-made accounts) get their display
 * name instead, unless it's an email: users.name falls back to the email at
 * signup.
 */
export async function getPlatformEventIdentity(client: DBClient, userId: string): Promise<PlatformEventIdentity> {
  const [twitch, discord, user] = await Promise.all([
    client
      .from("integrations_twitch")
      .select("twitch_username, twitch_user_id, profile_image_url")
      .eq("user_id", userId)
      .maybeSingle(),
    client.from("integrations_discord").select("discord_user_id").eq("user_id", userId).maybeSingle(),
    client.from("users").select("name, avatar_url").eq("id", userId).maybeSingle(),
  ]);
  if (twitch.error) throw twitch.error;
  if (discord.error) throw discord.error;
  if (user.error) throw user.error;
  const name = user.data?.name?.trim();
  return {
    display_name: !twitch.data && name && !name.includes("@") ? name : null,
    avatar_url: twitch.data?.profile_image_url ?? user.data?.avatar_url ?? null,
    twitch_username: twitch.data?.twitch_username ?? null,
    twitch_user_id: twitch.data?.twitch_user_id ?? null,
    discord_user_id: discord.data?.discord_user_id ?? null,
  };
}

/**
 * Identity by Twitch id, for emitters that only know the broadcaster (EventSub
 * handlers, the token refresh). `userId` is null when no account has that
 * Twitch id; the identity then carries just the Twitch id.
 */
export async function getPlatformEventIdentityByTwitchUserId(
  client: DBClient,
  twitchUserId: string,
): Promise<{ userId: string | null; identity: PlatformEventIdentity }> {
  const { data, error } = await client
    .from("integrations_twitch")
    .select("user_id")
    .eq("twitch_user_id", twitchUserId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return {
      userId: null,
      identity: {
        display_name: null,
        avatar_url: null,
        twitch_username: null,
        twitch_user_id: twitchUserId,
        discord_user_id: null,
      },
    };
  }
  return { userId: data.user_id, identity: await getPlatformEventIdentity(client, data.user_id) };
}

/** Twitch usernames for a set of user ids, for showing actors in the viewer. */
export async function getTwitchUsernames(client: DBClient, userIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return new Map();
  const { data, error } = await client
    .from("integrations_twitch")
    .select("user_id, twitch_username")
    .in("user_id", ids);
  if (error) throw error;
  return new Map(data.map((row) => [row.user_id, row.twitch_username]));
}
