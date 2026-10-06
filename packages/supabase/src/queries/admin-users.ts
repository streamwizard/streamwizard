import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

// web-admin's /users pages. Service-role reads across every user; never
// selects token columns (the integrations carry encrypted tokens) beyond
// turning "has a token" into a boolean.

/** Plan statuses that still grant access. Matches LIVE_SUBSCRIPTION_FILTER in subscriptions.ts. */
const LIVE_STATUSES = ["active", "trialing", "past_due"] as const;

export type UserListFilter = "paying" | "admin" | "discord" | "no_twitch";
export type UserListSort = "newest" | "oldest" | "name";

export interface UserListFilters {
  /** Name, email, Twitch username or an exact id (StreamWizard, Twitch or Discord). */
  search?: string;
  filter?: UserListFilter;
  sort?: UserListSort;
}

export interface UserListRow {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
  roles: string[];
  twitch: { userId: string; username: string; profileImageUrl: string | null; broadcasterType: string | null } | null;
  discord: { userId: string; username: string } | null;
  plans: { planName: string; productId: string; status: string }[];
  isLive: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGITS = /^\d{5,20}$/;

/** PostgREST `or` values are comma separated; strip what would break the filter. */
const orSafe = (value: string) => value.replace(/[,()*\\]/g, " ").trim();

async function liveSubscriberIds(client: DBClient): Promise<string[]> {
  const { data, error } = await client.from("user_subscriptions").select("user_id").in("status", [...LIVE_STATUSES]);
  if (error) throw error;
  return [...new Set(data.map((row) => row.user_id))];
}

/** User ids a search term points at through Twitch or Discord. */
async function searchLinkedIds(client: DBClient, term: string): Promise<string[]> {
  const safe = orSafe(term);
  if (!safe) return [];
  const exact = DIGITS.test(safe);
  const [twitch, discord] = await Promise.all([
    client
      .from("integrations_twitch")
      .select("user_id")
      .or(exact ? `twitch_user_id.eq.${safe},twitch_username.ilike.%${safe}%` : `twitch_username.ilike.%${safe}%`)
      .limit(200),
    client
      .from("integrations_discord")
      .select("user_id")
      .or(exact ? `discord_user_id.eq.${safe},discord_username.ilike.%${safe}%` : `discord_username.ilike.%${safe}%`)
      .limit(200),
  ]);
  if (twitch.error) throw twitch.error;
  if (discord.error) throw discord.error;
  return [...new Set([...twitch.data, ...discord.data].map((row) => row.user_id))];
}

async function linkedUserIds(client: DBClient, table: "integrations_twitch" | "integrations_discord"): Promise<string[]> {
  const { data, error } = await client.from(table).select("user_id");
  if (error) throw error;
  return data.map((row) => row.user_id);
}

// integrations_twitch/_discord have no FK to public.users (only to auth.users),
// so PostgREST can't embed them: filters and the page's links are separate reads.
export async function listUsers(
  client: DBClient,
  filters: UserListFilters,
  page: number,
  pageSize: number,
): Promise<{ users: UserListRow[]; total: number }> {
  const admin = filters.filter === "admin";
  let query = client
    .from("users")
    .select(`id, name, email, avatar_url, created_at, ${admin ? "user_roles!inner(role)" : "user_roles(role)"}`, { count: "exact" });

  if (admin) query = query.eq("user_roles.role", "admin");
  if (filters.filter === "paying" || filters.filter === "discord") {
    const ids = filters.filter === "paying" ? await liveSubscriberIds(client) : await linkedUserIds(client, "integrations_discord");
    if (!ids.length) return { users: [], total: 0 };
    query = query.in("id", ids);
  }
  if (filters.filter === "no_twitch") {
    const ids = await linkedUserIds(client, "integrations_twitch");
    if (ids.length) query = query.not("id", "in", `(${ids.join(",")})`);
  }

  const search = filters.search?.trim();
  if (search) {
    if (UUID.test(search)) {
      query = query.eq("id", search);
    } else {
      const safe = orSafe(search);
      const linked = await searchLinkedIds(client, search);
      const clauses = [`name.ilike.%${safe}%`, `email.ilike.%${safe}%`];
      if (linked.length) clauses.push(`id.in.(${linked.join(",")})`);
      query = query.or(clauses.join(","));
    }
  }

  const sort = filters.sort ?? "newest";
  query = sort === "name" ? query.order("name") : query.order("created_at", { ascending: sort === "oldest" });

  const start = (page - 1) * pageSize;
  const { data, error, count } = await query.range(start, start + pageSize - 1);
  if (error) throw error;
  const rows = data as unknown as {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    created_at: string;
    user_roles: { role: string }[];
  }[];
  if (!rows.length) return { users: [], total: count ?? 0 };

  const userIds = rows.map((row) => row.id);
  const [twitch, discord, subs] = await Promise.all([
    client
      .from("integrations_twitch")
      .select("user_id, twitch_user_id, twitch_username, profile_image_url, broadcaster_type")
      .in("user_id", userIds),
    client.from("integrations_discord").select("user_id, discord_user_id, discord_username").in("user_id", userIds),
    client
      .from("user_subscriptions")
      .select("user_id, status, plans(name, product_id)")
      .in("user_id", userIds)
      .in("status", [...LIVE_STATUSES]),
  ]);
  for (const result of [twitch, discord, subs]) if (result.error) throw result.error;

  const twitchByUser = new Map((twitch.data ?? []).map((row) => [row.user_id, row]));
  const discordByUser = new Map((discord.data ?? []).map((row) => [row.user_id, row]));
  const twitchIds = [...twitchByUser.values()].map((row) => row.twitch_user_id);
  const live = twitchIds.length
    ? await client.from("broadcaster_live_status").select("broadcaster_id").in("broadcaster_id", twitchIds).eq("is_live", true)
    : { data: [], error: null };
  if (live.error) throw live.error;
  const liveIds = new Set((live.data ?? []).map((row) => row.broadcaster_id));

  const plansByUser = new Map<string, UserListRow["plans"]>();
  for (const sub of subs.data ?? []) {
    const plan = Array.isArray(sub.plans) ? sub.plans[0] : sub.plans;
    const list = plansByUser.get(sub.user_id) ?? [];
    list.push({ planName: plan?.name ?? "Unknown plan", productId: plan?.product_id ?? "", status: sub.status });
    plansByUser.set(sub.user_id, list);
  }

  return {
    total: count ?? 0,
    users: rows.map((row) => {
      const t = twitchByUser.get(row.id);
      const d = discordByUser.get(row.id);
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        avatarUrl: row.avatar_url,
        createdAt: row.created_at,
        roles: row.user_roles.map((r) => r.role),
        twitch: t
          ? { userId: t.twitch_user_id, username: t.twitch_username, profileImageUrl: t.profile_image_url, broadcasterType: t.broadcaster_type }
          : null,
        discord: d ? { userId: d.discord_user_id, username: d.discord_username } : null,
        plans: plansByUser.get(row.id) ?? [],
        isLive: !!t && liveIds.has(t.twitch_user_id),
      };
    }),
  };
}

