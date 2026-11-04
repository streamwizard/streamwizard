"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useGoogleFonts } from "../../hooks/use-google-font";
import type { OverlayItem, OverlayScene } from "../../types";
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
  type PredictionWidgetFrame,
  type PredictionWidgetState,
} from "./prediction-widget-state";
import { buildPredictionView } from "./prediction-view";
import { useLiveWidgetState, type LiveWidgetSpec } from "../../hooks/use-live-widget-state";
import { useNow } from "../../hooks/use-now";
import { EditorHint } from "../editor-hint";

export interface PredictionWidgetRendererProps {
  item: OverlayItem;
  /** Needed for the live WS subscription and the prediction fetch on the overlay. */
  scene?: OverlayScene;
  /** Editor flag: fetches through the dashboard session and shows a hint while empty. */
  isEditor?: boolean;
}

const IN_MS = 450;
const OUT_MS = 450;
/** A prediction resolved this recently still gets its celebration when the widget first hears of it. */
const JUST_ENDED_MS = 3000;

const PREDICTION_LIVE: LiveWidgetSpec<
  { prediction?: FetchedPrediction | null },
  FetchedPrediction | null,
  PredictionWidgetState,
  PredictionWidgetFrame
> = {
  resource: "prediction",
  parse: (body) => body.prediction ?? null,
  hasData: (prediction) => prediction !== null,
  empty: () => null,
  seed: seedPrediction,
  applyFrame: applyPredictionFrame,
  isDemoFrame: isDemoPredictionFrame,
  resetEvent: PREDICTION_RESET_BROWSER_EVENT,
};

export function PredictionWidgetRenderer({ item, scene, isEditor = false }: PredictionWidgetRendererProps) {
  const cfg = useMemo(() => normalizePredictionWidgetConfig(item.config), [item.config]);
  useGoogleFonts(useMemo(() => [cfg.fontFamily], [cfg.fontFamily]));

  const { state, demo, status } = useLiveWidgetState(PREDICTION_LIVE, { scene, isEditor });

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
    if (status === "missing_scope") {
      return <EditorHint title="Prediction" body="Reconnect Twitch in this widget's settings so StreamWizard can read your predictions." />;
    }
    if (lockedAway) {
      return <EditorHint title="Prediction" body="Prediction locked. Hidden on stream until you pick the winner." />;
    }
    if (prediction) {
      return <EditorHint title="Prediction" body="Prediction over. Hidden on stream until your next one starts." />;
    }
    return <EditorHint title="Prediction" body="No prediction running. Start one on Twitch and it shows up here." />;
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
