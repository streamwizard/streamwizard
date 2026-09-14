import type { Json } from "@repo/supabase";
import { reportError } from "@repo/sentry";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getDiscordUserIdForUser } from "@repo/supabase/queries/discord";
import { insertDiscordSettingsAudit } from "@repo/supabase/queries/discord-audit";

// Server-only. One place to record dashboard changes, so posting them to the
// StreamWizard log channel (SW-334) can hook in here later.

export type AuditSection = "welcome" | "activity" | "tickets" | "permissions";
export type AuditAction = "update" | "repost_panel" | "test_welcome";

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
}
