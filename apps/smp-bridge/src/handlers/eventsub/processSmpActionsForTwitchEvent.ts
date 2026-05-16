import { supabase } from "@repo/supabase";
import { getSmpActionsByTrigger } from "@repo/supabase/queries/smp";
import type { EventSubSubscriptionType } from "@repo/types";
import customLogger from "@/lib/logger";
import type { SmpBridgeHandlerContext } from "../eventHandler";

type EventPayload = Record<string, unknown>;

type SmpActionRow = {
  id: string;
  action: string;
  name: string;
  metadata: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const list = value.filter((item): item is string => typeof item === "string");
  return list.length === value.length ? list : undefined;
}

function normalizeTier(value: unknown): "1" | "2" | "3" | "prime" | undefined {
  if (typeof value === "number") {
    if (value === 1000 || value === 1) return "1";
    if (value === 2000 || value === 2) return "2";
    if (value === 3000 || value === 3) return "3";
    return undefined;
  }

  if (typeof value !== "string") return undefined;

  const normalized = value.trim().toLowerCase();
  if (normalized === "1000" || normalized === "1" || normalized === "tier1")
    return "1";
  if (normalized === "2000" || normalized === "2" || normalized === "tier2")
    return "2";
  if (normalized === "3000" || normalized === "3" || normalized === "tier3")
    return "3";
  if (normalized === "prime" || normalized === "primegaming") return "prime";

  return undefined;
}

async function executeActionFromRow(
  row: SmpActionRow,
  event: EventPayload,
  context: SmpBridgeHandlerContext,
): Promise<void> {
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  const options = isRecord(metadata.options) ? metadata.options : {};
  const subscriberName =
    asString(event.user_name) ??
    asString(event.user_login) ??
    asString(event.chatter_user_name) ??
    "Someone";

  switch (row.action) {
    case "event.launce": {
      await context.minecraftActions.Events.launcePlayer();
      return;
    }
    case "event.random_mob_spawn": {
      await context.minecraftActions.Events.randomMobSpawn({
        viewer_list: asStringArray(options.viewer_list) ?? [],
        mob_list: asStringArray(options.mob_list) ?? [],
        amount: asNumber(options.amount) ?? 1,
        viewer_name: asString(options.viewer_name) ?? subscriberName,
      });
      return;
    }
    case "event.celebration_alert": {
      const eventTier = normalizeTier(event.tier);
      const optionTier = normalizeTier(options.tier);
      const title = asString(options.title) ?? "New Subscriber";
      const subtitle =
        asString(options.subtitle) ?? `${subscriberName} just subscribed!`;

      await context.minecraftActions.Events.celebrationAlert({
        title,
        subtitle,
        subscriber_name: asString(options.subscriber_name) ?? subscriberName,
        tier: optionTier ?? eventTier ?? "1",
        duration: asNumber(options.duration),
        fireworks: asNumber(options.fireworks),
        intensity:
          options.intensity === "low" ||
          options.intensity === "normal" ||
          options.intensity === "high" ||
          options.intensity === "extreme"
            ? options.intensity
            : undefined,
        show_chat:
          typeof options.show_chat === "boolean"
            ? options.show_chat
            : undefined,
        show_title:
          typeof options.show_title === "boolean"
            ? options.show_title
            : undefined,
        broadcast:
          typeof options.broadcast === "boolean"
            ? options.broadcast
            : undefined,
        message: asString(options.message),
        volume: asNumber(options.volume),
      });
      return;
    }
    default: {
      customLogger.warn(
        `Unsupported SMP event action '${row.action}' in smp_actions (${row.id})`,
      );
    }
  }
}

export async function processSmpActionsForTwitchEvent(
  eventType: EventSubSubscriptionType,
  event: EventPayload,
  _broadcasterId: string,
  context: SmpBridgeHandlerContext,
): Promise<void> {
  console.log("Processing SMP actions for Twitch event:", eventType);
  let actionRows: SmpActionRow[];
  try {
    actionRows = (await getSmpActionsByTrigger(supabase, eventType)) as SmpActionRow[];
  } catch (error) {
    customLogger.error(
      `Failed to load smp_actions for '${eventType}': ${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  }

  if (!actionRows.length) return;

  console.log("Matching rows:", actionRows);

  for (const row of actionRows) {
    try {
      await executeActionFromRow(row, event, context);
      customLogger.info(
        `Executed SMP action '${row.action}' for '${eventType}'`,
      );
    } catch (actionError) {
      customLogger.error(
        `Failed executing SMP action '${row.action}' (${row.id}): ${actionError}`,
      );
    }
  }
}
