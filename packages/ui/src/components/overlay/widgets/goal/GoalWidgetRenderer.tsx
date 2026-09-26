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
  type GoalResetBrowserEventDetail,
  type GoalWidgetState,
} from "./goal-widget-state";
import { buildGoalView } from "./goal-view";
import {
  Confetti,
  GOAL_KEYFRAMES,
  GOAL_PRESET_COMPONENTS,
  useCelebration,
  useProgressPulse,
} from "./presets";

export interface GoalWidgetRendererProps {
  item: OverlayItem;
  /** Needed for the live WS subscription and the goals fetch on the overlay. */
  scene?: OverlayScene;
  /** Editor flag: fetches through the dashboard session and shows a hint while empty. */
  isEditor?: boolean;
}

/**
 * On the live overlay a test goal (Live mode) steps aside for the real one
 * after this long. The editor keeps it until the settings' reset.
 */
const DEMO_CLEAR_MS = 15_000;

const IN_MS = 450;
const OUT_MS = 450;
/** An end event this recent still counts as "just reached" for a celebration. */
const JUST_ENDED_MS = 3000;

/** How long a finished goal stays up when the widget is set to hide it. */
const HIDE_AFTER_END_MS = 8000;


type FetchStatus = "loading" | "ready" | "missing_scope" | "failed";

/**
 * Loads the channel's active goals once. The overlay asks its own origin with
 * the scene's subscriber token; the editor asks the dashboard with the session.
 */
function useFetchedGoals(isEditor: boolean, token: string | undefined, refreshKey: number) {
  const [result, setResult] = useState<{ status: FetchStatus; goals: FetchedGoal[] }>({
    status: "loading",
    goals: [],
  });

  useEffect(() => {
    if (!isEditor && !token) return;
    let cancelled = false;
    const url = isEditor ? "/api/twitch/assets/goals" : "/api/twitch/goals";
    const init: RequestInit | undefined = isEditor
      ? undefined
      : { headers: { Authorization: `Bearer ${token}` } };
    (async () => {
      try {
        const res = await fetch(url, init);
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { goals?: FetchedGoal[]; missing_scope?: boolean };
        if (cancelled) return;
        setResult({
          status: body.missing_scope ? "missing_scope" : "ready",
          goals: Array.isArray(body.goals) ? body.goals : [],
        });
      } catch {
        if (!cancelled) setResult({ status: "failed", goals: [] });
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


export function GoalWidgetRenderer({ item, scene, isEditor = false }: GoalWidgetRendererProps) {
  const cfg = useMemo(() => normalizeGoalWidgetConfig(item.config), [item.config]);
  useGoogleFonts(useMemo(() => [cfg.fontFamily], [cfg.fontFamily]));

  const widgetType: GoalWidgetType = isGoalWidgetType(item.type) ? item.type : "follower_goal_widget";
  const types = twitchGoalTypesFor(widgetType);

  const token = scene?.subscriber_token;
  const [refreshKey, setRefreshKey] = useState(0);
  const fetched = useFetchedGoals(isEditor, token, refreshKey);
  // Real goals (Helix + live events) and test goals, kept apart so a reset
  // drops the tests while the real ones keep tracking underneath.
  const [state, setState] = useState<GoalWidgetState>({});
  const [demo, setDemo] = useState<GoalWidgetState>({});
  const [demoAt, setDemoAt] = useState<number | null>(null);
  const replaceOnFetch = useRef(false);

  useEffect(() => {
    if (replaceOnFetch.current) {
      // After a reset the fetch is the truth, including "no goal any more".
      if (fetched.status === "loading") return;
      replaceOnFetch.current = false;
      setState(seedGoals({}, fetched.goals));
      return;
    }
    if (fetched.goals.length > 0) setState((prev) => seedGoals(prev, fetched.goals));
  }, [fetched]);

  const apply = useCallback((frame: GoalWidgetFrame) => {
    const now = Date.now();
    if (isDemoGoalFrame(frame)) {
      setDemo((prev) => applyGoalFrame(prev, frame, now));
      setDemoAt(now);
      return;
    }
    setState((prev) => applyGoalFrame(prev, frame, now));
  }, []);

  // Live goal events over the scene's shared WS room.
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_SERVER_URL ?? "";
    if (!token || !wsUrl) return;
    return subscribeToWsRoom(token, wsUrl, (raw) => apply(raw as GoalWidgetFrame));
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

  // Editor: the settings' reset drops the tests and reads Twitch again.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onReset = (e: Event) => {
      const detail = (e as CustomEvent<GoalResetBrowserEventDetail>).detail;
      if (!detail || (scene && detail.sceneId !== scene.id)) return;
      setDemo({});
      setDemoAt(null);
      replaceOnFetch.current = true;
      setRefreshKey((k) => k + 1);
    };
    window.addEventListener(GOAL_RESET_BROWSER_EVENT, onReset);
    return () => window.removeEventListener(GOAL_RESET_BROWSER_EVENT, onReset);
  }, [scene]);

  // Live overlay: nobody is there to press reset, so tests clear themselves.
  useEffect(() => {
    if (isEditor || demoAt === null) return;
    const id = setTimeout(() => {
      setDemo({});
      setDemoAt(null);
    }, Math.max(0, demoAt + DEMO_CLEAR_MS - Date.now()));
    return () => clearTimeout(id);
  }, [isEditor, demoAt]);

  const goal = pickGoal(demo, types) ?? pickGoal(state, types);

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
    if (fetched.status === "missing_scope") {
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
