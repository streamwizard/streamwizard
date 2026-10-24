import { defineShots, type Settle, type Shot } from "../manifest";

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
