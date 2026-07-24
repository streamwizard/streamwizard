import type { OverlayItemConfig } from "@/types/overlays";
import {
  DEFAULT_CLIPS_WIDGET_ITEM_CONFIG,
  DEFAULT_CLOCK_WIDGET_ITEM_CONFIG,
  DEFAULT_TEXT_WIDGET_ITEM_CONFIG,
  TIMER_WIDGET_CONFIG_DEFAULTS,
  CLIPS_WIDGET_DEFAULT_SIZE,
} from "@repo/ui/overlay";

// Developer-authored overlay starter templates, versioned with the code and
// instantiated by createOverlayFromTemplate. Coordinates assume the template's
// width x height canvas (1920x1080 unless stated otherwise).

export interface OverlayTemplateItem {
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z_index: number;
  label: string;
  config: OverlayItemConfig;
}

export interface OverlayTemplate {
  id: string;
  name: string;
  description: string;
  render_mode: "obs" | "phone";
  width: number;
  height: number;
  items: OverlayTemplateItem[];
}

const CANVAS = { width: 1920, height: 1080 };

export const OVERLAY_TEMPLATES: OverlayTemplate[] = [
  {
    id: "blank",
    name: "Blank",
    description: "Empty canvas. Build it your way.",
    render_mode: "obs",
    ...CANVAS,
    items: [],
  },
  {
    id: "starting-soon",
    name: "Starting soon",
    description: "Big title, countdown, and a clock. Point OBS at it and go get your coffee.",
    render_mode: "obs",
    ...CANVAS,
    items: [
      {
        type: "text_widget",
        x: 460,
        y: 330,
        w: 1000,
        h: 140,
        z_index: 1,
        label: "Title",
        config: {
          ...DEFAULT_TEXT_WIDGET_ITEM_CONFIG,
          text: "Starting soon",
          fontSize: 96,
          fontWeight: 700,
          align: "center",
        },
      },
      {
        type: "timer_widget",
        x: 710,
        y: 500,
        w: 500,
        h: 90,
        z_index: 2,
        label: "Countdown",
        config: {
          ...TIMER_WIDGET_CONFIG_DEFAULTS,
          countdownMode: "duration",
          durationSeconds: 300,
          finishedText: "We're live!",
          fontSize: 64,
        },
      },
      {
        type: "clock_widget",
        x: 810,
        y: 950,
        w: 300,
        h: 60,
        z_index: 3,
        label: "Clock",
        config: {
          ...DEFAULT_CLOCK_WIDGET_ITEM_CONFIG,
          showDate: false,
          showSeconds: false,
          fontSize: 28,
        },
      },
    ],
  },
  {
    id: "just-chatting",
    name: "Just chatting",
    description: "A clean label and clock. Room for your camera and chat.",
    render_mode: "obs",
    ...CANVAS,
    items: [
      {
        type: "text_widget",
        x: 60,
        y: 960,
        w: 600,
        h: 70,
        z_index: 1,
        label: "Stream label",
        config: {
          ...DEFAULT_TEXT_WIDGET_ITEM_CONFIG,
          text: "Just chatting",
          fontSize: 40,
          fontWeight: 600,
        },
      },
      {
        type: "clock_widget",
        x: 1560,
        y: 40,
        w: 300,
        h: 50,
        z_index: 2,
        label: "Clock",
        config: {
          ...DEFAULT_CLOCK_WIDGET_ITEM_CONFIG,
          showDate: false,
          showSeconds: false,
          align: "right",
          fontSize: 26,
        },
      },
    ],
  },
  {
    id: "clips-showcase",
    name: "Clips showcase",
    description: "Plays your recent clips on a loop. Great for BRB screens and stream intros.",
    render_mode: "obs",
    ...CANVAS,
    items: [
      {
        type: "clips_widget",
        x: Math.round((1920 - CLIPS_WIDGET_DEFAULT_SIZE.w) / 2),
        y: Math.round((1080 - CLIPS_WIDGET_DEFAULT_SIZE.h) / 2),
        w: CLIPS_WIDGET_DEFAULT_SIZE.w,
        h: CLIPS_WIDGET_DEFAULT_SIZE.h,
        z_index: 1,
        label: "Clips",
        config: {
          ...DEFAULT_CLIPS_WIDGET_ITEM_CONFIG,
          timeWindow: "last30d",
          sort: "most_viewed",
          maxClips: 10,
        },
      },
      {
        type: "text_widget",
        x: 60,
        y: 60,
        w: 500,
        h: 70,
        z_index: 2,
        label: "BRB label",
        config: {
          ...DEFAULT_TEXT_WIDGET_ITEM_CONFIG,
          text: "Be right back",
          fontSize: 44,
          fontWeight: 700,
        },
      },
    ],
  },
];

export function getOverlayTemplate(id: string): OverlayTemplate | undefined {
  return OVERLAY_TEMPLATES.find((t) => t.id === id);
}