export interface UserListStats {
  total: number;
  paying: number;
  admins: number;
  discordLinked: number;
}

export async function getUserListStats(client: DBClient): Promise<UserListStats> {
  const [total, payingIds, admins, discord] = await Promise.all([
    client.from("users").select("id", { count: "exact", head: true }),
    liveSubscriberIds(client),
    client.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "admin"),
    client.from("integrations_discord").select("id", { count: "exact", head: true }),
  ]);
  if (total.error) throw total.error;
  if (admins.error) throw admins.error;
  if (discord.error) throw discord.error;
  return { total: total.count ?? 0, paying: payingIds.length, admins: admins.count ?? 0, discordLinked: discord.count ?? 0 };
}

// ── One user ────────────────────────────────────────────────────────────────

export interface AdminUserSubscription {
  id: string;
  status: string;
  currentPeriodEnd: string | null;
  grantNote: string | null;
  /** Admin who granted it; null for a Stripe subscription. */
  grantedBy: string | null;
  stripeSubscriptionId: string | null;
  createdAt: string;
  updatedAt: string;
  plan: { id: string; name: string; product: { id: string; name: string } };
}

export interface AdminUserDetail {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
  roles: string[];
  twitch: {
    userId: string;
    username: string;
    profileImageUrl: string | null;
    broadcasterType: string | null;
    description: string | null;
    scopes: string[] | null;
    scopesSyncedAt: string | null;
    tokenExpiresAt: string | null;
    hasToken: boolean;
    linkedAt: string;
  } | null;
  discord: {
    userId: string;
    username: string;
    avatar: string | null;
    serverId: string | null;
    tokenExpiresAt: string | null;
    linkedAt: string;
  } | null;
  subscriptions: AdminUserSubscription[];
  live: {
    isLive: boolean;
    title: string | null;
    category: string | null;
    startedAt: string | null;
    endedAt: string | null;
  } | null;
  preferences: {
    onboardingCompleted: boolean;
    discordLiveNotifications: boolean;
    discordLiveRole: boolean;
    syncClipsOnEnd: boolean;
  } | null;
}

