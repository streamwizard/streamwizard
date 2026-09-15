import { PermissionFlagsBits, type AuditLogEvent, type Guild, type GuildAuditLogsEntry } from "discord.js";
import type { DiscordUserRef } from "@repo/types";
import { userRef } from "./refs";

// Who did it, from the audit log. Discord writes the entry a moment after the
// gateway event, so this waits briefly before looking. Best effort: without
// View Audit Log, or when no recent entry matches, it returns null and the
// embed says the moderator is unknown.

const AUDIT_DELAY_MS = 1500;
const DEFAULT_WINDOW_MS = 10_000;

let warnedMissingPermission = false;

export interface AuditMatch {
  moderator: DiscordUserRef | null;
  reason: string | null;
  /** The bot itself did it (ticket channels, join roles, panel reposts). Callers skip these. */
  bySelf: boolean;
}

interface MatchOptions {
  targetId?: string | null;
  /** For message and member-move entries, `extra.channel`. */
  channelId?: string | null;
  withinMs?: number;
  /** Extra check on the entry, e.g. that a MemberUpdate entry touched timeouts. */
  where?: (entry: GuildAuditLogsEntry) => boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Pure matcher, exported for tests. */
export function matchAuditEntry<T extends Pick<GuildAuditLogsEntry, "createdTimestamp" | "targetId" | "extra">>(
  entries: Iterable<T>,
  options: MatchOptions & { now: number; where?: (entry: T) => boolean },
): T | null {
  const within = options.withinMs ?? DEFAULT_WINDOW_MS;
  for (const entry of entries) {
    if (options.now - entry.createdTimestamp > within) continue;
    if (options.targetId && entry.targetId !== options.targetId) continue;
    if (options.channelId) {
      const extra = entry.extra as { channel?: { id?: string } } | null;
      if (extra?.channel?.id !== options.channelId) continue;
    }
    if (options.where && !options.where(entry)) continue;
    return entry;
  }
  return null;
}

export async function findAuditEntry(
  guild: Guild,
  type: AuditLogEvent,
  options: MatchOptions = {},
): Promise<AuditMatch | null> {
  if (!guild.members.me?.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
    if (!warnedMissingPermission) {
      warnedMissingPermission = true;
      console.warn(
        "[server-log] The bot can't view the audit log; moderators show as unknown. Give its role View Audit Log.",
      );
    }
    return null;
  }

  await sleep(AUDIT_DELAY_MS);
  const logs = await guild.fetchAuditLogs({ type, limit: 6 }).catch(() => null);
  if (!logs) return null;

  const entry = matchAuditEntry(logs.entries.values(), { ...options, now: Date.now() });
  if (!entry) return null;
  const executor =
    entry.executor ?? (entry.executorId ? await guild.client.users.fetch(entry.executorId).catch(() => null) : null);
  const member = executor ? guild.members.cache.get(executor.id) : null;
  return {
    moderator: userRef(executor, member),
    reason: entry.reason ?? null,
    bySelf: executor?.id === guild.client.user?.id,
  };
}
