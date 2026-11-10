"use client";

import { useEffect } from "react";
import { OVERLAY_ACTIVITY_EVENT, type OverlayActivityKind } from "@repo/ui/overlay";

/**
 * Tells our server that this overlay is loaded, and then every few minutes
 * that it is still on screen, with how many clips and alerts it showed since.
 * Renders nothing.
 *
 * Only this app mounts it. The editor draws overlays with its own canvas, so
 * a preview can never be mistaken for an overlay running on stream.
 */

const DEFAULT_INTERVAL_SECONDS = 300;
const MIN_INTERVAL_SECONDS = 60;
const MAX_INTERVAL_SECONDS = 3600;

type TriState = boolean | "unknown";

interface ObsActiveEvent extends Event {
  detail?: { active?: boolean };
}

export function OverlayTelemetry({
  token,
  renderMode,
  widgetTypes,
  widgetCount,
}: {
  token: string;
  renderMode: string;
  widgetTypes: string[];
  widgetCount: number;
}) {
  // The array is rebuilt on every server render; its contents are what matter.
  const widgetTypesKey = widgetTypes.join(",");

  useEffect(() => {
    if (!token) return;

    const startedAt = Date.now();
    const obs = (window as unknown as { obsstudio?: { pluginVersion?: string } }).obsstudio;
    const client = obs ? "obs" : window.self !== window.top ? "embed" : "browser";

    // OBS reports changes, not the state a source loaded in, so both start
    // unknown and the server records them that way.
    let onProgram: TriState = "unknown";
    let streaming: TriState = "unknown";
    const counts: Record<OverlayActivityKind, number> = { clip_played: 0, alert_shown: 0 };
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    // Resolves to the server's next interval in seconds (0 = stop), or null
    // when the beacon did not get through.
    async function send(body: Record<string, unknown>): Promise<number | null> {
      try {
        const response = await fetch("/api/telemetry", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
          keepalive: true,
        });
        if (!response.ok) return null;
        const answer = (await response.json()) as { next?: unknown };
        if (typeof answer.next !== "number" || !Number.isFinite(answer.next)) return DEFAULT_INTERVAL_SECONDS;
        if (answer.next <= 0) return 0;
        return Math.min(MAX_INTERVAL_SECONDS, Math.max(MIN_INTERVAL_SECONDS, answer.next));
      } catch {
        return null;
      }
    }

    // One timeout at a time, each scheduled by the last: nothing to pile up
    // however long OBS leaves the page open.
    function schedule(seconds: number) {
      if (stopped) return;
      timer = setTimeout(beat, seconds * 1000);
    }

    async function beat() {
      if (stopped) return;
      let next: number = DEFAULT_INTERVAL_SECONDS;
      // Off program in OBS, or a background tab: nobody is seeing it, so it
      // isn't use. The chain keeps ticking so it resumes by itself.
      const idle = onProgram === false || (client !== "obs" && document.visibilityState !== "visible");
      if (!idle) {
        const sent = { ...counts };
        const answer = await send({
          kind: "heartbeat",
          client,
          uptime_s: Math.round((Date.now() - startedAt) / 1000),
          on_program: onProgram,
          streaming,
          clips_played: sent.clip_played,
          alerts_shown: sent.alert_shown,
        });
        if (answer !== null) {
          // Subtract rather than zero: a clip may have started mid-request.
          counts.clip_played -= sent.clip_played;
          counts.alert_shown -= sent.alert_shown;
          next = answer;
        }
      }
      if (next > 0) schedule(next);
    }

    function onActivity(event: Event) {
      const kind = (event as CustomEvent<{ kind?: OverlayActivityKind }>).detail?.kind;
      if (kind === "clip_played" || kind === "alert_shown") counts[kind] += 1;
    }
    function onActiveChanged(event: Event) {
      const active = (event as ObsActiveEvent).detail?.active;
      if (typeof active === "boolean") onProgram = active;
    }
    const onStreamingStarted = () => {
      streaming = true;
    };
    const onStreamingStopped = () => {
      streaming = false;
    };

    window.addEventListener(OVERLAY_ACTIVITY_EVENT, onActivity);
    window.addEventListener("obsSourceActiveChanged", onActiveChanged);
    window.addEventListener("obsStreamingStarted", onStreamingStarted);
    window.addEventListener("obsStreamingStopped", onStreamingStopped);

    void (async () => {
      const next = await send({
        kind: "load",
        client,
        render_mode: renderMode,
        widget_types: widgetTypesKey ? widgetTypesKey.split(",") : [],
        widget_count: widgetCount,
        obs_version: obs?.pluginVersion,
      });
      if (next !== 0) schedule(next ?? DEFAULT_INTERVAL_SECONDS);
    })();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener(OVERLAY_ACTIVITY_EVENT, onActivity);
      window.removeEventListener("obsSourceActiveChanged", onActiveChanged);
      window.removeEventListener("obsStreamingStarted", onStreamingStarted);
      window.removeEventListener("obsStreamingStopped", onStreamingStopped);
    };
  }, [token, renderMode, widgetTypesKey, widgetCount]);

  return null;
}
