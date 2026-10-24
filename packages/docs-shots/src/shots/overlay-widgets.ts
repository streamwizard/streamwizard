import { defineShots, type Shot } from "../manifest";

/**
 * Widgets whose default state already shows something worth photographing,
 * so they need no event fired at them first.
 */
const STATIC_WIDGETS: Array<{ type: string; id: string; description: string }> = [
  {
    type: "clock_widget",
    id: "overlays/clock-widget",
    description: "The Time widget showing the date above the time.",
  },
  {
    type: "timer_widget",
    id: "overlays/countdown-widget",
    description: "The Countdown widget partway through a five minute countdown.",
  },
  {
    type: "text_widget",
    id: "overlays/text-widget",
    description: "The Text widget with an outline, over a dark backdrop.",
  },
  {
    type: "shape_widget",
    id: "overlays/shape-widget",
    description: "The Shape widget drawing a rounded rectangle in Wizard purple.",
  },
];

export const overlayWidgetShots: Shot[] = defineShots(
  STATIC_WIDGETS.map(({ type, id, description }) => ({
    id,
    description,
    route: `/shots/widget/${type}`,
    viewport: { width: 900, height: 420, dsf: 2 },
    theme: "dark" as const,
    settle: [
      { kind: "fonts" as const },
      { kind: "selector" as const, selector: "[data-shot-ready]", state: "attached" as const },
      // Let any entry animation reach its resting frame.
      { kind: "wait" as const, ms: 1_500 },
    ],
    crop: { kind: "element" as const, selector: "[data-shot-stage]" },
  })),
);
