"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { FitText, hexToRgba, type GoalCelebrationPlay } from "../../goal/presets/shared";
import type { PollWidgetCelebration, PollWidgetItemConfig } from "../poll-widget-config";
import type { PollChoiceView, PollView } from "../poll-view";

export {
  CELEBRATION_MS,
  Confetti,
  FitSvgText,
  FitText,
  GOAL_KEYFRAMES,
  capRadius,
  hexToRgba,
  textStyle,
} from "../../goal/presets/shared";

/** What every poll preset gets. */
export interface PollPresetProps {
  view: PollView;
  cfg: PollWidgetItemConfig;
  /** Per choice id: bumps each time its votes go up; keys that choice's flash. */
  pulses: Record<string, number>;
}

/** How long a share change eases. */
export const SHARE_MS = 600;
export const SHARE_EASE = "cubic-bezier(0.2, 0, 0, 1)";

/**
 * Poll-only keyframes, on top of the goal ones (entrances, confetti, glow and
 * the reduced-motion rule for `.sw-goal-motion`).
 */
export const POLL_KEYFRAMES = `
@keyframes sw-poll-flash { 0% { opacity: 0.55 } 100% { opacity: 0 } }
@keyframes sw-poll-win {
  0%, 100% { box-shadow: 0 0 0 2px var(--sw-poll-win), 0 0 0 0 var(--sw-poll-win) }
  50% { box-shadow: 0 0 0 2px var(--sw-poll-win), 0 0 18px 2px var(--sw-poll-win) }
}
`;

export function trackPaint(cfg: PollWidgetItemConfig): string {
  return hexToRgba(cfg.trackColor, cfg.trackOpacity);
}

/** A choice's number line: percent, votes, or both. */
export function choiceValueText(choice: PollChoiceView, cfg: PollWidgetItemConfig): string {
  const parts: string[] = [];
  if (cfg.showPercent) parts.push(choice.percentText);
  if (cfg.showVotes) parts.push(choice.votesText);
  return parts.join(" · ");
}

/** Once the poll closes, the choices that didn't win step back. */
export function choiceOpacity(view: PollView, choice: PollChoiceView): number {
  return view.ended && view.leader && !choice.isWinner ? 0.42 : 1;
}

/** The winner's pulsing outline while the result is up. */
export function winnerStyle(choice: PollChoiceView, cfg: PollWidgetItemConfig): CSSProperties {
  if (!choice.isWinner || cfg.celebration === "none") return {};
  return {
    "--sw-poll-win": choice.color,
    animation: "sw-poll-win 1400ms ease-in-out infinite",
  } as CSSProperties;
}

/** A white flash over a choice's fill, replayed on each vote. */
export function VoteFlash({ pulse, radius }: { pulse: number | undefined; radius?: number | string }) {
  if (!pulse) return null;
  return (
    <span
      key={pulse}
      className="sw-goal-motion sw-goal-pulse"
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: radius,
        background: "#ffffff",
        opacity: 0,
        animation: "sw-poll-flash 500ms ease-out",
        pointerEvents: "none",
      }}
    />
  );
}

/**
 * Title on the left; the countdown (or the result, once closed) on the right.
 * Renders nothing when both are off.
 */
export function PollHeader({ view, cfg, style }: { view: PollView; cfg: PollWidgetItemConfig; style?: CSSProperties }) {
  const showTitle = cfg.showTitle && view.title !== "";
  const right = view.ended ? view.resultText : cfg.showTimer ? view.timerText : "";
  if (!showTitle && !right) return null;
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: Math.round(cfg.fontSize * 0.6), minWidth: 0, flexShrink: 0, ...style }}>
      <span style={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {showTitle ? view.title : ""}
      </span>
      {right && (
        <FitText align="right" style={{ flexShrink: 0, maxWidth: showTitle ? "55%" : "100%", opacity: view.ended ? 1 : 0.85 }}>
          {right}
        </FitText>
      )}
    </div>
  );
}

/**
 * Per choice, a number that bumps each time its votes go up. The first
 * values of a poll never flash.
 */
export function useVotePulses(view: PollView | null, enabled: boolean): Record<string, number> {
  const [pulses, setPulses] = useState<Record<string, number>>({});
  const last = useRef<{ id: string; votes: Record<string, number> } | null>(null);
  const signature = view ? `${view.pollId}|${view.choices.map((c) => `${c.id}:${c.votes}`).join(",")}` : "";
  useEffect(() => {
    if (!view) return;
    const prev = last.current;
    const votes = Object.fromEntries(view.choices.map((c) => [c.id, c.votes]));
    last.current = { id: view.pollId, votes };
    if (!enabled || !prev || prev.id !== view.pollId) return;
    const risen = view.choices.filter((c) => c.votes > (prev.votes[c.id] ?? 0)).map((c) => c.id);
    if (risen.length === 0) return;
    setPulses((p) => {
      const next = { ...p };
      for (const id of risen) next[id] = (next[id] ?? 0) + 1;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, enabled]);
  return pulses;
}

/**
 * Plays the celebration once when a poll closes with a winner while the
 * widget is on screen, or when it closed a moment before the widget heard of
 * it. A refresh during the result doesn't replay it.
 */
export function usePollCelebration({
  pollId,
  ended,
  hasWinner,
  justEnded,
  kind,
}: {
  pollId: string;
  ended: boolean;
  hasWinner: boolean;
  justEnded: boolean;
  kind: PollWidgetCelebration;
}): GoalCelebrationPlay | null {
  const [play, setPlay] = useState<GoalCelebrationPlay | null>(null);
  const last = useRef<{ id: string; ended: boolean } | null>(null);
  useEffect(() => {
    const prev = last.current;
    last.current = { id: pollId, ended };
    if (!ended || !hasWinner || kind === "none") return;
    const closedHere = prev?.id === pollId && !prev.ended;
    const arrivedClosed = prev?.id !== pollId && justEnded;
    if (!closedHere && !arrivedClosed) return;
    setPlay((p) => ({ kind, key: (p?.key ?? 0) + 1 }));
  }, [pollId, ended, hasWinner, justEnded, kind]);
  useEffect(() => {
    if (!play) return;
    const id = setTimeout(() => setPlay(null), 2500);
    return () => clearTimeout(id);
  }, [play]);
  return play;
}
