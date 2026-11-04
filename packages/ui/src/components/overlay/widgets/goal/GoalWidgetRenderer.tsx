"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useGoogleFonts } from "../../hooks/use-google-font";
import type { OverlayItem, OverlayScene } from "../../types/item";
import {
  GOAL_WIDGET_LABELS,
  isGoalWidgetType,
  normalizeGoalWidgetConfig,
  twitchGoalTypesFor,
  type GoalWidgetType,
} from "./goal-widget-config";
import {
  GOAL_RESET_BROWSER_EVENT,
  applyGoalFrame,
  isDemoGoalFrame,
  pickGoal,
  seedGoals,
  type FetchedGoal,
  type GoalWidgetFrame,
  type GoalWidgetState,
} from "./goal-widget-state";
import { buildGoalView } from "./goal-view";
import { applyEditorGoalValue } from "./goal-editor-values";
import { useEditorPreviewValues } from "../../hooks/use-editor-preview-values";
import {
  Confetti,
  GOAL_KEYFRAMES,
  GOAL_PRESET_COMPONENTS,
  useCelebration,
  useProgressPulse,
} from "./presets";
import { useLiveWidgetState, type LiveWidgetSpec } from "../../hooks/use-live-widget-state";
import { EditorHint } from "../editor-hint";

export interface GoalWidgetRendererProps {
  item: OverlayItem;
  /** Needed for the live WS subscription and the goals fetch on the overlay. */
  scene?: OverlayScene;
  /** Editor flag: fetches through the dashboard session and shows a hint while empty. */
  isEditor?: boolean;
}

const IN_MS = 450;
const OUT_MS = 450;
/** An end event this recent still counts as "just reached" for a celebration. */
const JUST_ENDED_MS = 3000;

/** How long a finished goal stays up when the widget is set to hide it. */
const HIDE_AFTER_END_MS = 8000;


const GOAL_LIVE: LiveWidgetSpec<{ goals?: FetchedGoal[] }, FetchedGoal[], GoalWidgetState, GoalWidgetFrame> = {
  resource: "goals",
  parse: (body) => (Array.isArray(body.goals) ? body.goals : []),
  hasData: (goals) => goals.length > 0,
  empty: () => ({}),
  seed: seedGoals,
  applyFrame: applyGoalFrame,
  isDemoFrame: isDemoGoalFrame,
  resetEvent: GOAL_RESET_BROWSER_EVENT,
};

export function GoalWidgetRenderer({ item, scene, isEditor = false }: GoalWidgetRendererProps) {
  const cfg = useMemo(() => normalizeGoalWidgetConfig(item.config), [item.config]);
  useGoogleFonts(useMemo(() => [cfg.fontFamily], [cfg.fontFamily]));

  const widgetType: GoalWidgetType = isGoalWidgetType(item.type) ? item.type : "follower_goal_widget";
  const types = twitchGoalTypesFor(widgetType);

  const { state, demo, status } = useLiveWidgetState(GOAL_LIVE, { scene, isEditor });

  // Test goals first, then numbers typed into the editor's Saved data tab
  // (never set on a live overlay), then the real goal.
  const editorValue = useEditorPreviewValues().goals[widgetType];
  const goal = pickGoal(demo, types) ?? applyEditorGoalValue(pickGoal(state, types), editorValue, types[0]!);

  // Hide a finished goal after a beat, when the widget is set to. The exit
  // animation starts a little before the goal comes off screen.
  const [hiddenGoalId, setHiddenGoalId] = useState<string | null>(null);
  const [leavingGoalId, setLeavingGoalId] = useState<string | null>(null);
  const endedAt = goal?.ended?.at ?? null;
  const goalId = goal?.id ?? null;
  const outMs = cfg.animationOut === "none" ? 0 : OUT_MS;
  useEffect(() => {
    setLeavingGoalId(null);
    if (cfg.onEnd !== "hide" || endedAt === null || goalId === null) {
      setHiddenGoalId(null);
      return;
    }
    const hideIn = Math.max(0, endedAt + HIDE_AFTER_END_MS - Date.now());
    const leave = setTimeout(() => setLeavingGoalId(goalId), Math.max(0, hideIn - outMs));
    const hide = setTimeout(() => setHiddenGoalId(goalId), hideIn);
    return () => {
      clearTimeout(leave);
      clearTimeout(hide);
    };
  }, [cfg.onEnd, endedAt, goalId, outMs]);

  const view = goal ? buildGoalView(goal, cfg, widgetType) : null;
  // Hooks run on every render, so they get stand-ins while there's no goal.
  const pulseKey = useProgressPulse(view?.current ?? 0, view?.goalId ?? "", cfg.pulseOnProgress);
  const celebrating = useCelebration({
    reached: view?.reached ?? false,
    goalId: view?.goalId ?? "",
    justEnded: endedAt !== null && Date.now() - endedAt < JUST_ENDED_MS,
    kind: cfg.celebration,
    enabled: cfg.celebration !== "none" || cfg.preset === "arcade",
  });

  const labels = GOAL_WIDGET_LABELS[widgetType];

  if (!goal || !view || hiddenGoalId === goal.id) {
    if (!isEditor) return null;
    if (status === "missing_scope") {
      return (
        <EditorHint
          title={labels.title}
          body="Reconnect Twitch in this widget's settings so StreamWizard can read your goals."
        />
      );
    }
    if (goal) {
      return <EditorHint title={labels.title} body="Goal ended. Hidden on stream until your next one starts." />;
    }
    return (
      <EditorHint
        title={labels.title}
        body={`No active ${labels.noun} goal on Twitch. Make one in your Creator Dashboard and it shows up here.`}
      />
    );
  }

  const Preset = GOAL_PRESET_COMPONENTS[cfg.preset];
  const leaving = leavingGoalId === goal.id && cfg.animationOut !== "none";
  const glowing = celebrating?.kind === "glow";
  const animation = leaving
    ? `sw-goal-out-${cfg.animationOut} ${OUT_MS}ms ease-in forwards`
    : glowing
      ? "sw-goal-glow 1100ms ease-in-out 2"
      : cfg.animationIn !== "none"
        ? `sw-goal-in-${cfg.animationIn} ${IN_MS}ms ease-out both`
        : undefined;

  return (
    <div
      // A new goal remounts, so it plays the entrance again.
      key={goal.id}
      className="sw-goal-motion"
      style={
        {
          position: "relative",
          width: "100%",
          height: "100%",
          animation,
          "--sw-goal-glow": cfg.fillColor,
        } as CSSProperties
      }
    >
      <style>{GOAL_KEYFRAMES}</style>
      <Preset view={view} cfg={cfg} pulseKey={pulseKey} celebrating={celebrating} />
      <Confetti play={celebrating} colors={[cfg.fillColor, cfg.fillColor2, cfg.textColor, "#ffbd7a"]} />
    </div>
  );
}
