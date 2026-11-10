"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sendDiscordChannelMessage, sendDiscordDirectMessage } from "@repo/discord-api";
import { sendTelegramMessage } from "@repo/telegram-api";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import {
  getAlertNotificationConfigs,
  upsertAlertNotificationConfig,
} from "@repo/supabase/queries/alerts/notification-config";
import { resolveRoute } from "@repo/alerting/notify";
import type { Env } from "@repo/alerting/types";
import { snowflakeSchema } from "@repo/schemas/ids";
import { toActionError, type ActionResult } from "@/lib/actions/action-error";
import { requireAdmin } from "@/lib/auth/admin-context";
import { env } from "@/lib/env";
import { alertEnvSchema, severityGateSchema } from "@/schemas/alerts";
import type { TestSendResult } from "@/types/alerts";

/** A trimmed optional field: blank means "fall back to the env var". */
const optionalId = (schema: z.ZodType<string, string>) =>
  z
    .string()
    .trim()
    .max(100)
    .nullable()
    .transform((value) => value || null)
    .pipe(schema.nullable());

const notificationConfigSchema = z.object({
  env: alertEnvSchema,
  /** Channel ID or (for target 'dm') user ID; null = fall back to the env var. */
  discordChannelId: optionalId(snowflakeSchema),
  discordTarget: z.enum(["channel", "dm"]),
  discordSeverity: severityGateSchema,
  /** A numeric chat id (groups are negative) or an @channel name. */
  telegramChatId: optionalId(z.string()),
  telegramSeverity: severityGateSchema,
});

const testSendSchema = z.object({ env: alertEnvSchema, channel: z.enum(["discord", "telegram"]) });

export async function saveNotificationConfig(input: z.input<typeof notificationConfigSchema>): Promise<ActionResult> {
  try {
    const userId = await requireAdmin();
    const parsed = notificationConfigSchema.safeParse(input);
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0];
      if (field === "discordChannelId") return { error: "That Discord ID isn't a Discord ID. Copy it again from Discord." };
      if (field === "telegramChatId") return { error: "That Telegram chat ID is too long." };
      return { error: "Pick an environment, a target and a severity for each channel." };
    }
    const config = parsed.data;

    await upsertAlertNotificationConfig(supabaseAdmin, {
      env: config.env,
      discord_channel_id: config.discordChannelId,
      discord_target: config.discordTarget,
      discord_severity: config.discordSeverity,
      telegram_chat_id: config.telegramChatId,
      telegram_severity: config.telegramSeverity,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    });

    revalidatePath("/alerts/notifications");
    return { error: null };
  } catch (error) {
    return toActionError(error, "alerts.save-notifications", "Couldn't save. Try again?");
  }
}

/** Fire a test message through the SAVED config for an env — proves tokens,
 * addresses, and permissions before a real alert needs them. */
export async function sendTestNotification(alertEnv: Env, channel: "discord" | "telegram"): Promise<TestSendResult> {
  try {
    await requireAdmin();
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "Not authorized" };
  }
  const parsed = testSendSchema.safeParse({ env: alertEnv, channel });
  if (!parsed.success) return { ok: false, detail: "Pick an environment and Discord or Telegram." };
  return sendTest(parsed.data.env, parsed.data.channel);
}

async function sendTest(alertEnv: Env, channel: "discord" | "telegram"): Promise<TestSendResult> {
  let route = resolveRoute(alertEnv);
  try {
    const rows = await getAlertNotificationConfigs(supabaseAdmin);
    route = resolveRoute(alertEnv, rows.find((r) => r.env === alertEnv) ?? null);
  } catch {
    // fall through with env/code defaults
  }

  try {
    if (channel === "discord") {
      if (!env.DISCORD_BOT_TOKEN) return { ok: false, detail: "DISCORD_BOT_TOKEN is not set on this deployment" };
      if (!route.discordId)
        return {
          ok: false,
          detail: route.discordTarget === "dm" ? "No Discord user ID configured" : "No Discord channel ID configured (table or env)",
        };
      const payload = {
        embeds: [
          {
            title: `🧪 [${alertEnv}] Test notification`,
            description: "Sent from the StreamWizard monitor notifications page. If you can read this, the pipe works.",
            color: 0x3b82f6,
          },
        ],
      };
      if (route.discordTarget === "dm") {
        await sendDiscordDirectMessage(route.discordId, payload);
        return { ok: true, detail: `DM sent to user ${route.discordId}` };
      }
      await sendDiscordChannelMessage(route.discordId, payload);
      return { ok: true, detail: `Sent to channel ${route.discordId}` };
    }

    if (!env.TELEGRAM_BOT_TOKEN) return { ok: false, detail: "TELEGRAM_BOT_TOKEN is not set on this deployment" };
    if (!route.telegramChatId) return { ok: false, detail: "No Telegram chat ID configured (table or env)" };
    await sendTelegramMessage(`🧪 <b>[${alertEnv}] Test notification</b>\nSent from the StreamWizard monitor.`, {
      chatId: route.telegramChatId,
    });
    return { ok: true, detail: `Sent to chat ${route.telegramChatId}` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}
