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
 * - hybrid: hero cards first (each fades in, holds, fades out), then the roll
 *   scrolls, starting as the last card fades so the two read as one piece.
 */
export type CreditsPlaybackMode = "scroll" | "step" | "hybrid";

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
  /** When the scrolling part begins and how long it runs. Scroll: 0 and totalMs. Step: 0 and 0. */
  scrollStartMs: number;
  scrollMs: number;
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

export function creditsPlaybackMode(cfg: CreditsWidgetItemConfig, reducedMotion: boolean): CreditsPlaybackMode {
  if (reducedMotion) return "step";
  if (cfg.preset === "hybrid") return "hybrid";
  return isCreditsScrollPreset(cfg.preset) ? "scroll" : "step";
}

/** One hero card's time on screen: fade in, hold, fade out. */
export function heroCardMs(cfg: CreditsWidgetItemConfig): number {
  return cfg.heroFadeMs * 2 + cfg.heroHoldSeconds * 1000;
}

/** Where a scrolling roll ends: its tail just past the near edge, so nothing is left in the box. */
export function scrollEndPx(measured: CreditsMeasured): number {
  return -measured.contentPx;
}

/**
 * `sections` is what scrolls or steps; `heroes` (Hybrid only) are the cards
 * that play first. Under reduced motion a Hybrid roll steps through the
 * heroes and then the sections, so pass them combined as `sections` then.
 */
export function creditsTimeline(
  sections: readonly CreditsViewSection[],
  cfg: CreditsWidgetItemConfig,
  measured: CreditsMeasured,
  reducedMotion: boolean,
  heroes: readonly CreditsViewSection[] = [],
): CreditsTimeline {
  const mode = creditsPlaybackMode(cfg, reducedMotion);

  if (mode === "scroll" || mode === "hybrid") {
    const fromPx = measured.viewportPx;
    const toPx = scrollEndPx(measured);
    const distance = Math.max(0, fromPx - toPx);
    const scrollMs = sections.length === 0 ? 0 : Math.round((distance / Math.max(1, cfg.scrollSpeed)) * 1000);
    if (mode === "scroll") {
      return { mode, totalMs: scrollMs, steps: [], fromPx, toPx, scrollStartMs: 0, scrollMs };
    }
    const cardMs = heroCardMs(cfg);
    const steps: CreditsTimelineStep[] = heroes.map((_, i) => ({ startMs: i * cardMs, durationMs: cardMs }));
    const heroesEndMs = steps.length * cardMs;
    // The roll comes in under the last card's fade-out, so there's no dead beat between the two.
    const scrollStartMs = steps.length > 0 && scrollMs > 0 ? Math.max(0, heroesEndMs - cfg.heroFadeMs) : heroesEndMs;
    return { mode, totalMs: scrollStartMs + scrollMs, steps, fromPx, toPx, scrollStartMs, scrollMs };
  }

  let at = 0;
  const steps: CreditsTimelineStep[] = sections.map((section) => {
    const names = Math.min(section.names.length, STEP_NAMES_COUNTED);
    const durationMs = cfg.secondsPerSection * 1000 + STEP_MS_PER_NAME * names;
    const step = { startMs: at, durationMs };
    at += durationMs;
    return step;
  });
  return { mode, totalMs: at, steps, fromPx: 0, toPx: 0, scrollStartMs: 0, scrollMs: 0 };
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

/** 0–1 through the scrolling part only; 0 before it starts. */
export function scrollProgressAt(timeline: CreditsTimeline, elapsedMs: number): number {
  if (timeline.scrollMs <= 0) return elapsedMs >= timeline.scrollStartMs ? 1 : 0;
  return Math.min(1, Math.max(0, (elapsedMs - timeline.scrollStartMs) / timeline.scrollMs));
}

/** Hybrid: which hero card is up at `elapsedMs`, or -1 once the cards are done. */
export function heroIndexAt(timeline: CreditsTimeline, elapsedMs: number): number {
  const { steps } = timeline;
  if (steps.length === 0) return -1;
  const last = steps[steps.length - 1]!;
  if (elapsedMs >= last.startMs + last.durationMs) return -1;
  return stepIndexAt(timeline, elapsedMs);
}

/** The content's offset along the scroll axis at `progress`, in px. */
export function scrollOffsetAt(timeline: CreditsTimeline, progress: number): number {
  return timeline.fromPx + (timeline.toPx - timeline.fromPx) * progress;
}
