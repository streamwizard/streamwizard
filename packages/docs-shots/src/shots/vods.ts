import { defineShots, type Settle, type Shot } from "../manifest";

/**
 * The VODs area reads Twitch Helix on every request rather than the database,
 * so seeding cannot reach it. These shoot the real components on a harness
 * route with fixture props instead.
 *
 * They still sign in: the page renders from fixture props, but the events on
 * the timeline come from StreamWizard's own tables through a server action,
 * and RLS filters those to nothing without a session.
 *
 * The Twitch player is deliberately out of frame on the detail shots: it loads
 * player.twitch.tv in an iframe, needs network and a VOD that has not expired,
 * and would rot the screenshot the moment Twitch deletes the recording.
 */
const READY: Settle[] = [
  { kind: "fonts" },
  { kind: "selector", selector: "[data-shot-stage]" },
];

export const vodShots: Shot[] = defineShots([
  {
    id: "vods/vod-list",
    description: "The VODs page listing archived broadcasts with duration and views.",
    route: "/shots/vods/list",
    auth: "smoke-user",
    viewport: { width: 1400, height: 820, dsf: 1 },
    theme: "dark",
    settle: READY,
    settleAfter: [{ kind: "wait", ms: 1_500 }],
    crop: { kind: "viewport" },
  },
  {
    id: "vods/vod-timeline",
    description:
      "The VOD timeline with event markers, muted segments and the stream events panel.",
    route: "/shots/vods/detail",
    auth: "smoke-user",
    viewport: { width: 1500, height: 900, dsf: 1 },
    theme: "dark",
    settle: READY,
    settleAfter: [{ kind: "wait", ms: 2_500 }],
    crop: { kind: "viewport" },
  },
]);
