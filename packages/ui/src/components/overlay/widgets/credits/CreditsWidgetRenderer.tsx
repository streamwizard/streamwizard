"use client";

// Next.js replaces NEXT_PUBLIC_* at build time; declare process so tsc is happy in this library package.
declare const process: { env: Record<string, string | undefined> };

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { creditsDataSchema, type CreditsData } from "@repo/schemas";
import { useGoogleFonts } from "../../hooks/use-google-font";
import { subscribeToWsRoom } from "../../lib/ws-store";
import type { OverlayItem, OverlayScene } from "../../types";
import { normalizeCreditsWidgetConfig } from "./credits-widget-config";
import {
  CREDITS_RESET_BROWSER_EVENT,
  CREDITS_ROLL_BROWSER_EVENT,
  streamChangedFromFrame,
  type CreditsResetBrowserEventDetail,
  type CreditsRollBrowserEventDetail,
  type CreditsWidgetFrame,
} from "./credits-widget-state";
import { buildCreditsView } from "./credits-view";
import { creditsTimeline, scrollOffsetAt } from "./credits-playback";
import { useCreditsMeasured, useCreditsPlayback, useReducedMotion, useRollOnVisible } from "./use-credits-playback";
import { CREDITS_KEYFRAMES, CREDITS_PRESET_COMPONENTS } from "./presets";

export interface CreditsWidgetRendererProps {
  item: OverlayItem;
  /** Needed for the credits read and the WS subscription on the overlay. */
  scene?: OverlayScene;
  /** Editor flag: reads through the dashboard session, never rolls on its own, shows hints. */
  isEditor?: boolean;
}

type FetchStatus = "loading" | "ready" | "failed";

interface Fetched {
  status: FetchStatus;
  data: CreditsData | null;
  /** When the last read settled, so a roll can wait for the one it asked for. */
  at: number;
}

/**
 * Reads the credits. The overlay asks its own origin with the scene's
 * subscriber token; the editor asks the dashboard with the session. A failed
 * read keeps the data from the last good one.
 */
