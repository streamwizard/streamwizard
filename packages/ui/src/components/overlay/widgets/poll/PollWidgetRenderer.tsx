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
import { normalizePollWidgetConfig } from "./poll-widget-config";
import {
  POLL_RESET_BROWSER_EVENT,
  applyPollFrame,
  isDemoPollFrame,
  seedPoll,
  type FetchedPoll,
  type PollResetBrowserEventDetail,
  type PollWidgetFrame,
  type PollWidgetState,
} from "./poll-widget-state";
import { buildPollView } from "./poll-view";
import {
  Confetti,
  GOAL_KEYFRAMES,
  POLL_KEYFRAMES,
  POLL_PRESET_COMPONENTS,
  usePollCelebration,
  useVotePulses,
} from "./presets";

export interface PollWidgetRendererProps {
  item: OverlayItem;
  /** Needed for the live WS subscription and the poll fetch on the overlay. */
  scene?: OverlayScene;
  /** Editor flag: fetches through the dashboard session and shows a hint while empty. */
  isEditor?: boolean;
}

/**
 * On the live overlay a test poll (Live mode) steps aside for the real one
 * after this long. The editor keeps it until the settings' reset.
 */
const DEMO_CLEAR_MS = 15_000;

const IN_MS = 450;
const OUT_MS = 450;
/** A poll that closed this recently still gets its celebration when the widget first hears of it. */
const JUST_ENDED_MS = 3000;

type FetchStatus = "loading" | "ready" | "missing_scope" | "failed";

/**
 * Loads the channel's running (or just-closed) poll once. The overlay asks
 * its own origin with the scene's subscriber token; the editor asks the
 * dashboard with the session.
 */
function useFetchedPoll(isEditor: boolean, token: string | undefined, refreshKey: number) {
  const [result, setResult] = useState<{ status: FetchStatus; poll: FetchedPoll | null }>({
    status: "loading",
    poll: null,
  });

  useEffect(() => {
    if (!isEditor && !token) return;
    let cancelled = false;
    const url = isEditor ? "/api/twitch/assets/poll" : "/api/twitch/poll";
    const init: RequestInit | undefined = isEditor
      ? undefined
      : { headers: { Authorization: `Bearer ${token}` } };
    (async () => {
      try {
        const res = await fetch(url, init);
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { poll?: FetchedPoll | null; missing_scope?: boolean };
        if (cancelled) return;
        setResult({ status: body.missing_scope ? "missing_scope" : "ready", poll: body.poll ?? null });
      } catch {
        if (!cancelled) setResult({ status: "failed", poll: null });
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

export function PollWidgetRenderer({ item, scene, isEditor = false }: PollWidgetRendererProps) {
  const cfg = useMemo(() => normalizePollWidgetConfig(item.config), [item.config]);
  useGoogleFonts(useMemo(() => [cfg.fontFamily], [cfg.fontFamily]));

  const token = scene?.subscriber_token;
  const [refreshKey, setRefreshKey] = useState(0);
  const fetched = useFetchedPoll(isEditor, token, refreshKey);
  // The real poll (Helix + live events) and the test poll, kept apart so a
  // reset drops the test while the real one keeps tracking underneath.
  const [state, setState] = useState<PollWidgetState>(null);
  const [demo, setDemo] = useState<PollWidgetState>(null);
  const [demoAt, setDemoAt] = useState<number | null>(null);
  const replaceOnFetch = useRef(false);

  useEffect(() => {
    if (replaceOnFetch.current) {
      // After a reset the fetch is the truth, including "no poll any more".
      if (fetched.status === "loading") return;
      replaceOnFetch.current = false;
      setState(seedPoll(null, fetched.poll));
      return;
    }
    if (fetched.poll) setState((prev) => seedPoll(prev, fetched.poll));
  }, [fetched]);

  const apply = useCallback((frame: PollWidgetFrame) => {
    const now = Date.now();
    if (isDemoPollFrame(frame)) {
      setDemo((prev) => applyPollFrame(prev, frame, now));
      setDemoAt(now);
      return;
    }
    setState((prev) => applyPollFrame(prev, frame, now));
  }, []);

  // Live poll events over the scene's shared WS room.
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_SERVER_URL ?? "";
    if (!token || !wsUrl) return;
    return subscribeToWsRoom(token, wsUrl, (raw) => apply(raw as PollWidgetFrame));
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
      const detail = (e as CustomEvent<PollResetBrowserEventDetail>).detail;
      if (!detail || (scene && detail.sceneId !== scene.id)) return;
      setDemo(null);
      setDemoAt(null);
      replaceOnFetch.current = true;
      setRefreshKey((k) => k + 1);
    };
    window.addEventListener(POLL_RESET_BROWSER_EVENT, onReset);
    return () => window.removeEventListener(POLL_RESET_BROWSER_EVENT, onReset);
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

  const poll = demo ?? state;
  const now = useNow(poll !== null && poll.endedAt === null);

  // A closed poll shows its result for `hideAfterSeconds`, then leaves. The
  // exit animation starts a little before it comes off screen.
  const [hiddenPollId, setHiddenPollId] = useState<string | null>(null);
  const [leavingPollId, setLeavingPollId] = useState<string | null>(null);
  const endedAt = poll?.endedAt ?? null;
  const pollId = poll?.id ?? null;
  const outMs = cfg.animationOut === "none" ? 0 : OUT_MS;
  const hideMs = cfg.hideAfterSeconds * 1000;
  useEffect(() => {
    setLeavingPollId(null);
    setHiddenPollId(null);
    if (endedAt === null || pollId === null) return;
    const hideIn = Math.max(0, endedAt + hideMs - Date.now());
    const leave = setTimeout(() => setLeavingPollId(pollId), Math.max(0, hideIn - outMs));
    const hide = setTimeout(() => setHiddenPollId(pollId), hideIn);
    return () => {
      clearTimeout(leave);
      clearTimeout(hide);
    };
  }, [endedAt, pollId, outMs, hideMs]);

  const view = poll ? buildPollView(poll, cfg, now) : null;
  // Hooks run on every render, so they get stand-ins while there's no poll.
  const pulses = useVotePulses(view, cfg.pulseOnVote);
  const celebrating = usePollCelebration({
    pollId: view?.pollId ?? "",
    ended: view?.ended ?? false,
    hasWinner: view !== null && view.resultText !== "" && view.resultText !== "Tie" && view.resultText !== "No votes",
    justEnded: endedAt !== null && Date.now() - endedAt < JUST_ENDED_MS,
    kind: cfg.celebration,
  });

  if (!poll || !view || hiddenPollId === poll.id) {
    if (!isEditor) return null;
    if (fetched.status === "missing_scope") {
      return (
        <EditorHint title="Poll" body="Reconnect Twitch in this widget's settings so StreamWizard can read your polls." />
      );
    }
    if (poll) {
      return <EditorHint title="Poll" body="Poll closed. Hidden on stream until your next one starts." />;
    }
    return <EditorHint title="Poll" body="No poll running. Start one on Twitch and it shows up here." />;
  }

  const Preset = POLL_PRESET_COMPONENTS[cfg.preset];
  const leaving = leavingPollId === poll.id && cfg.animationOut !== "none";
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
      // A new poll remounts, so it plays the entrance again.
      key={poll.id}
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
