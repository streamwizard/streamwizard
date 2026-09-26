import { AD_TIME_TOKEN, type AdWidgetItemConfig } from "./ad-widget-config";

/** How long the welcome back stays up after a break. */
export const AD_BACK_MS = 5000;

export interface AdScheduleSnapshot {
  /** Epoch ms of the next scheduled ad; null when none is scheduled. */
  nextAdAt: number | null;
  /** Seconds the next break runs; 0 when unknown. */
  duration: number;
  snoozeCount: number;
}

export interface AdBreakSnapshot {
  startedAt: number;
  endsAt: number;
}

export interface AdWidgetState {
  schedule: AdScheduleSnapshot | null;
  /** The latest ad break (running or just over). */
  adBreak: AdBreakSnapshot | null;
}

export const EMPTY_AD_STATE: AdWidgetState = { schedule: null, adBreak: null };

export interface AdWidgetFrame {
  type: string;
  payload?: unknown;
}

/**
 * The test ad break carries `demo: true` (see the channel.ad_break.begin
 * fixture in @repo/schemas); a real one never does, and has no id to mark.
 */
export function isDemoAdFrame(frame: AdWidgetFrame): boolean {
  return (frame?.payload as { demo?: unknown } | null | undefined)?.demo === true;
}

/**
 * Browser event the ad settings fire to preview the heads-up on the editor
 * canvas. Twitch has no event for an upcoming ad, so there's nothing to send
 * over the socket; this stays in the tab. detail: `{ sceneId, nextAdAt, duration }`.
 */
export const AD_SCHEDULE_TEST_BROWSER_EVENT = "streamwizard:ad-schedule-test";

export interface AdScheduleTestBrowserEventDetail {
  sceneId: string;
  nextAdAt: number;
  duration: number;
}

/** Drops the tests and reads the real schedule again. detail: `{ sceneId }`. */
export const AD_RESET_BROWSER_EVENT = "streamwizard:ad-reset";

export interface AdResetBrowserEventDetail {
  sceneId: string;
}

/** The schedule from GET /api/twitch/ads (see PublicAdSchedule in @repo/twitch-assets). */
export interface FetchedAdSchedule {
  next_ad_at: string | null;
  duration: number;
  snooze_count: number;
}

export function scheduleFrom(fetched: FetchedAdSchedule | null | undefined): AdScheduleSnapshot | null {
  if (!fetched) return null;
  const next = fetched.next_ad_at ? Date.parse(fetched.next_ad_at) : NaN;
  return {
    nextAdAt: Number.isFinite(next) ? next : null,
    duration: typeof fetched.duration === "number" && fetched.duration > 0 ? fetched.duration : 0,
    snoozeCount: typeof fetched.snooze_count === "number" ? fetched.snooze_count : 0,
  };
}

/**
 * Applies one socket frame. Only channel.ad_break.begin matters; anything
 * else returns the same state, so the room's other traffic costs no render.
 */
export function applyAdFrame(state: AdWidgetState, frame: AdWidgetFrame, now: number): AdWidgetState {
  if (frame?.type !== "channel.ad_break.begin") return state;
  const p = frame.payload as Record<string, unknown> | null | undefined;
  if (!p || typeof p !== "object") return state;
  const seconds = Number(p.duration_seconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return state;
  const started = typeof p.started_at === "string" ? Date.parse(p.started_at) : NaN;
  // Twitch's clock and ours can disagree by a few seconds; a start in the
  // future or far past would skew the countdown, so trust arrival then.
  const startedAt = Number.isFinite(started) && Math.abs(now - started) < 30_000 ? started : now;
  return {
    // The break is this ad; the schedule's "next ad" is now stale until refetched.
    schedule: state.schedule ? { ...state.schedule, nextAdAt: null } : null,
    adBreak: { startedAt, endsAt: startedAt + seconds * 1000 },
  };
}

export type AdPhase = "idle" | "warning" | "running" | "back";

export interface AdPhaseView {
  phase: AdPhase;
  /** Whole seconds to the ad (warning) or to the end of the break (running). */
  secondsLeft: number;
  /** 1 → 0 as the countdown runs out. */
  remaining: number;
  /** m:ss */
  timeText: string;
  /** The configured line for this phase, with {time} filled in. */
  text: string;
  /** Epoch ms of the next ad even while idle, for the editor hint. */
  nextAdAt: number | null;
}

export function formatAdTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function fill(template: string, time: string): string {
  return template.split(AD_TIME_TOKEN).join(time);
}

/**
 * What the widget shows at `now`. A running break wins over everything; then
 * the welcome back; then the heads-up once the next ad is inside the warning
 * window. Each phase can be switched off, which falls through to idle.
 */
export function adPhase(state: AdWidgetState, cfg: AdWidgetItemConfig, now: number): AdPhaseView {
  const nextAdAt = state.schedule?.nextAdAt ?? null;
  const idle: AdPhaseView = { phase: "idle", secondsLeft: 0, remaining: 0, timeText: "", text: "", nextAdAt };
  const b = state.adBreak;

  if (b && now < b.endsAt) {
    if (!cfg.showRunning) return idle;
    const secondsLeft = Math.ceil((b.endsAt - now) / 1000);
    const total = Math.max(1, b.endsAt - b.startedAt);
    const timeText = formatAdTime(secondsLeft);
    return {
      phase: "running",
      secondsLeft,
      remaining: Math.min(1, Math.max(0, (b.endsAt - now) / total)),
      timeText,
      text: fill(cfg.runningText, timeText),
      nextAdAt,
    };
  }

  if (b && now < b.endsAt + AD_BACK_MS && cfg.showBackMessage && cfg.backText.trim()) {
    return { phase: "back", secondsLeft: 0, remaining: 0, timeText: "", text: cfg.backText, nextAdAt };
  }

  if (nextAdAt !== null && cfg.showWarning) {
    const window = cfg.warnMinutes * 60_000;
    const left = nextAdAt - now;
    if (left > 0 && left <= window) {
      const secondsLeft = Math.ceil(left / 1000);
      const timeText = formatAdTime(secondsLeft);
      return {
        phase: "warning",
        secondsLeft,
        remaining: Math.min(1, left / window),
        timeText,
        text: fill(cfg.warningText, timeText),
        nextAdAt,
      };
    }
  }

  return idle;
}
