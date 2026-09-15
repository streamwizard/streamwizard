"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isPlatformEventType, platformEventMeta } from "@repo/types";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { emitPlatformEvent, getLogRouting, saveLogRouting, type LogEventRoute } from "@repo/supabase/queries/platform-events";
import { assertChannel } from "@/lib/discord/api";
import { DashboardError, requireDiscordAdmin, toActionError, type DiscordActionResult } from "@/lib/discord/action";
import { recordChange } from "@/lib/discord/audit";
import { callBot } from "@/lib/discord/bot-bridge";
import { actorIdentity } from "@/lib/platform-events";
import { nullableSnowflakeSchema, snowflakeSchema } from "@/schemas/discord";

const logSettingsSchema = z.object({
  defaultChannelId: nullableSnowflakeSchema,
  ignoredChannelIds: z.array(snowflakeSchema).max(100),
  events: z.record(
    z.string().refine((type) => isPlatformEventType(type), "Unknown event type"),
    z.object({ enabled: z.boolean(), channelId: nullableSnowflakeSchema })
  ),
});

export interface LogSettingsInput {
  defaultChannelId: string | null;
  ignoredChannelIds: string[];
  events: Record<string, LogEventRoute>;
}

/** Only what differs from a type's defaults gets a row, so defaults can change later. */
function overrides(events: LogSettingsInput["events"]): Record<string, LogEventRoute> {
  return Object.fromEntries(
    Object.entries(events).filter(([type, route]) => {
      if (!isPlatformEventType(type)) return false;
      const meta = platformEventMeta(type);
      return route.channelId !== null || (!meta.alwaysOn && route.enabled !== meta.defaultEnabled);
    })
  );
}

export async function saveLogSettings(input: LogSettingsInput): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const parsed = logSettingsSchema.safeParse(input);
    if (!parsed.success) throw new DashboardError(parsed.error.issues[0]?.message ?? "Invalid settings");
    const next = { ...parsed.data, events: overrides(parsed.data.events) };

    const current = await getLogRouting(supabaseAdmin, guildId);
    const knownChannels = new Set(
      [current.defaultChannelId, ...Object.values(current.events).map((route) => route?.channelId)].filter(Boolean)
    );
    // Only validate channels that are new, so one deleted in Discord doesn't block unrelated saves.
    const picked = new Set([next.defaultChannelId, ...Object.values(next.events).map((route) => route.channelId)]);
    for (const channelId of picked) {
      if (channelId && !knownChannels.has(channelId)) await assertChannel(channelId, ["text"]);
    }

    await saveLogRouting(supabaseAdmin, guildId, next);

    const result = await callBot(guildId, "/cache/log-settings", {});
    const warning = result.ok ? null : `Saved. The bot picks it up within a minute (${result.error}).`;

    const sortedEvents = (events: Partial<Record<string, LogEventRoute>>) =>
      Object.fromEntries(
        Object.entries(events)
          .filter((entry): entry is [string, LogEventRoute] => !!entry[1])
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([type, route]) => [type, { enabled: route.enabled, channel_id: route.channelId }])
      );
    await recordChange({
      userId,
      guildId,
      section: "logs",
      before: {
        log_channel_id: current.defaultChannelId,
        log_ignored_channel_ids: [...current.ignoredChannelIds].sort(),
        log_event_settings: sortedEvents(current.events),
      },
      after: {
        log_channel_id: next.defaultChannelId,
        log_ignored_channel_ids: [...next.ignoredChannelIds].sort(),
        log_event_settings: sortedEvents(next.events),
      },
    });
    revalidatePath("/discord", "layout");
    return { error: null, warning };
  } catch (error) {
    return toActionError(error, "save log settings", "Couldn't save log settings. Try again?");
  }
}

/** Queues a log.test event, so the whole path (database, bot, channel) gets exercised. */
export async function sendTestLogEvent(): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const routing = await getLogRouting(supabaseAdmin, guildId);
    const channelId = routing.events["log.test"]?.channelId ?? routing.defaultChannelId;
    if (!channelId) throw new DashboardError("Pick a default log channel and save first.");

    const { error } = await emitPlatformEvent(supabaseAdmin, {
      type: "log.test",
      actorUserId: userId,
      payload: await actorIdentity(userId),
    });
    if (error) throw error;

    await recordChange({ userId, guildId, section: "logs", action: "test_log" });
    revalidatePath("/discord/logs");
    return { error: null };
  } catch (error) {
    return toActionError(error, "test log event", "Couldn't send the test event. Try again?");
  }
}
