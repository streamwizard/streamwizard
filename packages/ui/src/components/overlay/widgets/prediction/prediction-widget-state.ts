/** One outcome as the widget draws it. */
export interface PredictionOutcomeSnapshot {
  id: string;
  title: string;
  /** Channel points put on it. */
  points: number;
  /** How many viewers picked it. */
  users: number;
}

/**
 * Open for points, locked and waiting for the result, or over: resolved with a
 * winner, or canceled with everyone refunded.
 */
export type PredictionStatus = "active" | "locked" | "resolved" | "canceled";

/** The prediction as the widget draws it. Same fields for the Helix fetch and the events. */
export interface PredictionSnapshot {
  id: string;
  title: string;
  outcomes: PredictionOutcomeSnapshot[];
  status: PredictionStatus;
  /** Epoch ms it stops taking points, while it is open. */
  locksAt: number | null;
  /** Epoch ms it was resolved or canceled; set once it has been. */
  endedAt: number | null;
  /** The outcome the streamer picked; null until resolved, and on a cancel. */
  winningOutcomeId: string | null;
}

/** Twitch runs one prediction per channel at a time; null when there's none to show. */
export type PredictionWidgetState = PredictionSnapshot | null;

/**
 * Test predictions use this id (the Test buttons); see demoPrediction in
 * @repo/schemas. The widget keeps them apart from the real prediction so a
 * reset can drop them.
 */
export const DEMO_PREDICTION_ID = "demo-prediction";

export function isDemoPredictionFrame(frame: PredictionWidgetFrame): boolean {
  const id = (frame?.payload as { id?: unknown } | null | undefined)?.id;
  return typeof id === "string" && id.startsWith(DEMO_PREDICTION_ID);
}

/**
 * Browser event the prediction settings fire to put the editor canvas back on
 * the real Twitch data: the test prediction is dropped and the prediction is
 * fetched again. detail: `{ sceneId }`.
 */
export const PREDICTION_RESET_BROWSER_EVENT = "streamwizard:prediction-reset";

export interface PredictionResetBrowserEventDetail {
  sceneId: string;
}

export const PREDICTION_WIDGET_FRAME_TYPES = [
  "channel.prediction.begin",
  "channel.prediction.progress",
  "channel.prediction.lock",
  "channel.prediction.end",
] as const;

export interface PredictionWidgetFrame {
  type: string;
  payload?: unknown;
}

/** The prediction from GET /api/twitch/prediction (see PublicPrediction in @repo/twitch-assets). */
export interface FetchedPrediction {
  id: string;
  title: string;
  outcomes: { id: string; title: string; users: number; channel_points: number }[];
  status: string;
  locks_at: string;
  ended_at: string | null;
  winning_outcome_id: string | null;
}

function time(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function outcomesFrom(raw: unknown): PredictionOutcomeSnapshot[] | null {
  if (!Array.isArray(raw)) return null;
  const outcomes: PredictionOutcomeSnapshot[] = [];
  for (const o of raw) {
    if (!o || typeof o !== "object") continue;
    const { id, title, channel_points, users } = o as Record<string, unknown>;
    if (typeof id !== "string") continue;
    outcomes.push({
      id,
      title: typeof title === "string" ? title : "",
      points: count(channel_points),
      users: count(users),
    });
  }
  return outcomes.length > 0 ? outcomes : null;
}

/** The winner, when it names one of the outcomes. Twitch sends "" on a cancel. */
function winnerFrom(value: unknown, outcomes: PredictionOutcomeSnapshot[]): string | null {
  return typeof value === "string" && outcomes.some((o) => o.id === value) ? value : null;
}

/**
 * Applies one socket frame. Returns the same state when the frame isn't a
 * prediction event (or changes nothing), so the rest of the room's traffic
 * costs no re-render.
 *
 * - begin opens a prediction at zero points;
 * - progress updates the points. One that arrives after the lock still counts
 *   (it is the last points landing) but does not reopen the prediction, and
 *   one after the end is dropped: the end's numbers are final;
 * - lock stops the countdown and waits for the result;
 * - end resolves it with a winner, or cancels it.
 */
export function applyPredictionFrame(
  state: PredictionWidgetState,
  frame: PredictionWidgetFrame,
  now: number
): PredictionWidgetState {
  if (!(PREDICTION_WIDGET_FRAME_TYPES as readonly string[]).includes(frame?.type)) return state;
  const p = frame.payload as Record<string, unknown> | null | undefined;
  if (!p || typeof p !== "object" || typeof p.id !== "string") return state;
  const outcomes = outcomesFrom(p.outcomes);
  if (!outcomes) return state;
  const base = { id: p.id, title: typeof p.title === "string" ? p.title : "", outcomes };

  if (frame.type === "channel.prediction.end") {
    const resolved = p.status !== "canceled";
    const winningOutcomeId = resolved ? winnerFrom(p.winning_outcome_id, outcomes) : null;
    return {
      ...base,
      // Resolved with no outcome we know of is as good as canceled: nothing to crown.
      status: winningOutcomeId ? "resolved" : "canceled",
      locksAt: null,
      endedAt: now,
      winningOutcomeId,
    };
  }

  if (frame.type === "channel.prediction.lock") {
    if (state?.id === p.id && state.endedAt !== null) return state;
    return { ...base, status: "locked", locksAt: null, endedAt: null, winningOutcomeId: null };
  }

  if (frame.type === "channel.prediction.progress" && state?.id === p.id) {
    if (state.endedAt !== null) return state;
    if (state.status === "locked") return { ...state, outcomes };
  }

  return { ...base, status: "active", locksAt: time(p.locks_at), endedAt: null, winningOutcomeId: null };
}

/**
 * Seeds the state from the Helix fetch. An event that already arrived wins:
 * it came after the page loaded, so it is at least as new as the fetch.
 */
export function seedPrediction(
  state: PredictionWidgetState,
  prediction: FetchedPrediction | null | undefined
): PredictionWidgetState {
  if (state || !prediction || typeof prediction.id !== "string") return state;
  const outcomes = outcomesFrom(prediction.outcomes);
  if (!outcomes) return state;
  const base = { id: prediction.id, title: typeof prediction.title === "string" ? prediction.title : "", outcomes };

  if (prediction.status === "active") {
    return { ...base, status: "active", locksAt: time(prediction.locks_at), endedAt: null, winningOutcomeId: null };
  }
  if (prediction.status === "locked") {
    return { ...base, status: "locked", locksAt: null, endedAt: null, winningOutcomeId: null };
  }
  if (prediction.status !== "resolved" && prediction.status !== "canceled") return state;
  const winningOutcomeId =
    prediction.status === "resolved" ? winnerFrom(prediction.winning_outcome_id, outcomes) : null;
  return {
    ...base,
    status: winningOutcomeId ? "resolved" : "canceled",
    locksAt: null,
    // One that ended before the page loaded keeps its real end time, so the
    // result only stays up for what's left of it.
    endedAt: time(prediction.ended_at) ?? Date.now(),
    winningOutcomeId,
  };
}
