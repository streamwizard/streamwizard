/** One choice as the widget draws it. */
export interface PollChoiceSnapshot {
  id: string;
  title: string;
  votes: number;
}

export type PollStatus = "active" | "completed" | "terminated";

/** The poll as the widget draws it. Same fields for the Helix fetch and the events. */
export interface PollSnapshot {
  id: string;
  title: string;
  choices: PollChoiceSnapshot[];
  status: PollStatus;
  /** Epoch ms the poll closes, while it runs. */
  endsAt: number | null;
  /** Epoch ms it closed; set once it has. */
  endedAt: number | null;
}

/** Twitch runs one poll per channel at a time; null when there's none to show. */
export type PollWidgetState = PollSnapshot | null;

/**
 * Test polls use this id (the Test buttons) or start with it (the Poll
 * simulator, one id per poll); see demoPoll and stepPollCycle in
 * @repo/schemas. The widget keeps them apart from the real poll so a reset can
 * drop them.
 */
export const DEMO_POLL_ID = "demo-poll";

export function isDemoPollFrame(frame: PollWidgetFrame): boolean {
  const id = (frame?.payload as { id?: unknown } | null | undefined)?.id;
  return typeof id === "string" && id.startsWith(DEMO_POLL_ID);
}

/**
 * Browser event the poll settings fire to put the editor canvas back on the
 * real Twitch data: the test poll is dropped and the poll is fetched again.
 * detail: `{ sceneId }`.
 */
export const POLL_RESET_BROWSER_EVENT = "streamwizard:poll-reset";

export interface PollResetBrowserEventDetail {
  sceneId: string;
}

export const POLL_WIDGET_FRAME_TYPES = ["channel.poll.begin", "channel.poll.progress", "channel.poll.end"] as const;

export interface PollWidgetFrame {
  type: string;
  payload?: unknown;
}

/** The poll from GET /api/twitch/poll (see PublicPoll in @repo/twitch-assets). */
export interface FetchedPoll {
  id: string;
  title: string;
  choices: { id: string; title: string; votes: number }[];
  status: string;
  ends_at: string;
  ended_at: string | null;
}

function time(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

function choicesFrom(raw: unknown): PollChoiceSnapshot[] | null {
  if (!Array.isArray(raw)) return null;
  const choices: PollChoiceSnapshot[] = [];
  for (const c of raw) {
    if (!c || typeof c !== "object") continue;
    const { id, title, votes } = c as Record<string, unknown>;
    if (typeof id !== "string") continue;
    choices.push({
      id,
      title: typeof title === "string" ? title : "",
      votes: typeof votes === "number" && Number.isFinite(votes) ? Math.max(0, votes) : 0,
    });
  }
  return choices.length > 0 ? choices : null;
}

/**
 * Applies one socket frame. Returns the same state when the frame isn't a
 * poll event (or changes nothing), so the rest of the room's traffic costs no
 * re-render.
 *
 * - begin starts a poll at zero votes;
 * - progress updates the votes, unless that poll has already closed: Twitch
 *   can deliver a last progress after the end, and the end's count is final;
 * - end closes it. An archived poll was removed on Twitch, so it goes at once.
 */
export function applyPollFrame(state: PollWidgetState, frame: PollWidgetFrame, now: number): PollWidgetState {
  if (!(POLL_WIDGET_FRAME_TYPES as readonly string[]).includes(frame?.type)) return state;
  const p = frame.payload as Record<string, unknown> | null | undefined;
  if (!p || typeof p !== "object" || typeof p.id !== "string") return state;
  const choices = choicesFrom(p.choices);
  if (!choices) return state;
  const title = typeof p.title === "string" ? p.title : "";

  if (frame.type === "channel.poll.end") {
    if (p.status === "archived") return state?.id === p.id ? null : state;
    return {
      id: p.id,
      title,
      choices,
      status: p.status === "terminated" ? "terminated" : "completed",
      endsAt: null,
      endedAt: now,
    };
  }

  if (frame.type === "channel.poll.progress" && state?.id === p.id && state.endedAt !== null) return state;

  return {
    id: p.id,
    title,
    choices,
    status: "active",
    endsAt: time(p.ends_at),
    endedAt: null,
  };
}

/**
 * Seeds the state from the Helix fetch. An event that already arrived wins:
 * it came after the page loaded, so it is at least as new as the fetch.
 */
export function seedPoll(state: PollWidgetState, poll: FetchedPoll | null | undefined): PollWidgetState {
  if (state || !poll || typeof poll.id !== "string") return state;
  const choices = choicesFrom(poll.choices);
  if (!choices) return state;
  const active = poll.status === "active";
  if (!active && poll.status !== "completed" && poll.status !== "terminated") return state;
  return {
    id: poll.id,
    title: typeof poll.title === "string" ? poll.title : "",
    choices,
    status: active ? "active" : (poll.status as PollStatus),
    endsAt: active ? time(poll.ends_at) : null,
    // A poll that ended before the page loaded keeps its real end time, so
    // the reveal only runs for what's left of it.
    endedAt: active ? null : (time(poll.ended_at) ?? Date.now()),
  };
}