function useFetchedCredits(isEditor: boolean, token: string | undefined, refreshKey: number, avatars: boolean): Fetched {
  const [result, setResult] = useState<Fetched>({ status: "loading", data: null, at: 0 });

  useEffect(() => {
    if (!isEditor && !token) return;
    let cancelled = false;
    const base = isEditor ? "/api/twitch/assets/credits" : "/api/twitch/credits";
    const url = avatars ? `${base}?avatars=1` : base;
    const init: RequestInit | undefined = isEditor ? undefined : { headers: { Authorization: `Bearer ${token}` } };
    (async () => {
      try {
        const res = await fetch(url, init);
        if (!res.ok) throw new Error(String(res.status));
        const parsed = creditsDataSchema.safeParse(await res.json());
        if (!parsed.success) throw new Error("bad credits payload");
        if (cancelled) return;
        setResult({ status: "ready", data: parsed.data, at: Date.now() });
      } catch {
        if (!cancelled) setResult((prev) => ({ status: "failed", data: prev.data, at: Date.now() }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEditor, token, refreshKey, avatars]);

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
        fontSize: 14,
        lineHeight: 1.4,
        textAlign: "center",
        padding: 12,
      }}
    >
      <strong style={{ color: "rgba(255,255,255,0.85)", fontSize: 15 }}>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

/** The editor's idle canvas: the roll's first screen, dimmed, with how to preview it. */
function PosterHint() {
  return (
    <div
      style={{
        position: "absolute",
        right: 10,
        bottom: 10,
        padding: "6px 10px",
        borderRadius: 999,
        background: "rgba(11,11,18,0.8)",
        border: "1px solid rgba(158,122,255,0.5)",
        color: "rgba(255,255,255,0.85)",
        fontFamily: "sans-serif",
        fontSize: 12,
        lineHeight: 1.2,
        pointerEvents: "none",
      }}
    >
      Press Roll in the settings to preview
    </div>
  );
}

export function CreditsWidgetRenderer({ item, scene, isEditor = false }: CreditsWidgetRendererProps) {
  const cfg = useMemo(() => normalizeCreditsWidgetConfig(item.config), [item.config]);
  useGoogleFonts(useMemo(() => [cfg.fontFamily], [cfg.fontFamily]));

  const token = scene?.subscriber_token;
  const [refreshKey, setRefreshKey] = useState(0);
  const fetched = useFetchedCredits(isEditor, token, refreshKey, cfg.showAvatars);
  // Sample data from the settings, kept apart from the real read so a reset can drop it.
  const [demo, setDemo] = useState<CreditsData | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playKey, setPlayKey] = useState(0);
  // True once a roll has started and until it's reset: the editor's poster
  // shows before, the overlay stays hidden before.
  const [started, setStarted] = useState(false);
  // Overlay: the source came on screen at this time; roll once a fresh read lands and the delay passes.
  const [armedAt, setArmedAt] = useState<number | null>(null);
  const playingRef = useRef(false);
  playingRef.current = playing;
  const staleRef = useRef(false);

  const data = demo ?? fetched.data;
  const sections = useMemo(() => (data ? buildCreditsView(data, cfg) : []), [data, cfg]);

  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const horizontal = cfg.preset === "ticker";
  const measured = useCreditsMeasured(rootRef, contentRef, horizontal, [sections, cfg.fontSize, cfg.fontFamily, cfg.preset]);
  const timeline = useMemo(
    () => creditsTimeline(sections, cfg, measured, reducedMotion),
    [sections, cfg, measured, reducedMotion],
  );
  const playback = useCreditsPlayback({
    timeline,
    playing,
    playKey,
    loop: cfg.loop,
    // A scroll wraps in one motion; a stepped roll holds its last section first.
    holdMs: timeline.mode === "scroll" ? 0 : undefined,
  });

  const start = useCallback(() => {
    setPlayKey((k) => k + 1);
    setPlaying(true);
    setStarted(true);
  }, []);
  const stop = useCallback(() => {
    setPlaying(false);
    setStarted(false);
  }, []);

  // Overlay: the source came on screen. Read again first, so the roll has
  // everything up to this moment, then start after the delay.
  const onShow = useCallback(() => {
    setArmedAt(Date.now());
    setRefreshKey((k) => k + 1);
  }, []);
  const onHide = useCallback(() => {
    setArmedAt(null);
    stop();
  }, [stop]);
  useRollOnVisible(!isEditor, rootRef, onShow, onHide);

  useEffect(() => {
    if (armedAt === null) return;
    // Wait for the read this arming asked for; a failed one still settles `at`.
    if (fetched.at < armedAt) return;
    const wait = Math.max(0, armedAt + cfg.startDelaySeconds * 1000 - Date.now());
    const id = setTimeout(() => {
      setArmedAt(null);
      start();
    }, wait);
    return () => clearTimeout(id);
  }, [armedAt, fetched.at, cfg.startDelaySeconds, start]);

  // The stream started or ended: read again, now or once the current roll is over.
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_SERVER_URL ?? "";
    if (!token || !wsUrl) return;
    return subscribeToWsRoom(token, wsUrl, (raw) => {
      if (!streamChangedFromFrame(raw as CreditsWidgetFrame)) return;
      if (playingRef.current) staleRef.current = true;
      else setRefreshKey((k) => k + 1);
    });
  }, [token]);

  useEffect(() => {
    if (playing || !staleRef.current) return;
    staleRef.current = false;
    setRefreshKey((k) => k + 1);
  }, [playing]);

  // Editor: the settings' Roll and Reset arrive as browser events.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onRoll = (e: Event) => {
      const detail = (e as CustomEvent<CreditsRollBrowserEventDetail>).detail;
      if (!detail || (scene && detail.sceneId !== scene.id)) return;
      setDemo(detail.data ?? null);
      start();
    };
    const onReset = (e: Event) => {
      const detail = (e as CustomEvent<CreditsResetBrowserEventDetail>).detail;
      if (!detail || (scene && detail.sceneId !== scene.id)) return;
      setDemo(null);
      stop();
      setRefreshKey((k) => k + 1);
    };
    window.addEventListener(CREDITS_ROLL_BROWSER_EVENT, onRoll);
    window.addEventListener(CREDITS_RESET_BROWSER_EVENT, onReset);
    return () => {
      window.removeEventListener(CREDITS_ROLL_BROWSER_EVENT, onRoll);
      window.removeEventListener(CREDITS_RESET_BROWSER_EVENT, onReset);
    };
  }, [scene, start, stop]);

  // Live overlay: nobody is there to press reset, so a sample roll clears itself when it ends.
  useEffect(() => {
    if (isEditor || !demo || !playback.ended || cfg.loop) return;
    setDemo(null);
    stop();
  }, [isEditor, demo, playback.ended, cfg.loop, stop]);

  if (sections.length === 0) {
    if (!isEditor) return null;
    const body =
      fetched.status === "loading"
        ? "Reading your last stream…"
        : data?.missing.stream
          ? "No stream to roll yet. Go live once with StreamWizard connected, or press Roll with sample data in the settings."
          : "Nothing to show: every section is off or empty. Press Roll with sample data in the settings to preview.";
    return <EditorHint title="End credits" body={body} />;
  }

  const Preset = CREDITS_PRESET_COMPONENTS[cfg.preset];
  const idle = !started;

  return (
    <div
      ref={rootRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        // Mounted before the roll so it can be measured, but not on screen yet.
        visibility: !isEditor && idle ? "hidden" : undefined,
        opacity: isEditor && idle ? 0.6 : 1,
      }}
    >
      <style>{CREDITS_KEYFRAMES}</style>
      <Preset
        sections={sections}
        cfg={cfg}
        playback={{
          mode: timeline.mode,
          progress: playback.progress,
          stepIndex: playback.stepIndex,
          offsetPx: scrollOffsetAt(timeline, playback.progress),
          idle,
        }}
        contentRef={contentRef}
      />
      {isEditor && idle && <PosterHint />}
    </div>
  );
}
