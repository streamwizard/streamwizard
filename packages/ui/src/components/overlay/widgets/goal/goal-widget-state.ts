import { TWITCH_GOAL_TYPES, type TwitchGoalType } from "./goal-widget-config";

/** One goal as the widget draws it. Same fields for the Helix fetch and the events. */
export interface GoalSnapshot {
  id: string;
  type: TwitchGoalType;
  description: string;
  current: number;
  target: number;
  /** Set once channel.goal.end arrives. */
  ended: null | { achieved: boolean; at: number };
}

/** The latest goal per Twitch goal type. Twitch runs at most one per type. */
export type GoalWidgetState = Partial<Record<TwitchGoalType, GoalSnapshot>>;

/**
 * Test goals (the Test buttons and the demo bar) use ids with this prefix; see
 * demoGoal in @repo/schemas widget-test-events. The widget keeps them apart
 * from the real goals so a reset can drop them.
 */
export const DEMO_GOAL_ID_PREFIX = "demo-goal-";

export function isDemoGoalFrame(frame: GoalWidgetFrame): boolean {
  const id = (frame?.payload as { id?: unknown } | null | undefined)?.id;
  return typeof id === "string" && id.startsWith(DEMO_GOAL_ID_PREFIX);
}

/**
 * Browser event the goal settings fire to put the editor canvas back on the
 * real Twitch data: test goals are dropped and the goals are fetched again.
 * detail: `{ sceneId }`.
 */
export const GOAL_RESET_BROWSER_EVENT = "streamwizard:goal-reset";

export interface GoalResetBrowserEventDetail {
  sceneId: string;
}

export const GOAL_WIDGET_FRAME_TYPES = ["channel.goal.begin", "channel.goal.progress", "channel.goal.end"] as const;

export interface GoalWidgetFrame {
  type: string;
  payload?: unknown;
}

/** A goal from GET /api/twitch/goals (see PublicGoal in @repo/twitch-assets). */
export interface FetchedGoal {
  id: string;
  type: string;
  description: string;
  current_amount: number;
  target_amount: number;
}

/**
 * Twitch spells the follower goal two ways: Get Creator Goals says "follower",
 * the channel.goal.* events say "follow". Both map to "follow".
 */
export function toGoalType(value: unknown): TwitchGoalType | null {
  if (value === "follower") return "follow";
  return (TWITCH_GOAL_TYPES as readonly unknown[]).includes(value) ? (value as TwitchGoalType) : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Applies one socket frame. Returns the same object when the frame isn't a
 * goal event, so the rest of the room's traffic costs no re-render.
 */
export function applyGoalFrame(state: GoalWidgetState, frame: GoalWidgetFrame, now: number): GoalWidgetState {
  if (!(GOAL_WIDGET_FRAME_TYPES as readonly string[]).includes(frame?.type)) return state;
  const p = frame.payload as Record<string, unknown> | null | undefined;
  if (!p || typeof p !== "object" || typeof p.id !== "string") return state;
  const type = toGoalType(p.type);
  if (!type) return state;
  const current = num(p.current_amount);
  const target = num(p.target_amount);
  if (current === null || target === null) return state;

  const snapshot: GoalSnapshot = {
    id: p.id,
    type,
    description: typeof p.description === "string" ? p.description : "",
    current,
    target,
    ended:
      frame.type === "channel.goal.end"
        ? { achieved: p.is_achieved === true, at: now }
        : null,
  };
  return { ...state, [type]: snapshot };
}

/**
 * Seeds the state from the Helix fetch. A type that an event already filled
 * keeps the event's value: it arrived after the page loaded, so it is newer
 * than, or as new as, the fetch.
 */
export function seedGoals(state: GoalWidgetState, goals: readonly FetchedGoal[]): GoalWidgetState {
  let next = state;
  for (const g of goals) {
    const type = toGoalType(g.type);
    if (!type || next[type]) continue;
    const current = num(g.current_amount);
    const target = num(g.target_amount);
    if (current === null || target === null) continue;
    if (next === state) next = { ...state };
    next[type] = {
      id: g.id,
      type,
      description: g.description ?? "",
      current,
      target,
      ended: null,
    };
  }
  return next;
}

/** The goal to draw: the first of `types` that has one. */
export function pickGoal(state: GoalWidgetState, types: readonly TwitchGoalType[]): GoalSnapshot | null {
  for (const type of types) {
    const goal = state[type];
    if (goal) return goal;
  }
  return null;
}

/** 0–1 fill. A zero or negative target reads as done once anything counts. */
export function goalProgress(goal: Pick<GoalSnapshot, "current" | "target">): number {
  if (goal.target <= 0) return goal.current > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, goal.current / goal.target));
}
