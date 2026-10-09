import type { EventMap } from "@repo/posthog/server";

/**
 * What the rendered overlay may report about itself, and nothing more.
 *
 * The page that sends this holds the subscriber token, and so does anyone the
 * streamer ever showed the overlay URL to. So the body is treated as hostile:
 * every field is checked against a shape, every number is clamped, and which
 * overlay and which account it belongs to never comes from here at all — the
 * route takes both from the token.
 */

/** Seconds between heartbeats. Sent back on every answer so it can be changed, or stopped, without waiting for OBS to reload a page it may keep open for weeks. */
export const HEARTBEAT_SECONDS = 300;

const CLIENTS = ["obs", "browser", "embed"] as const;
const IDENTIFIER = /^[a-z][a-z0-9_]{0,39}$/;
const OBS_VERSION = /^[0-9A-Za-z.+\- ]{1,24}$/;
const MAX_WIDGET_TYPES = 60;
const MAX_WIDGETS = 500;
// A clip or alert every 0.6 s for a whole heartbeat. Nothing real gets close;
// it only stops one forged beacon from inventing a million plays.
const MAX_EVENTS_PER_BEAT = 500;
const MAX_UPTIME_SECONDS = 60 * 60 * 24 * 90;

export type TelemetryBeacon =
  | { kind: "load"; properties: Omit<EventMap["overlay_loaded"], "overlay_id"> }
  | { kind: "heartbeat"; properties: Omit<EventMap["overlay_heartbeat"], "overlay_id"> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function count(value: unknown, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, Math.floor(value)));
}

function triState(value: unknown): boolean | "unknown" {
  return typeof value === "boolean" ? value : "unknown";
}

function client(value: unknown): (typeof CLIENTS)[number] | null {
  return CLIENTS.find((known) => known === value) ?? null;
}

export function parseBeacon(body: unknown): TelemetryBeacon | null {
  if (!isRecord(body)) return null;
  const from = client(body.client);
  if (!from) return null;

  if (body.kind === "load") {
    const types = Array.isArray(body.widget_types) ? body.widget_types : [];
    const widgetTypes = [
      ...new Set(types.filter((type): type is string => typeof type === "string" && IDENTIFIER.test(type))),
    ].slice(0, MAX_WIDGET_TYPES);
    const obsVersion = typeof body.obs_version === "string" && OBS_VERSION.test(body.obs_version);
    return {
      kind: "load",
      properties: {
        render_mode:
          typeof body.render_mode === "string" && IDENTIFIER.test(body.render_mode) ? body.render_mode : "unknown",
        widget_types: widgetTypes,
        widget_count: count(body.widget_count, MAX_WIDGETS),
        has_custom_widget: widgetTypes.includes("custom_widget"),
        client: from,
        ...(obsVersion ? { obs_version: body.obs_version as string } : {}),
      },
    };
  }

  if (body.kind === "heartbeat") {
    return {
      kind: "heartbeat",
      properties: {
        uptime_s: count(body.uptime_s, MAX_UPTIME_SECONDS),
        client: from,
        on_program: triState(body.on_program),
        streaming: triState(body.streaming),
        clips_played: count(body.clips_played, MAX_EVENTS_PER_BEAT),
        alerts_shown: count(body.alerts_shown, MAX_EVENTS_PER_BEAT),
      },
    };
  }

  return null;
}