/** Everything the user header and tabs share. Null when no such user. */
export async function getAdminUser(client: DBClient, userId: string): Promise<AdminUserDetail | null> {
  const [user, roles, twitch, discord, subs, prefs] = await Promise.all([
    client.from("users").select("id, name, email, avatar_url, created_at").eq("id", userId).maybeSingle(),
    client.from("user_roles").select("role").eq("user_id", userId),
    client
      .from("integrations_twitch")
      .select(
        "twitch_user_id, twitch_username, profile_image_url, broadcaster_type, description, twitch_scopes, scopes_synced_at, token_expires_at, access_token_ciphertext, created_at",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    client
      .from("integrations_discord")
      .select("discord_user_id, discord_username, avatar, server_id, token_expires_at, created_at")
      .eq("user_id", userId)
      .maybeSingle(),
    client
      .from("user_subscriptions")
      .select(
        "id, status, current_period_end, grant_note, granted_by, stripe_subscription_id, created_at, updated_at, plans(id, name, products(id, name))",
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
    client
      .from("user_preferences")
      .select("onboarding_completed, discord_live_notifications, discord_live_role, sync_clips_on_end")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  for (const result of [user, roles, twitch, discord, subs, prefs]) if (result.error) throw result.error;
  if (!user.data) return null;

  let live: AdminUserDetail["live"] = null;
  if (twitch.data) {
    const { data, error } = await client
      .from("broadcaster_live_status")
      .select("is_live, title, category_name, stream_started_at, stream_ended_at")
      .eq("broadcaster_id", twitch.data.twitch_user_id)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      live = {
        isLive: data.is_live,
        title: data.title,
        category: data.category_name,
        startedAt: data.stream_started_at,
        endedAt: data.stream_ended_at,
      };
    }
  }

  return {
    id: user.data.id,
    name: user.data.name,
    email: user.data.email,
    avatarUrl: user.data.avatar_url,
    createdAt: user.data.created_at,
    roles: (roles.data ?? []).map((r) => r.role),
    twitch: twitch.data
      ? {
          userId: twitch.data.twitch_user_id,
          username: twitch.data.twitch_username,
          profileImageUrl: twitch.data.profile_image_url,
          broadcasterType: twitch.data.broadcaster_type,
          description: twitch.data.description,
          scopes: twitch.data.twitch_scopes,
          scopesSyncedAt: twitch.data.scopes_synced_at,
          tokenExpiresAt: twitch.data.token_expires_at,
          hasToken: !!twitch.data.access_token_ciphertext,
          linkedAt: twitch.data.created_at,
        }
      : null,
    discord: discord.data
      ? {
          userId: discord.data.discord_user_id,
          username: discord.data.discord_username,
          avatar: discord.data.avatar,
          serverId: discord.data.server_id,
          tokenExpiresAt: discord.data.token_expires_at,
          linkedAt: discord.data.created_at,
        }
      : null,
    subscriptions: (subs.data ?? []).map((sub) => {
      const plan = Array.isArray(sub.plans) ? sub.plans[0] : sub.plans;
      const product = plan && (Array.isArray(plan.products) ? plan.products[0] : plan.products);
      return {
        id: sub.id,
        status: sub.status,
        currentPeriodEnd: sub.current_period_end,
        grantNote: sub.grant_note,
        grantedBy: sub.granted_by,
        stripeSubscriptionId: sub.stripe_subscription_id,
        createdAt: sub.created_at,
        updatedAt: sub.updated_at,
        plan: {
          id: plan?.id ?? "",
          name: plan?.name ?? "Unknown plan",
          product: { id: product?.id ?? "", name: product?.name ?? "Unknown product" },
        },
      };
    }),
    live,
    preferences: prefs.data
      ? {
          onboardingCompleted: prefs.data.onboarding_completed,
          discordLiveNotifications: prefs.data.discord_live_notifications,
          discordLiveRole: prefs.data.discord_live_role,
          syncClipsOnEnd: prefs.data.sync_clips_on_end,
        }
      : null,
  };
}

export interface AdminUserUsage {
  obsInstances: { id: string; status: string; resolution: string; nodeId: string; createdAt: string }[];
  overlayScenes: number;
  clips: number;
  clipSync: { status: string; clipCount: number; lastSync: string; lastError: string | null } | null;
  storageBytes: number;
}

export async function getAdminUserUsage(client: DBClient, userId: string): Promise<AdminUserUsage> {
  const [obs, scenes, clips, sync, storage] = await Promise.all([
    client.from("obs_instances").select("id, status, resolution, node_id, created_at").eq("user_id", userId),
    client.from("overlay_scenes").select("id", { count: "exact", head: true }).eq("user_id", userId),
    client.from("clips").select("id", { count: "exact", head: true }).eq("user_id", userId),
    client.from("twitch_clip_syncs").select("sync_status, clip_count, last_sync, last_error").eq("user_id", userId).maybeSingle(),
    client.from("user_storage_usage").select("used_bytes").eq("user_id", userId).maybeSingle(),
  ]);
  for (const result of [obs, scenes, clips, sync, storage]) if (result.error) throw result.error;
  return {
    obsInstances: (obs.data ?? []).map((row) => ({
      id: row.id,
      status: row.status,
      resolution: row.resolution,
      nodeId: row.node_id,
      createdAt: row.created_at,
    })),
    overlayScenes: scenes.count ?? 0,
    clips: clips.count ?? 0,
    clipSync: sync.data
      ? { status: sync.data.sync_status, clipCount: sync.data.clip_count, lastSync: sync.data.last_sync, lastError: sync.data.last_error }
      : null,
    storageBytes: storage.data?.used_bytes ?? 0,
  };
}

/** Tickets the user opened, by account or by their linked Discord id. Newest first. */
export async function listUserTickets(client: DBClient, userId: string, discordUserId: string | null, limit = 100) {
  const clauses = [`opener_user_id.eq.${userId}`];
  if (discordUserId && DIGITS.test(discordUserId)) clauses.push(`opener_discord_user_id.eq.${discordUserId}`);
  const { data, error } = await client
    .from("discord_tickets")
    .select("id, ticket_number, subject, status, category, product, priority, created_at, closed_at, close_code, claimed_by_name, last_message_at")
    .or(clauses.join(","))
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export type UserActivitySource = "platform" | "system" | "stream";

export interface UserActivityRow {
  id: string;
  source: UserActivitySource;
  type: string;
  status: string;
  createdAt: string;
  /** Platform events: whether this user did it (admin action) rather than had it done to them. */
  asActor?: boolean;
  error?: string | null;
  detail: unknown;
}

/**
 * One page of the user's activity from one source: platform_events by subject
 * or actor, system_events and stream_events by their Twitch id.
 */
export async function listUserActivity(
  client: DBClient,
  source: UserActivitySource,
  ids: { userId: string; twitchUserId: string | null },
  page: number,
  pageSize: number,
): Promise<{ rows: UserActivityRow[]; total: number }> {
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  if (source === "platform") {
    const { data, error, count } = await client
      .from("platform_events")
      .select("id, event_type, status, created_at, actor_user_id, subject_user_id, payload, last_error", { count: "exact" })
      .or(`subject_user_id.eq.${ids.userId},actor_user_id.eq.${ids.userId}`)
      .order("id", { ascending: false })
      .range(start, end);
    if (error) throw error;
    return {
      total: count ?? 0,
      rows: data.map((row) => ({
        id: String(row.id),
        source,
        type: row.event_type,
        status: row.status,
        createdAt: row.created_at,
        asActor: row.actor_user_id === ids.userId && row.subject_user_id !== ids.userId,
        error: row.last_error,
        detail: row.payload,
      })),
    };
  }

  if (!ids.twitchUserId) return { rows: [], total: 0 };

  if (source === "system") {
    const { data, error, count } = await client
      .from("system_events")
      .select("id, event_type, status, created_at, error_message, event_data", { count: "exact" })
      .eq("broadcaster_id", ids.twitchUserId)
      .order("created_at", { ascending: false })
      .range(start, end);
    if (error) throw error;
    return {
      total: count ?? 0,
      rows: data.map((row) => ({
        id: row.id,
        source,
        type: row.event_type,
        status: row.status,
        createdAt: row.created_at,
        error: row.error_message,
        detail: row.event_data,
      })),
    };
  }

  const { data, error, count } = await client
    .from("stream_events")
    .select("id, event_type, status, created_at, event_data", { count: "exact" })
    .eq("broadcaster_id", ids.twitchUserId)
    .order("created_at", { ascending: false })
    .range(start, end);
  if (error) throw error;
  return {
    total: count ?? 0,
    rows: data.map((row) => ({
      id: row.id,
      source,
      type: row.event_type,
      status: row.status,
      createdAt: row.created_at,
      detail: row.event_data,
    })),
  };
}

/** Server membership, live role and recent go-live posts for a linked Discord account. */
export async function getUserDiscordState(
  client: DBClient,
  userId: string,
  discordUserId: string,
  guildId: string | null,
) {
  const [member, liveRole, posts] = await Promise.all([
    guildId
      ? client
          .from("discord_guild_members")
          .select("join_number, joined_at")
          .eq("guild_id", guildId)
          .eq("user_id", discordUserId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    client.from("discord_live_roles").select("role_id, granted_at, broadcaster_id").eq("discord_user_id", discordUserId).maybeSingle(),
    client
      .from("discord_live_posts")
      .select("id, channel_id, message_id, title, game_name, started_at, ended_at")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(10),
  ]);
  for (const result of [member, liveRole, posts]) if (result.error) throw result.error;
  return { member: member.data, liveRole: liveRole.data, livePosts: posts.data ?? [] };
}

/** Ends every session the user has (admin_revoke_user_sessions). Returns how many. */
export async function revokeUserSessions(client: DBClient, userId: string): Promise<number> {
  const { data, error } = await client.rpc("admin_revoke_user_sessions", { p_user_id: userId });
  if (error) throw error;
  return data ?? 0;
}

/** Cloud OBS instances that still have a container up, which a deletion would orphan. */
export async function countActiveObsInstances(client: DBClient, userId: string): Promise<number> {
  const { count, error } = await client
    .from("obs_instances")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["creating", "running"]);
  if (error) throw error;
  return count ?? 0;
}
