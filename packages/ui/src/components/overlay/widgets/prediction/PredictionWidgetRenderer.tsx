"use client";

// Next.js replaces NEXT_PUBLIC_* at build time; declare process so tsc is happy in this library package.
declare const process: { env: Record<string, string | undefined> };

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useGoogleFonts } from "../../hooks/use-google-font";
import { subscribeToWsRoom } from "../../lib/ws-store";
import type { OverlayItem, OverlayScene } from "../../types";
import {
  ALERT_TEST_BROWSER_EVENT,
  type AlertTestBrowserEventDetail,
} from "../alert/alert-widget-config";
import {
  Confetti,
  GOAL_KEYFRAMES,
  POLL_KEYFRAMES,
  POLL_PRESET_COMPONENTS,
  usePollCelebration,
  useVotePulses,
} from "../poll/presets";
import { normalizePredictionWidgetConfig } from "./prediction-widget-config";
import {
  PREDICTION_RESET_BROWSER_EVENT,
  applyPredictionFrame,
  isDemoPredictionFrame,
  seedPrediction,
  type FetchedPrediction,
  type PredictionResetBrowserEventDetail,
  type PredictionWidgetFrame,
  type PredictionWidgetState,
} from "./prediction-widget-state";
import { buildPredictionView } from "./prediction-view";

export interface PredictionWidgetRendererProps {
  item: OverlayItem;
  /** Needed for the live WS subscription and the prediction fetch on the overlay. */
  scene?: OverlayScene;
  /** Editor flag: fetches through the dashboard session and shows a hint while empty. */
  isEditor?: boolean;
}

/**
 * On the live overlay a test prediction (Live mode) steps aside for the real
 * one after this long. The editor keeps it until the settings' reset.
 */
const DEMO_CLEAR_MS = 15_000;

const IN_MS = 450;
const OUT_MS = 450;
/** A prediction resolved this recently still gets its celebration when the widget first hears of it. */
const JUST_ENDED_MS = 3000;

type FetchStatus = "loading" | "ready" | "missing_scope" | "failed";

/**
 * Loads the channel's open, locked or just-ended prediction once. The overlay
 * asks its own origin with the scene's subscriber token; the editor asks the
 * dashboard with the session.
 */
