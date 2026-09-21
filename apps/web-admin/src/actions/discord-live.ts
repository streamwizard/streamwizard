"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getGuildSettings, upsertGuildSettings } from "@repo/supabase/queries/discord";
import { assertChannel, assertRoleAssignable, invalidateGuildRoles } from "@/lib/discord/api";
import { DashboardError, requireDiscordAdmin, toActionError, type DiscordActionResult } from "@/lib/discord/action";
import { recordChange } from "@/lib/discord/audit";
import { nullableSnowflakeSchema } from "@/schemas/discord";

const liveSchema = z.object({
  liveEnabled: z.boolean(),
  liveChannelId: nullableSnowflakeSchema,
  liveRoleId: nullableSnowflakeSchema,
});

export type LiveSettingsInput = z.infer<typeof liveSchema>;

/** Twitch purple, the same accent the go-live embed uses (docs/branding.md). */
const LIVE_ROLE_COLOR = 0x9146ff;

/**
 * Go-live posts and the live role (SW-336). rest-api reads these settings
 * straight from the database on every stream.online, so there is no bot
 * cache to invalidate. A role change is picked up by rest-api's next
 * reconciliation pass, which moves anyone currently live to the new role.
 */
export async function saveLiveSettings(input: LiveSettingsInput): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const parsed = liveSchema.safeParse(input);
    if (!parsed.success) throw new DashboardError(parsed.error.issues[0]?.message ?? "Invalid settings");
    const next = parsed.data;

    const current = await getGuildSettings(supabaseAdmin, guildId);
    // Only validate ids that changed, so a channel deleted in Discord doesn't
    // block saving an unrelated toggle.
    if (next.liveChannelId && next.liveChannelId !== current?.live_channel_id) {
      await assertChannel(next.liveChannelId, ["text", "announcement"]);
    }
    if (next.liveRoleId && next.liveRoleId !== current?.live_role_id) await assertRoleAssignable(next.liveRoleId);
    const before = {
      live_enabled: current?.live_enabled ?? false,
      live_channel_id: current?.live_channel_id ?? null,
      live_role_id: current?.live_role_id ?? null,
    };
    const after = {
      live_enabled: next.liveEnabled,
      live_channel_id: next.liveChannelId,
      live_role_id: next.liveRoleId,
    };

    await upsertGuildSettings(supabaseAdmin, guildId, after);
    await recordChange({ userId, guildId, section: "live", before, after });
    revalidatePath("/discord", "layout");
    return { error: null };
  } catch (error) {
    return toActionError(error, "save go-live", "Couldn't save go-live settings. Try again?");
  }
}

/**
 * Creates a hoisted "Live" role and picks it in one go. Discord puts a new
 * role at the bottom of the list, so the bot can always hand it out.
 */
export async function createLiveRole(): Promise<DiscordActionResult & { roleId?: string }> {
  try {
    const { userId, guildId, api } = await requireDiscordAdmin();

    const role = await api.guilds.createRole({
      name: "Live",
      color: LIVE_ROLE_COLOR,
      hoist: true,
      mentionable: false,
      reason: "StreamWizard live role, created from web-admin",
    });
    invalidateGuildRoles();

    const current = await getGuildSettings(supabaseAdmin, guildId);
    await upsertGuildSettings(supabaseAdmin, guildId, { live_role_id: role.id });
    await recordChange({
      userId,
      guildId,
      section: "live",
      action: "create",
      before: { live_role_id: current?.live_role_id ?? null },
      after: { live_role_id: role.id },
    });
    revalidatePath("/discord", "layout");
    return { error: null, roleId: role.id };
  } catch (error) {
    return toActionError(
      error,
      "create live role",
      "Couldn't create the role. Check the bot has Manage Roles, or make one in Discord and pick it here.",
    );
  }
}
