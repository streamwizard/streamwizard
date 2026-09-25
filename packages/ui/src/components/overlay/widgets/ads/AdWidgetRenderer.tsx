"use client";

// Next.js replaces NEXT_PUBLIC_* at build time; declare process so tsc is happy in this library package.
declare const process: { env: Record<string, string | undefined> };

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useGoogleFonts } from "../../hooks/use-google-font";
import { subscribeToWsRoom } from "../../lib/ws-store";
import type { OverlayItem, OverlayScene } from "../../types";
import {
  ALERT_TEST_BROWSER_EVENT,
  type AlertTestBrowserEventDetail,
} from "../alert/alert-widget-config";
import { normalizeAdWidgetConfig } from "./ad-widget-config";
import {
  AD_BACK_MS,
  AD_RESET_BROWSER_EVENT,
  AD_SCHEDULE_TEST_BROWSER_EVENT,
  EMPTY_AD_STATE,
  adPhase,
  applyAdFrame,
  formatAdTime,
  isDemoAdFrame,
  scheduleFrom,
  type AdResetBrowserEventDetail,
  type AdScheduleTestBrowserEventDetail,
  type AdWidgetFrame,
  type AdWidgetState,
  type FetchedAdSchedule,
} from "./ad-widget-state";
import { AD_KEYFRAMES, AD_PRESET_COMPONENTS, GOAL_KEYFRAMES, SWAP_ANIMATION } from "./presets";

export interface AdWidgetRendererProps {
  item: OverlayItem;
  /** Needed for the live WS subscription and the schedule fetch on the overlay. */
  scene?: OverlayScene;
  /** Editor flag: fetches through the dashboard session and shows a hint while idle. */
  isEditor?: boolean;
}

/** A test on the live overlay steps aside after this long. The editor keeps it until reset. */
const DEMO_CLEAR_MS = 15_000;

const IN_MS = 450;
const OUT_MS = 450;

/**
 * How often the schedule is read again. Twitch sends nothing when a streamer
 * snoozes an ad, so this is how a snooze reaches the widget: every minute
 * normally, every 15 s once an ad is close.
 */
const REFRESH_MS = 60_000;
const REFRESH_CLOSE_MS = 15_000;

type FetchStatus = "loading" | "ready" | "missing_scope" | "failed";

