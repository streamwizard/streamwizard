"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import {
  addIgnoredChannel,
  getActivitySettings,
  getIgnoredChannelIds,
  removeIgnoredChannel,
  upsertActivitySettings,
} from "@repo/supabase/queries/discord-activity";
import { assertChannel } from "@/lib/discord/api";
import { DashboardError, requireDiscordAdmin, toActionError, type DiscordActionResult } from "@/lib/discord/action";
import { recordChange } from "@/lib/discord/audit";
import { callBot, staleWarning } from "@/lib/discord/bot-bridge";
import { snowflakeSchema } from "@/schemas/discord";

const activitySchema = z.object({
  trackingEnabled: z.boolean(),
  trackMessages: z.boolean(),
  trackReactions: z.boolean(),
  trackVoice: z.boolean(),
  voiceIgnoreAfk: z.boolean(),
  voiceRequireOthers: z.boolean(),
  ignoredChannelIds: z.array(snowflakeSchema).max(500),
});

export type ActivitySettingsInput = z.infer<typeof activitySchema>;

export async function saveActivitySettings(input: ActivitySettingsInput): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const parsed = activitySchema.safeParse(input);
    if (!parsed.success) throw new DashboardError(parsed.error.issues[0]?.message ?? "Invalid settings");
    const next = parsed.data;

    const [current, currentIgnored] = await Promise.all([
      getActivitySettings(supabaseAdmin, guildId),
      getIgnoredChannelIds(supabaseAdmin, guildId),
    ]);

    const wanted = [...new Set(next.ignoredChannelIds)];
    const toAdd = wanted.filter((id) => !currentIgnored.includes(id));
    const toRemove = currentIgnored.filter((id) => !wanted.includes(id));
    // New entries only: a stored channel that was since deleted in Discord
    // can still be removed, or kept, without failing the save.
    for (const id of toAdd) await assertChannel(id, ["text", "voice", "category"]);

    // No row means the bot runs on its defaults: everything on.
    const before = {
      tracking_enabled: current?.tracking_enabled ?? true,
      track_messages: current?.track_messages ?? true,
      track_reactions: current?.track_reactions ?? true,
      track_voice: current?.track_voice ?? true,
      voice_ignore_afk: current?.voice_ignore_afk ?? true,
      voice_require_others: current?.voice_require_others ?? true,
      ignored_channel_ids: [...currentIgnored].sort(),
    };
    const settings = {
      tracking_enabled: next.trackingEnabled,
      track_messages: next.trackMessages,
      track_reactions: next.trackReactions,
      track_voice: next.trackVoice,
      voice_ignore_afk: next.voiceIgnoreAfk,
      voice_require_others: next.voiceRequireOthers,
    };

    await upsertActivitySettings(supabaseAdmin, guildId, settings);
    await Promise.all([
      ...toAdd.map((id) => addIgnoredChannel(supabaseAdmin, guildId, id)),
      ...toRemove.map((id) => removeIgnoredChannel(supabaseAdmin, guildId, id)),
    ]);

    // Turning tracking (or voice tracking) off should close open voice
    // sessions now rather than on the next voice event.
    const trackingDisabled =
      (before.tracking_enabled && !settings.tracking_enabled) || (before.track_voice && !settings.track_voice);
    const bot = await callBot(guildId, "/cache/activity", { trackingDisabled });

    await recordChange({
      userId,
      guildId,
      section: "activity",
      before,
      after: { ...settings, ignored_channel_ids: [...wanted].sort() },
    });
    revalidatePath("/discord", "layout");
    return { error: null, warning: staleWarning(bot) };
  } catch (error) {
    return toActionError(error, "save activity", "Couldn't save activity settings. Try again?");
  }
}
