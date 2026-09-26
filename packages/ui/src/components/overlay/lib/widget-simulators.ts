import {
  initChatStream,
  initGeoWalk,
  initPollCycle,
  initSwitcherDegrade,
  stepChatStream,
  stepGeoWalk,
  stepPollCycle,
  stepSwitcherDegrade,
  type ChatStreamState,
  type GeoWalkState,
  type PollCycleState,
  type SwitcherDegradeState,
} from "@repo/schemas";

/**
 * Looping demo sources. A one-shot fixture answers "what does this event look
 * like"; a simulator answers "what does this widget look like while data keeps
 * arriving" -- a speed readout, a distance counter, a chat feed. That second
 * question is the one widget authors used to answer by writing a demo mode
 * into their own script.
 *
 * The step maths lives in @repo/schemas so it can be unit tested against the
 * event schemas; only the timers are here.
 */

export type SimulatorEmit = (listener: string, event: Record<string, unknown>) => void;

export interface SimulatorDef {
  id: string;
  label: string;
  description: string;
  /** Listener strings this simulator emits; feeds the picker's relevance sort. */
  listeners: readonly string[];
  defaultIntervalMs: number;
  /**
   * Starts emitting. Fires once immediately so the widget has data before the
   * first tick elapses, then on every interval.
   *
   * The returned stop function is idempotent -- an explicit Stop click and the
   * host's unmount cleanup both call it.
   */
  start(emit: SimulatorEmit, opts?: { intervalMs?: number }): () => void;
}

/**
 * Wraps the tick bookkeeping every simulator shares: fire immediately, then on
 * an interval, and never leave a timer behind. A tick that returns null is a
 * quiet one: nothing is sent.
 */
function loop(
  emit: SimulatorEmit,
  intervalMs: number,
  tick: () => { listener: string; event: Record<string, unknown> } | null
): () => void {
  const fire = () => {
    const next = tick();
    if (next) emit(next.listener, next.event);
  };

  fire();
  let timer: ReturnType<typeof setInterval> | null = setInterval(fire, intervalMs);

  return () => {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
  };
}

export const WIDGET_SIMULATORS: Record<string, SimulatorDef> = {
  "geo.walk": {
    id: "geo.walk",
    label: "Moving GPS track",
    description:
      "Walks a GPS fix through Amsterdam at a varying speed, so speed, distance and location readouts all move.",
    listeners: ["streamwizard.geo"],
    defaultIntervalMs: 1000,
    start(emit, opts) {
      let state: GeoWalkState = initGeoWalk();
      return loop(emit, opts?.intervalMs ?? this.defaultIntervalMs, () => {
        const stepped = stepGeoWalk(state);
        state = stepped.state;
        return {
          listener: "streamwizard.geo",
          event: stepped.event as unknown as Record<string, unknown>,
        };
      });
    },
  },
  "chat.stream": {
    id: "chat.stream",
    label: "Chat messages",
    description: "Sends a canned chat message on a loop, cycling through a handful of chatters.",
    listeners: ["channel.chat.message"],
    defaultIntervalMs: 2500,
    start(emit, opts) {
      let state: ChatStreamState = initChatStream();
      return loop(emit, opts?.intervalMs ?? this.defaultIntervalMs, () => {
        const stepped = stepChatStream(state);
        state = stepped.state;
        return { listener: "channel.chat.message", event: stepped.event };
      });
    },
  },
  "poll.cycle": {
    id: "poll.cycle",
    label: "Poll",
    description:
      "Runs a 20-second poll on a loop: it begins, votes trickle in, it closes with a winner, and after a pause the next poll starts with a new question.",
    listeners: ["channel.poll.begin", "channel.poll.progress", "channel.poll.end"],
    // One tick is one second of the poll; its countdown runs on real time.
    defaultIntervalMs: 1000,
    start(emit, opts) {
      let state: PollCycleState = initPollCycle(Date.now(), Math.floor(Math.random() * 2147483646) + 1);
      return loop(emit, opts?.intervalMs ?? this.defaultIntervalMs, () => {
        const stepped = stepPollCycle(state);
        state = stepped.state;
        return stepped.listener && stepped.event ? { listener: stepped.listener, event: stepped.event } : null;
      });
    },
  },
  "switcher.degrade": {
    id: "switcher.degrade",
    label: "Auto switcher degrade + recover",
    description:
      "Loops the full auto switcher arc: a healthy link, bitrate failing one poll at a time until the switch fires, then good polls climbing back to the recover threshold. The only way to watch the poll bars actually fill without throttling a real uplink.",
    listeners: ["streamwizard.auto_switcher_status"],
    // 1 Hz because that is the real ingest sample rate, and the engine now
    // publishes on every sample while a streak is moving -- one tick here is
    // one status frame there. Slow it down in the panel if you prefer.
    defaultIntervalMs: 1000,
    start(emit, opts) {
      let state: SwitcherDegradeState = initSwitcherDegrade();
      return loop(emit, opts?.intervalMs ?? this.defaultIntervalMs, () => {
        const stepped = stepSwitcherDegrade(state);
        state = stepped.state;
        return { listener: "streamwizard.auto_switcher_status", event: stepped.event };
      });
    },
  },
};

export const WIDGET_SIMULATOR_IDS = Object.keys(WIDGET_SIMULATORS);
