import { isCreditsScrollPreset, type CreditsWidgetItemConfig } from "./credits-widget-config";
import type { CreditsViewSection } from "./credits-view";

/**
 * The timing of one roll, worked out from the content and the config. Pure,
 * so the editor, the overlay and the tests all agree on how long a roll is.
 *
 * Two modes:
 * - scroll: the whole roll moves past at `scrollSpeed` px/s, in from just
 *   off the far edge and out past the near one, so it ends with the box
 *   empty. A looping scroll wraps straight round: both ends are off screen,
 *   so the next pass starts without a cut.
 * - step: one section at a time, each up for `secondsPerSection` plus a beat
 *   per name so long lists get read.
 */
export type CreditsPlaybackMode = "scroll" | "step";

export interface CreditsTimelineStep {
  startMs: number;
  durationMs: number;
}

export interface CreditsTimeline {
  mode: CreditsPlaybackMode;
  totalMs: number;
  steps: CreditsTimelineStep[];
  /** Scroll only: where the content sits at progress 0 (off the far edge) and 1 (out past the near one). */
  fromPx: number;
  toPx: number;
}

export interface CreditsMeasured {
  /** The roll's full length along the scroll axis (height, or width for the ticker). */
  contentPx: number;
  /** The widget's length along the same axis. */
  viewportPx: number;
}

/** Extra time a section stays up per name, so a long list isn't a flash. */
export const STEP_MS_PER_NAME = 350;
/** Names past this don't add time; the list is scanned, not read. */
export const STEP_NAMES_COUNTED = 12;
/** A stepped roll that has ended holds its last section this long before looping. Scrolls don't hold. */
export const LOOP_HOLD_MS = 2500;

export function creditsPlaybackMode(cfg: CreditsWidgetItemConfig, reducedMotion: boolean): CreditsPlaybackMode {
  if (reducedMotion) return "step";
  return isCreditsScrollPreset(cfg.preset) ? "scroll" : "step";
}

/** Where a scrolling roll ends: its tail just past the near edge, so nothing is left in the box. */
export function scrollEndPx(measured: CreditsMeasured): number {
  return -measured.contentPx;
}

export function creditsTimeline(
  sections: readonly CreditsViewSection[],
  cfg: CreditsWidgetItemConfig,
  measured: CreditsMeasured,
  reducedMotion: boolean,
): CreditsTimeline {
  const mode = creditsPlaybackMode(cfg, reducedMotion);

  if (mode === "scroll") {
    const fromPx = measured.viewportPx;
    const toPx = scrollEndPx(measured);
    const distance = Math.max(0, fromPx - toPx);
    const totalMs = Math.round((distance / Math.max(1, cfg.scrollSpeed)) * 1000);
    return { mode, totalMs, steps: [], fromPx, toPx };
  }

  let at = 0;
  const steps: CreditsTimelineStep[] = sections.map((section) => {
    const names = Math.min(section.names.length, STEP_NAMES_COUNTED);
    const durationMs = cfg.secondsPerSection * 1000 + STEP_MS_PER_NAME * names;
    const step = { startMs: at, durationMs };
    at += durationMs;
    return step;
  });
  return { mode, totalMs: at, steps, fromPx: 0, toPx: 0 };
}

/** Which section is up at `elapsedMs`; the last one once the roll has ended. -1 with no steps. */
export function stepIndexAt(timeline: CreditsTimeline, elapsedMs: number): number {
  const { steps } = timeline;
  if (steps.length === 0) return -1;
  for (let i = steps.length - 1; i >= 0; i--) {
    if (elapsedMs >= steps[i]!.startMs) return i;
  }
  return 0;
}

/** 0–1 through the roll. */
export function progressAt(timeline: CreditsTimeline, elapsedMs: number): number {
  if (timeline.totalMs <= 0) return 1;
  return Math.min(1, Math.max(0, elapsedMs / timeline.totalMs));
}

/** The content's offset along the scroll axis at `progress`, in px. */
export function scrollOffsetAt(timeline: CreditsTimeline, progress: number): number {
  return timeline.fromPx + (timeline.toPx - timeline.fromPx) * progress;
}
