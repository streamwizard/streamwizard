import type { Page } from "playwright";
import { defineShots, type Settle, type Shot } from "../manifest";

/** Fire one of the app's own demo events at the widget on the canvas. */
function fire(type: string, opts: { variant?: string; nth?: number } = {}) {
  return async (page: Page) => {
    await page.evaluate(
      (args) => {
        const w = window as unknown as {
          __shots?: { fire: (t: string, o?: unknown) => void };
        };
        w.__shots?.fire(args.type, args.opts);
      },
      { type, opts },
    );
  };
}

/** Push a frame down the faked overlay socket, for widgets with no event path. */
function emit(frame: { type: string; payload: unknown }) {
  return async (page: Page) => {
    await page.evaluate((f) => {
      (window as unknown as { __shotWsEmit?: (x: unknown) => void }).__shotWsEmit?.(f);
    }, frame);
  };
}

const READY: Settle[] = [
  { kind: "fonts" },
  { kind: "selector", selector: "[data-shot-ready]", state: "attached" },
];

/** Every widget shot frames the stage and nothing else. */
function widgetShot(opts: {
  id: string;
  description: string;
  type: string;
  preset?: string;
  /** Overrides the widget's default box. Needed for full-scene widgets. */
  box?: { w: number; h: number };
  viewport?: { width: number; height: number };
  actions?: Array<(page: Page) => Promise<void>>;
  /** How long to let the widget settle once its events have landed. */
  waitMs?: number;
  unstable?: boolean;
}): Shot {
  const params = new URLSearchParams();
  if (opts.preset) params.set("preset", opts.preset);
  if (opts.box) {
    params.set("w", String(opts.box.w));
    params.set("h", String(opts.box.h));
  }
  const query = params.toString();

  return {
    id: opts.id,
    description: opts.description,
    route: `/shots/widget/${opts.type}${query ? `?${query}` : ""}`,
    viewport: { ...(opts.viewport ?? { width: 900, height: 420 }), dsf: 2 },
    theme: "dark",
    settle: READY,
    actions: opts.actions,
    settleAfter: [{ kind: "wait", ms: opts.waitMs ?? 1_500 }],
    crop: { kind: "element", selector: "[data-shot-stage]" },
    unstable: opts.unstable,
  };
}

export const overlayWidgetShots: Shot[] = defineShots([
  // Static widgets: nothing to drive, they draw themselves.
  widgetShot({
    id: "overlays/clock-widget",
    description: "The Time widget showing the date and the time.",
    type: "clock_widget",
  }),
  widgetShot({
    id: "overlays/countdown-widget",
    description: "The Countdown widget partway through a five minute countdown.",
    type: "timer_widget",
  }),
  widgetShot({
    id: "overlays/text-widget",
    description: "The Text widget with an outline, readable over any footage.",
    type: "text_widget",
  }),
  widgetShot({
    id: "overlays/shape-widget",
    description: "The Shape widget drawing a rounded rectangle in Wizard purple.",
    type: "shape_widget",
  }),

  // Driven by the same demo events the editor's Demo bar fires.
  widgetShot({
    id: "overlays/goal-widget",
    description: "A follower goal partway to its target.",
    type: "follower_goal_widget",
    box: { w: 900, h: 280 },
    viewport: { width: 1100, height: 420 },
    actions: [fire("channel.goal.begin"), fire("channel.goal.progress")],
    waitMs: 2_000,
  }),
  widgetShot({
    id: "overlays/poll-widget",
    description: "A Twitch poll on screen with votes coming in and a countdown.",
    type: "poll_widget",
    viewport: { width: 900, height: 480 },
    actions: [fire("channel.poll.begin"), fire("channel.poll.progress")],
    waitMs: 2_000,
  }),
  widgetShot({
    id: "overlays/prediction-widget",
    description: "A prediction with channel points stacking up on both outcomes.",
    type: "prediction_widget",
    viewport: { width: 900, height: 480 },
    actions: [fire("channel.prediction.begin"), fire("channel.prediction.progress")],
    waitMs: 2_000,
  }),
  widgetShot({
    id: "overlays/ad-widget",
    description: "The ad widget counting down to a break.",
    type: "ad_widget",
    viewport: { width: 760, height: 320 },
    actions: [fire("channel.ad_break.begin")],
    waitMs: 2_000,
  }),
  widgetShot({
    id: "overlays/hype-train-widget",
    description: "A hype train mid-run, with a wagon for each supporter.",
    type: "hype_train_widget",
    // Defaults to the whole scene; a train bouncing round 1920x1080 is mostly
    // empty backdrop. The ride is also randomly placed, hence unstable.
    box: { w: 1100, h: 260 },
    viewport: { width: 1280, height: 420 },
    unstable: true,
    actions: [fire("channel.hype_train.begin"), fire("channel.hype_train.progress")],
    waitMs: 2_500,
  }),
  widgetShot({
    id: "overlays/chat-widget",
    description: "The chat box with a few messages on screen.",
    type: "chat_widget",
    viewport: { width: 760, height: 520 },
    actions: [
      fire("channel.chat.message", { nth: 0 }),
      fire("channel.chat.message", { nth: 1 }),
      fire("channel.chat.message", { nth: 2 }),
    ],
    waitMs: 2_000,
  }),
  widgetShot({
    id: "overlays/alert-widget",
    description: "A follow alert playing on screen.",
    type: "alert_widget",
    viewport: { width: 900, height: 480 },
    actions: [fire("channel.follow")],
    // An alert is a transient animation, so this frames the middle of one
    // rather than a resting state. Excluded from drift for that reason.
    waitMs: 1_200,
    unstable: true,
  }),
  widgetShot({
    id: "overlays/stream-label-widget",
    description: "A stream label showing the most recent follower.",
    type: "label_widget",
    viewport: { width: 760, height: 200 },
    actions: [fire("channel.follow")],
    waitMs: 1_500,
  }),

  // Driven over the faked overlay socket: the IRL widgets have no browser
  // event path at all, they only read the room.
  widgetShot({
    id: "overlays/irl-speed-widget",
    description: "The IRL speed widget reading a live GPS fix in km/h.",
    type: "irl_speed_widget",
    viewport: { width: 520, height: 200 },
    actions: [
      emit({
        type: "streamwizard.geo",
        payload: {
          status: "connected",
          payload: {
            latitude: 52.37403,
            longitude: 4.88969,
            altitude: 14,
            speed: 11.2,
            heading: 247,
            accuracy: 5,
            timestamp: 1786608000000,
          },
        },
      }),
    ],
  }),
]);
