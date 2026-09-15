import type { Json } from "@repo/supabase";
import { reportError } from "@repo/sentry";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getDiscordUserIdForUser } from "@repo/supabase/queries/discord";
import { insertDiscordSettingsAudit } from "@repo/supabase/queries/discord-audit";
import { actorIdentity, logPlatformEvent } from "@/lib/platform-events";

// Server-only. One place to record dashboard changes: the audit row for the
// overview, and a discord_settings.changed event for the log channel (SW-334).

export type AuditSection = "welcome" | "activity" | "tickets" | "permissions" | "logs";
export type AuditAction = "update" | "repost_panel" | "test_welcome" | "test_log";

type Values = Record<string, Json | undefined>;

interface ChangeInput {
  userId: string;
  guildId: string;
  section: AuditSection;
  action?: AuditAction;
  before?: Values;
  after?: Values;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Stores only the fields that changed. An update that changed nothing isn't
 * recorded; actions always are. Never throws — a lost audit row shouldn't
 * fail a save that already landed.
 */
export async function recordChange({ userId, guildId, section, action = "update", before = {}, after = {} }: ChangeInput) {
  const changedKeys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (key) => !same(before[key], after[key]),
  );
  if (action === "update" && changedKeys.length === 0) return;

  const pick = (values: Values) =>
    Object.fromEntries(changedKeys.map((key) => [key, values[key] ?? null])) as { [key: string]: Json };

  try {
    const discordUserId = await getDiscordUserIdForUser(supabaseAdmin, userId);
    await insertDiscordSettingsAudit(supabaseAdmin, {
      guild_id: guildId,
      section,
      action,
      old_value: changedKeys.length ? pick(before) : null,
      new_value: changedKeys.length ? pick(after) : null,
      changed_by: userId,
      changed_by_discord_id: discordUserId,
    });
  } catch (error) {
    reportError(error, "web-admin discord: audit", { section, action });
  }

  // A test log event is its own entry in the log; don't announce it twice.
  if (action === "test_log") return;
  await logPlatformEvent({
    type: "discord_settings.changed",
    actorUserId: userId,
    payload: {
      ...(await actorIdentity(userId)),
      guild_id: guildId,
      section,
      action,
      changes: Object.fromEntries(changedKeys.map((key) => [key, { from: before[key] ?? null, to: after[key] ?? null }])),
    },
  });
}
