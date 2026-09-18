"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getDiscordUserIdForUser, getGuildSettings, upsertGuildSettings } from "@repo/supabase/queries/discord";
import { assertChannel, assertRoleAssignable } from "@/lib/discord/api";
import { DashboardError, requireDiscordAdmin, toActionError, type DiscordActionResult } from "@/lib/discord/action";
import { recordChange } from "@/lib/discord/audit";
import { callBot } from "@/lib/discord/bot-bridge";
import { nullableSnowflakeSchema } from "@/schemas/discord";

const welcomeSchema = z.object({
  welcomeEnabled: z.boolean(),
  welcomeChannelId: nullableSnowflakeSchema,
  verifiedRoleId: nullableSnowflakeSchema,
  joinRoleId: nullableSnowflakeSchema,
});

export type WelcomeSettingsInput = z.infer<typeof welcomeSchema>;

export async function saveWelcomeSettings(input: WelcomeSettingsInput): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const parsed = welcomeSchema.safeParse(input);
    if (!parsed.success) throw new DashboardError(parsed.error.issues[0]?.message ?? "Invalid settings");
    const next = parsed.data;

    const current = await getGuildSettings(supabaseAdmin, guildId);
    // Only validate ids that changed, so a channel deleted in Discord doesn't
    // block saving an unrelated toggle.
    if (next.welcomeChannelId && next.welcomeChannelId !== current?.welcome_channel_id) {
      await assertChannel(next.welcomeChannelId, ["text"]);
    }
    if (next.verifiedRoleId && next.verifiedRoleId !== current?.verified_role_id) await assertRoleAssignable(next.verifiedRoleId);
    if (next.joinRoleId && next.joinRoleId !== current?.join_role_id) await assertRoleAssignable(next.joinRoleId);
    const before = {
      welcome_enabled: current?.welcome_enabled ?? true,
      welcome_channel_id: current?.welcome_channel_id ?? null,
      verified_role_id: current?.verified_role_id ?? null,
      join_role_id: current?.join_role_id ?? null,
    };
    const after = {
      welcome_enabled: next.welcomeEnabled,
      welcome_channel_id: next.welcomeChannelId,
      verified_role_id: next.verifiedRoleId,
      join_role_id: next.joinRoleId,
    };

    await upsertGuildSettings(supabaseAdmin, guildId, after);

    // Same as /setup: members verified under the old role move to the new
    // one, or they'd keep the old role forever. Clearing the role leaves
    // existing holders alone.
    let warning: string | null = null;
    if (before.verified_role_id && after.verified_role_id && before.verified_role_id !== after.verified_role_id) {
      const result = await callBot(guildId, "/verified-role", {
        oldRoleId: before.verified_role_id,
        newRoleId: after.verified_role_id,
      });
      if (!result.ok) {
        warning = `Saved, but the bot couldn't move members to the new verified role (${result.error}). Run /setup to retry.`;
      }
    }

    // Old welcomes (including test posts) get removed from the channel they
    // used to go to. The bot works out whether the channel really changed,
    // e.g. empty to the system channel picked explicitly is the same channel.
    if (before.welcome_channel_id !== after.welcome_channel_id) {
      const cleanup = await callBot(guildId, "/welcome-cleanup", { previousChannelId: before.welcome_channel_id });
      if (!cleanup.ok) {
        const note = `the bot couldn't remove old welcome messages (${cleanup.error})`;
        warning = warning ? `${warning} Also, ${note}.` : `Saved, but ${note}.`;
      }
    }

    await recordChange({ userId, guildId, section: "welcome", before, after });
    revalidatePath("/discord", "layout");
    return { error: null, warning };
  } catch (error) {
    return toActionError(error, "save welcome", "Couldn't save welcome settings. Try again?");
  }
}

export async function sendTestWelcome(): Promise<DiscordActionResult & { channelId?: string; welcomeEnabled?: boolean }> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const discordUserId = await getDiscordUserIdForUser(supabaseAdmin, userId);
    if (!discordUserId) {
      throw new DashboardError("Link your Discord account in StreamWizard first. The test welcome uses you as the new member.");
    }

    const result = await callBot<{ channelId: string; welcomeEnabled: boolean }>(guildId, "/test-welcome", { discordUserId });
    if (!result.ok) throw new DashboardError(result.error);

    await recordChange({ userId, guildId, section: "welcome", action: "test_welcome" });
    return { error: null, ...result.data };
  } catch (error) {
    return toActionError(error, "test welcome", "Couldn't send the test welcome. Try again?");
  }
}
