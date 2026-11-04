"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useGoogleFonts } from "../../hooks/use-google-font";
import type { OverlayItem, OverlayScene } from "../../types";
import { normalizePollWidgetConfig } from "./poll-widget-config";
import {
  POLL_RESET_BROWSER_EVENT,
  applyPollFrame,
  isDemoPollFrame,
  seedPoll,
  type FetchedPoll,
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
import { useLiveWidgetState, type LiveWidgetSpec } from "../../hooks/use-live-widget-state";
import { useNow } from "../../hooks/use-now";
import { EditorHint } from "../editor-hint";

export interface PollWidgetRendererProps {
  item: OverlayItem;
  /** Needed for the live WS subscription and the poll fetch on the overlay. */
  scene?: OverlayScene;
  /** Editor flag: fetches through the dashboard session and shows a hint while empty. */
  isEditor?: boolean;
}

const IN_MS = 450;
const OUT_MS = 450;
/** A poll that closed this recently still gets its celebration when the widget first hears of it. */
const JUST_ENDED_MS = 3000;

const POLL_LIVE: LiveWidgetSpec<{ poll?: FetchedPoll | null }, FetchedPoll | null, PollWidgetState, PollWidgetFrame> = {
  resource: "poll",
  parse: (body) => body.poll ?? null,
  hasData: (poll) => poll !== null,
  empty: () => null,
  seed: seedPoll,
  applyFrame: applyPollFrame,
  isDemoFrame: isDemoPollFrame,
  resetEvent: POLL_RESET_BROWSER_EVENT,
};

export function PollWidgetRenderer({ item, scene, isEditor = false }: PollWidgetRendererProps) {
  const cfg = useMemo(() => normalizePollWidgetConfig(item.config), [item.config]);
  useGoogleFonts(useMemo(() => [cfg.fontFamily], [cfg.fontFamily]));

  const { state, demo, status } = useLiveWidgetState(POLL_LIVE, { scene, isEditor });

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
    if (status === "missing_scope") {
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