function useFetchedSchedule(isEditor: boolean, token: string | undefined, refreshKey: number) {
  const [result, setResult] = useState<{ status: FetchStatus; schedule: FetchedAdSchedule | null; at: number }>({
    status: "loading",
    schedule: null,
    at: 0,
  });

  useEffect(() => {
    if (!isEditor && !token) return;
    let cancelled = false;
    const url = isEditor ? "/api/twitch/assets/ads" : "/api/twitch/ads";
    const init: RequestInit | undefined = isEditor ? undefined : { headers: { Authorization: `Bearer ${token}` } };
    (async () => {
      try {
        const res = await fetch(url, init);
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { schedule?: FetchedAdSchedule | null; missing_scope?: boolean };
        if (cancelled) return;
        setResult({ status: body.missing_scope ? "missing_scope" : "ready", schedule: body.schedule ?? null, at: Date.now() });
      } catch {
        // Keep the last schedule: one failed refresh shouldn't drop a heads-up.
        if (!cancelled) setResult((prev) => ({ ...prev, status: prev.status === "loading" ? "failed" : prev.status, at: Date.now() }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEditor, token, refreshKey]);

  return result;
}

function EditorHint({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        border: "1.5px dashed rgba(158,122,255,0.5)",
        borderRadius: 8,
        color: "rgba(255,255,255,0.6)",
        fontFamily: "sans-serif",
        fontSize: 13,
        lineHeight: 1.35,
        textAlign: "center",
        padding: 10,
        overflow: "hidden",
      }}
    >
      <strong style={{ color: "rgba(255,255,255,0.85)", fontSize: 14 }}>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

export function AdWidgetRenderer({ item, scene, isEditor = false }: AdWidgetRendererProps) {
  const cfg = useMemo(() => normalizeAdWidgetConfig(item.config), [item.config]);
  useGoogleFonts(useMemo(() => [cfg.fontFamily], [cfg.fontFamily]));

  const token = scene?.subscriber_token;
  const [refreshKey, setRefreshKey] = useState(0);
  const fetched = useFetchedSchedule(isEditor, token, refreshKey);
  // Real (Helix + live breaks) and test, kept apart so a reset drops the tests.
  const [state, setState] = useState<AdWidgetState>(EMPTY_AD_STATE);
  const [demo, setDemo] = useState<AdWidgetState | null>(null);
  const [demoAt, setDemoAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Each fetch replaces the schedule: it's the newest word on the next ad.
  useEffect(() => {
    if (fetched.status !== "ready") return;
    setState((prev) => ({ ...prev, schedule: scheduleFrom(fetched.schedule) }));
  }, [fetched]);

  const apply = useCallback((frame: AdWidgetFrame) => {
    const at = Date.now();
    if (isDemoAdFrame(frame)) {
      setDemo((prev) => applyAdFrame(prev ?? EMPTY_AD_STATE, frame, at));
      setDemoAt(at);
      return;
    }
    setState((prev) => applyAdFrame(prev, frame, at));
  }, []);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_SERVER_URL ?? "";
    if (!token || !wsUrl) return;
    return subscribeToWsRoom(token, wsUrl, (raw) => apply(raw as AdWidgetFrame));
  }, [token, apply]);

  // Editor: Local test fires, the heads-up preview, and the reset.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const forScene = (id: string | undefined) => !scene || id === scene.id;
    const onTest = (e: Event) => {
      const detail = (e as CustomEvent<AlertTestBrowserEventDetail>).detail;
      if (detail && forScene(detail.sceneId)) apply(detail.message);
    };
    const onSchedule = (e: Event) => {
      const detail = (e as CustomEvent<AdScheduleTestBrowserEventDetail>).detail;
      if (!detail || !forScene(detail.sceneId)) return;
      setDemo({ schedule: { nextAdAt: detail.nextAdAt, duration: detail.duration, snoozeCount: 0 }, adBreak: null });
      setDemoAt(Date.now());
    };
    const onReset = (e: Event) => {
      const detail = (e as CustomEvent<AdResetBrowserEventDetail>).detail;
      if (!detail || !forScene(detail.sceneId)) return;
      setDemo(null);
      setDemoAt(null);
      setRefreshKey((k) => k + 1);
    };
    window.addEventListener(ALERT_TEST_BROWSER_EVENT, onTest);
    window.addEventListener(AD_SCHEDULE_TEST_BROWSER_EVENT, onSchedule);
    window.addEventListener(AD_RESET_BROWSER_EVENT, onReset);
    return () => {
      window.removeEventListener(ALERT_TEST_BROWSER_EVENT, onTest);
      window.removeEventListener(AD_SCHEDULE_TEST_BROWSER_EVENT, onSchedule);
      window.removeEventListener(AD_RESET_BROWSER_EVENT, onReset);
    };
  }, [scene, apply]);

  const active = demo ?? state;
  const view = adPhase(active, cfg, now);

  // Live overlay: a test clears itself once it has played out, or after 15 s.
  const demoBreakEnd = demo?.adBreak ? demo.adBreak.endsAt + AD_BACK_MS : 0;
  useEffect(() => {
    if (isEditor || demoAt === null) return;
    const until = Math.max(demoAt + DEMO_CLEAR_MS, demoBreakEnd);
    const id = setTimeout(() => {
      setDemo(null);
      setDemoAt(null);
    }, Math.max(0, until - Date.now()));
    return () => clearTimeout(id);
  }, [isEditor, demoAt, demoBreakEnd]);

  // The clock: every second while something shows or an ad is near, so the
  // heads-up appears on time; otherwise a slow tick is enough.
  const nextAdAt = active.schedule?.nextAdAt ?? null;
  const close = nextAdAt !== null && nextAdAt - now <= (cfg.warnMinutes + 1) * 60_000;
  const busy = view.phase !== "idle" || close || (active.adBreak !== null && now < active.adBreak.endsAt + AD_BACK_MS);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), busy ? 1000 : 10_000);
    return () => clearInterval(id);
  }, [busy]);

  // Read the schedule again: often when an ad is near, and right after a break.
  useEffect(() => {
    const id = setTimeout(() => setRefreshKey((k) => k + 1), close ? REFRESH_CLOSE_MS : REFRESH_MS);
    return () => clearTimeout(id);
  }, [close, fetched.at]);
  const breakEndsAt = state.adBreak?.endsAt ?? null;
  useEffect(() => {
    if (breakEndsAt === null) return;
    const id = setTimeout(() => setRefreshKey((k) => k + 1), Math.max(0, breakEndsAt - Date.now()) + 2000);
    return () => clearTimeout(id);
  }, [breakEndsAt]);

  // Leaving: keep drawing the last frame for the exit animation.
  const [shown, setShown] = useState(view);
  const [leaving, setLeaving] = useState(false);
  const outMs = cfg.animationOut === "none" ? 0 : OUT_MS;
  useEffect(() => {
    if (view.phase !== "idle") {
      setShown(view);
      setLeaving(false);
      return;
    }
    if (shown.phase === "idle") return;
    setLeaving(true);
    const id = setTimeout(() => {
      setShown(view);
      setLeaving(false);
    }, outMs);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.phase, view.text, view.remaining, outMs]);

  if (shown.phase === "idle") {
    if (!isEditor) return null;
    if (fetched.status === "missing_scope") {
      return <EditorHint title="Ads" body="Reconnect Twitch in this widget's settings so StreamWizard can read your ad schedule." />;
    }
    if (nextAdAt !== null && nextAdAt > now) {
      return (
        <EditorHint
          title="Ads"
          body={`Next ad in ${formatAdTime((nextAdAt - now) / 1000)}. Shows on stream ${cfg.warnMinutes} min before.`}
        />
      );
    }
    return <EditorHint title="Ads" body="No ad scheduled right now. Shows before and during your ad breaks." />;
  }

  const Preset = AD_PRESET_COMPONENTS[cfg.preset];
  const animation =
    leaving && cfg.animationOut !== "none"
      ? `sw-goal-out-${cfg.animationOut} ${OUT_MS}ms ease-in forwards`
      : cfg.animationIn !== "none"
        ? `sw-goal-in-${cfg.animationIn} ${IN_MS}ms ease-out both`
        : undefined;

  // The widget enters once and leaves once; a phase change while it's up
  // (heads-up to break, break to welcome back) swaps in place. The badge
  // does its own swap so its plate never moves; the other designs crossfade.
  const swapsItself = cfg.preset === "badge";
  return (
    <div
      className="sw-goal-motion"
      style={{ position: "relative", width: "100%", height: "100%", animation } as CSSProperties}
    >
      <style>{GOAL_KEYFRAMES + AD_KEYFRAMES}</style>
      <div
        key={swapsItself ? "badge" : shown.phase}
        className="sw-goal-motion"
        style={{ width: "100%", height: "100%", animation: swapsItself ? undefined : SWAP_ANIMATION }}
      >
        <Preset view={shown} cfg={cfg} />
      </div>
    </div>
  );
}
