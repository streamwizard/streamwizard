import { defineShots, type Settle, type Shot } from "../manifest";
import { SHOT_SCENE_ID } from "../seed";

/**
 * The dashboard pages all share the same chrome, and that chrome is part of
 * what the docs are describing, so these shoot the real routes with seeded
 * rows rather than mounting components on a harness page.
 */
const SIDEBAR_READY: Settle[] = [
  { kind: "fonts" },
  { kind: "selector", selector: "[data-slot='sidebar-inner']" },
  { kind: "networkIdle" },
];

/** The signed-in account's email sits in the sidebar footer on every page. */
const HIDE_ACCOUNT_EMAIL = [
  { selector: "[data-slot='sidebar-footer'] .truncate", text: "novaplays" },
];

export const dashboardShots: Shot[] = defineShots([
  {
    id: "dashboard/overview",
    description: "The dashboard after a stream: stat cards, viewer chart and activity feed.",
    route: "/dashboard",
    auth: "smoke-user",
    viewport: { width: 1600, height: 1000, dsf: 1 },
    theme: "dark",
    settle: SIDEBAR_READY,
    settleAfter: [{ kind: "wait", ms: 2_500 }],
    redact: HIDE_ACCOUNT_EMAIL,
    crop: { kind: "viewport" },
  },
  {
    id: "clips/clips-grid",
    description: "The clips page: filter bar, folder tree in the sidebar, clips in a grid.",
    route: "/dashboard/clips",
    auth: "smoke-user",
    viewport: { width: 1600, height: 1000, dsf: 1 },
    theme: "dark",
    settle: SIDEBAR_READY,
    settleAfter: [{ kind: "wait", ms: 2_000 }],
    redact: HIDE_ACCOUNT_EMAIL,
    crop: { kind: "viewport" },
  },
  {
    id: "clips/folders-overview",
    description: "The folders page, with each folder's clip count and rolled-up total.",
    route: "/dashboard/folders",
    auth: "smoke-user",
    viewport: { width: 1400, height: 900, dsf: 1 },
    theme: "dark",
    settle: SIDEBAR_READY,
    settleAfter: [{ kind: "wait", ms: 1_500 }],
    redact: HIDE_ACCOUNT_EMAIL,
    crop: { kind: "viewport" },
  },
  {
    id: "account/preferences",
    description: "The preferences page and its five switches.",
    route: "/dashboard/settings/preferences",
    auth: "smoke-user",
    viewport: { width: 1400, height: 900, dsf: 1 },
    theme: "dark",
    settle: SIDEBAR_READY,
    settleAfter: [{ kind: "wait", ms: 1_200 }],
    redact: HIDE_ACCOUNT_EMAIL,
    crop: { kind: "viewport" },
  },
  {
    id: "account/integrations",
    description: "The integrations page showing the Twitch and Discord connections.",
    route: "/dashboard/settings/integrations",
    auth: "smoke-user",
    viewport: { width: 1400, height: 900, dsf: 1 },
    theme: "dark",
    settle: SIDEBAR_READY,
    settleAfter: [{ kind: "wait", ms: 1_200 }],
    redact: HIDE_ACCOUNT_EMAIL,
    crop: { kind: "viewport" },
  },
  {
    id: "overlays/overlay-list",
    description: "The overlays page, with each overlay's card and its on/off switch.",
    route: "/dashboard/overlays",
    auth: "smoke-user",
    viewport: { width: 1500, height: 950, dsf: 1 },
    theme: "dark",
    settle: SIDEBAR_READY,
    settleAfter: [{ kind: "wait", ms: 1_500 }],
    redact: HIDE_ACCOUNT_EMAIL,
    crop: { kind: "viewport" },
  },
  {
    id: "overlays/overlay-editor",
    description: "The overlay editor: canvas, layers panel and the inspector.",
    route: `/dashboard/overlays/${SHOT_SCENE_ID}/edit`,
    auth: "smoke-user",
    viewport: { width: 1600, height: 950, dsf: 1 },
    theme: "dark",
    settle: [
      { kind: "fonts" },
      // The editor collapses the app sidebar on mount, so wait for its own
      // chrome rather than the dashboard's.
      { kind: "selector", selector: "[data-shot-stage], main" },
      { kind: "networkIdle" },
    ],
    settleAfter: [{ kind: "wait", ms: 2_500 }],
    crop: { kind: "viewport" },
  },
  {
    id: "overlays/widget-library",
    description: "The widget library sheet, listing everything you can add to an overlay.",
    route: `/dashboard/overlays/${SHOT_SCENE_ID}/edit`,
    auth: "smoke-user",
    viewport: { width: 1600, height: 950, dsf: 1 },
    theme: "dark",
    settle: [
      { kind: "fonts" },
      { kind: "selector", selector: "main" },
      { kind: "networkIdle" },
    ],
    actions: [
      async (page) => {
        await page.getByRole("button", { name: "Widgets" }).first().click();
      },
    ],
    settleAfter: [{ kind: "wait", ms: 1_500 }],
    crop: { kind: "viewport" },
  },
  {
    id: "overlays/media-library",
    description: "The media library, where alert images and sounds live.",
    route: "/dashboard/media",
    auth: "smoke-user",
    viewport: { width: 1400, height: 880, dsf: 1 },
    theme: "dark",
    settle: SIDEBAR_READY,
    settleAfter: [{ kind: "wait", ms: 1_500 }],
    redact: HIDE_ACCOUNT_EMAIL,
    crop: { kind: "viewport" },
  },
  {
    id: "onboarding/wizard",
    description: "The onboarding wizard, with all three first-run steps.",
    route: "/dashboard",
    auth: "smoke-user",
    seed: "onboarding",
    viewport: { width: 1400, height: 950, dsf: 1 },
    theme: "dark",
    settle: SIDEBAR_READY,
    settleAfter: [{ kind: "wait", ms: 2_000 }],
    redact: HIDE_ACCOUNT_EMAIL,
    crop: { kind: "viewport" },
  },
]);