function useFetchedPrediction(isEditor: boolean, token: string | undefined, refreshKey: number) {
  const [result, setResult] = useState<{ status: FetchStatus; prediction: FetchedPrediction | null }>({
    status: "loading",
    prediction: null,
  });

  useEffect(() => {
    if (!isEditor && !token) return;
    let cancelled = false;
    const url = isEditor ? "/api/twitch/assets/prediction" : "/api/twitch/prediction";
    const init: RequestInit | undefined = isEditor
      ? undefined
      : { headers: { Authorization: `Bearer ${token}` } };
    (async () => {
      try {
        const res = await fetch(url, init);
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { prediction?: FetchedPrediction | null; missing_scope?: boolean };
        if (cancelled) return;
        setResult({ status: body.missing_scope ? "missing_scope" : "ready", prediction: body.prediction ?? null });
      } catch {
        if (!cancelled) setResult({ status: "failed", prediction: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEditor, token, refreshKey]);

  return result;
}

/** Re-renders every second while `active`, for the countdown. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return active ? now : Date.now();
}

function EditorHint({ body }: { body: string }) {
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
      <strong style={{ color: "rgba(255,255,255,0.85)", fontSize: 15 }}>Prediction</strong>
      <span>{body}</span>
    </div>
  );
}

export function PredictionWidgetRenderer({ item, scene, isEditor = false }: PredictionWidgetRendererProps) {
  const cfg = useMemo(() => normalizePredictionWidgetConfig(item.config), [item.config]);
  useGoogleFonts(useMemo(() => [cfg.fontFamily], [cfg.fontFamily]));

  const token = scene?.subscriber_token;
  const [refreshKey, setRefreshKey] = useState(0);
  const fetched = useFetchedPrediction(isEditor, token, refreshKey);
  // The real prediction (Helix + live events) and the test one, kept apart so
  // a reset drops the test while the real one keeps tracking underneath.
  const [state, setState] = useState<PredictionWidgetState>(null);
  const [demo, setDemo] = useState<PredictionWidgetState>(null);
  const [demoAt, setDemoAt] = useState<number | null>(null);
  const replaceOnFetch = useRef(false);

  useEffect(() => {
    if (replaceOnFetch.current) {
      // After a reset the fetch is the truth, including "no prediction any more".
      if (fetched.status === "loading") return;
      replaceOnFetch.current = false;
      setState(seedPrediction(null, fetched.prediction));
      return;
    }
    if (fetched.prediction) setState((prev) => seedPrediction(prev, fetched.prediction));
  }, [fetched]);

  const apply = useCallback((frame: PredictionWidgetFrame) => {
    const now = Date.now();
    if (isDemoPredictionFrame(frame)) {
      setDemo((prev) => applyPredictionFrame(prev, frame, now));
      setDemoAt(now);
      return;
    }
    setState((prev) => applyPredictionFrame(prev, frame, now));
  }, []);

  // Live prediction events over the scene's shared WS room.
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_SERVER_URL ?? "";
    if (!token || !wsUrl) return;
    return subscribeToWsRoom(token, wsUrl, (raw) => apply(raw as PredictionWidgetFrame));
  }, [token, apply]);

  // Editor: Local test fires arrive as a browser event.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onTest = (e: Event) => {
      const detail = (e as CustomEvent<AlertTestBrowserEventDetail>).detail;
      if (!detail || (scene && detail.sceneId !== scene.id)) return;
      apply(detail.message);
    };
    window.addEventListener(ALERT_TEST_BROWSER_EVENT, onTest);
    return () => window.removeEventListener(ALERT_TEST_BROWSER_EVENT, onTest);
  }, [scene, apply]);

  // Editor: the settings' reset drops the test and reads Twitch again.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onReset = (e: Event) => {
      const detail = (e as CustomEvent<PredictionResetBrowserEventDetail>).detail;
      if (!detail || (scene && detail.sceneId !== scene.id)) return;
      setDemo(null);
      setDemoAt(null);
      replaceOnFetch.current = true;
      setRefreshKey((k) => k + 1);
    };
    window.addEventListener(PREDICTION_RESET_BROWSER_EVENT, onReset);
    return () => window.removeEventListener(PREDICTION_RESET_BROWSER_EVENT, onReset);
  }, [scene]);

  // Live overlay: nobody is there to press reset, so tests clear themselves.
  useEffect(() => {
    if (isEditor || demoAt === null) return;
    const id = setTimeout(() => {
      setDemo(null);
      setDemoAt(null);
    }, Math.max(0, demoAt + DEMO_CLEAR_MS - Date.now()));
    return () => clearTimeout(id);
  }, [isEditor, demoAt]);

  const prediction = demo ?? state;
  const now = useNow(prediction !== null && prediction.status === "active");

  // An ended prediction shows its result for `hideAfterSeconds`, then leaves.
  // The exit animation starts a little before it comes off screen.
  const [hiddenId, setHiddenId] = useState<string | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const endedAt = prediction?.endedAt ?? null;
  const predictionId = prediction?.id ?? null;
  const outMs = cfg.animationOut === "none" ? 0 : OUT_MS;
  const hideMs = cfg.hideAfterSeconds * 1000;
  useEffect(() => {
    setLeavingId(null);
    setHiddenId(null);
    if (endedAt === null || predictionId === null) return;
    const hideIn = Math.max(0, endedAt + hideMs - Date.now());
    const leave = setTimeout(() => setLeavingId(predictionId), Math.max(0, hideIn - outMs));
    const hide = setTimeout(() => setHiddenId(predictionId), hideIn);
    return () => {
      clearTimeout(leave);
      clearTimeout(hide);
    };
  }, [endedAt, predictionId, outMs, hideMs]);

  const view = prediction ? buildPredictionView(prediction, cfg, now) : null;
  // Hooks run on every render, so they get stand-ins while there's no prediction.
  const pulses = useVotePulses(view, cfg.pulseOnVote);
  const celebrating = usePollCelebration({
    pollId: view?.pollId ?? "",
    ended: view?.ended ?? false,
    // A canceled prediction has nobody to celebrate.
    hasWinner: prediction?.status === "resolved",
    justEnded: endedAt !== null && Date.now() - endedAt < JUST_ENDED_MS,
    kind: cfg.celebration,
  });

  const lockedAway = prediction?.status === "locked" && !cfg.showWhileLocked;

  if (!prediction || !view || hiddenId === prediction.id || lockedAway) {
    if (!isEditor) return null;
    if (fetched.status === "missing_scope") {
      return <EditorHint body="Reconnect Twitch in this widget's settings so StreamWizard can read your predictions." />;
    }
    if (lockedAway) {
      return <EditorHint body="Prediction locked. Hidden on stream until you pick the winner." />;
    }
    if (prediction) {
      return <EditorHint body="Prediction over. Hidden on stream until your next one starts." />;
    }
    return <EditorHint body="No prediction running. Start one on Twitch and it shows up here." />;
  }

  const Preset = POLL_PRESET_COMPONENTS[cfg.preset];
  const leaving = leavingId === prediction.id && cfg.animationOut !== "none";
  const winnerColor = view.leader?.color ?? cfg.leaderColor;
  const animation = leaving
    ? `sw-goal-out-${cfg.animationOut} ${OUT_MS}ms ease-in forwards`
    : celebrating?.kind === "glow"
      ? "sw-goal-glow 1100ms ease-in-out 2"
      : cfg.animationIn !== "none"
        ? `sw-goal-in-${cfg.animationIn} ${IN_MS}ms ease-out both`
        : undefined;

  return (
    <div
      // A new prediction remounts, so it plays the entrance again.
      key={prediction.id}
      className="sw-goal-motion"
      style={
        {
          position: "relative",
          width: "100%",
          height: "100%",
          animation,
          "--sw-goal-glow": winnerColor,
        } as CSSProperties
      }
    >
      <style>{GOAL_KEYFRAMES + POLL_KEYFRAMES}</style>
      <Preset view={view} cfg={cfg} pulses={pulses} />
      <Confetti play={celebrating} colors={[winnerColor, ...cfg.choiceColors.slice(0, 3), cfg.textColor]} />
    </div>
  );
}
