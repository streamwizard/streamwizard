/**
 * Single registry object for every root widget (library, canvas, inspector, nested
 * `childFields`). Add new roots here; keep heavy logic in `widgets/<name>/`.
 *
 * To add a root widget:
 * 1. Extend `OverlayItemType` / config in `src/types/overlays.ts`
 * 2. Add Zod in `src/schemas/overlay.ts` (and DB enum if applicable)
 * 3. Add a key to `OVERLAY_WIDGET_REGISTRY` and any helpers under `widgets/<name>/`
 */

"use client";

import type { ChildOverlayItemType, OverlayItemType, RootOverlayItemType } from "@/types/overlays";
import {
  getClipDisplayChildren,
  isRootOverlayItemType,
} from "@/types/overlays";
import {
  CLIPS_WIDGET_DEFAULT_SIZE,
  createClipsWidgetRootItems,
} from "../widgets/clips/clips-widget-definition";
import { ClipDisplayFieldSettings } from "../widgets/clips/clip-display-field-settings";
import { ClipsWidgetCanvas } from "../widgets/clips/clips-widget-canvas";
import { ClipsWidgetSettings } from "../widgets/clips/clips-widget-settings";
import {
  createTextWidgetRootItems,
  TEXT_WIDGET_DEFAULT_SIZE,
} from "../widgets/text/text-widget-definition";
import { TextWidgetCanvas } from "../widgets/text/text-widget-canvas";
import { TextWidgetSettings } from "../widgets/text/text-widget-settings";
import {
  createTimerWidgetRootItems,
  TIMER_WIDGET_DEFAULT_SIZE,
} from "../widgets/timer/timer-widget-definition";
import { TimerWidgetCanvas } from "../widgets/timer/timer-widget-canvas";
import { TimerWidgetSettings } from "../widgets/timer/timer-widget-settings";
import {
  CLOCK_WIDGET_DEFAULT_SIZE,
  createClockWidgetRootItems,
} from "../widgets/clock/clock-widget-definition";
import { ClockWidgetCanvas } from "../widgets/clock/clock-widget-canvas";
import { ClockWidgetSettings } from "../widgets/clock/clock-widget-settings";
import type {
  OverlayChildResolvedDefinition,
  OverlayRootWidgetDefinition,
  ResolvedOverlayWidgetDefinition,
  WidgetCategory,
} from "./overlay-widget-registry.types";

export const OVERLAY_WIDGET_REGISTRY: Record<
  RootOverlayItemType,
  OverlayRootWidgetDefinition
> = {
  clips_widget: {
    type: "clips_widget",
    layerScope: "root",
    showInLibrary: true,
    category: "media",
    library: {
      title: "Clips widget",
      description: "Rotating Twitch clips with customizable display fields.",
    },
    defaultSize: { ...CLIPS_WIDGET_DEFAULT_SIZE },
    createRootItems: createClipsWidgetRootItems,
    getChildItems: getClipDisplayChildren,
    syncChildGeometryFromParent: true,
    CanvasContent: ClipsWidgetCanvas,
    SettingsPanel: ClipsWidgetSettings,
    childFields: [
      {
        type: "clip_display_field",
        defaultSize: { ...CLIPS_WIDGET_DEFAULT_SIZE },
        SettingsPanel: ClipDisplayFieldSettings,
      },
    ],
  },
  text_widget: {
    type: "text_widget",
    layerScope: "root",
    showInLibrary: true,
    category: "layout",
    library: {
      title: "Text",
      description: "Static text with font size, color, and alignment.",
    },
    defaultSize: { ...TEXT_WIDGET_DEFAULT_SIZE },
    createRootItems: createTextWidgetRootItems,
    CanvasContent: TextWidgetCanvas,
    SettingsPanel: TextWidgetSettings,
  },
  timer_widget: {
    type: "timer_widget",
    layerScope: "root",
    showInLibrary: true,
    category: "layout",
    library: {
      title: "Countdown",
      description:
        "Count down to a date and time—starting soon, breaks, or anything you schedule.",
    },
    defaultSize: { ...TIMER_WIDGET_DEFAULT_SIZE },
    createRootItems: createTimerWidgetRootItems,
    CanvasContent: TimerWidgetCanvas,
    SettingsPanel: TimerWidgetSettings,S
  },
  clock_widget: {
    type: "clock_widget",
    layerScope: "root",
    showInLibrary: true,
    category: "layout",
    library: {
      title: "Time",
      description:
        "Live date and time—local or a fixed time zone, with typography you control.",
    },
    defaultSize: { ...CLOCK_WIDGET_DEFAULT_SIZE },
    createRootItems: createClockWidgetRootItems,
    CanvasContent: ClockWidgetCanvas,
    SettingsPanel: ClockWidgetSettings,
  },
};

const childDefinitionByType: Map<
  ChildOverlayItemType,
  OverlayChildResolvedDefinition
> = new Map();

for (const root of Object.values(OVERLAY_WIDGET_REGISTRY)) {
  if (!root.childFields) continue;
  for (const field of root.childFields) {
    if (childDefinitionByType.has(field.type)) {
      throw new Error(
        `Duplicate child overlay definition for type: ${field.type}`
      );
    }
    childDefinitionByType.set(field.type, {
      type: field.type,
      layerScope: "child",
      showInLibrary: false,
      defaultSize: field.defaultSize,
      SettingsPanel: field.SettingsPanel,
      CanvasContent: field.CanvasContent,
    });
  }
}

export function getOverlayWidgetDefinition(
  type: OverlayItemType
): ResolvedOverlayWidgetDefinition {
  if (isRootOverlayItemType(type)) {
    return OVERLAY_WIDGET_REGISTRY[type];
  }
  const resolved = childDefinitionByType.get(type as ChildOverlayItemType);
  if (resolved) return resolved;
  throw new Error(`Unknown overlay item type: ${type}`);
}

export function getRootOverlayWidgetDefinition(
  type: RootOverlayItemType
): OverlayRootWidgetDefinition {
  return OVERLAY_WIDGET_REGISTRY[type];
}

export function isRootLayerType(type: OverlayItemType): boolean {
  return isRootOverlayItemType(type);
}

export function getLibraryWidgetDefinitions(): OverlayRootWidgetDefinition[] {
  return Object.values(OVERLAY_WIDGET_REGISTRY).filter((d) => d.showInLibrary);
}

export function groupLibraryWidgetsByCategory(): Record<
  WidgetCategory,
  OverlayRootWidgetDefinition[]
> {
  const grouped: Record<WidgetCategory, OverlayRootWidgetDefinition[]> = {
    media: [],
    alerts: [],
    layout: [],
    other: [],
  };
  for (const def of getLibraryWidgetDefinitions()) {
    const cat: WidgetCategory = def.category ?? "other";
    grouped[cat].push(def);
  }
  return grouped;
}

export type {
  OverlayCanvasProps,
  OverlayChildFieldDeclaration,
  OverlayChildResolvedDefinition,
  OverlayInspectorAppendProps,
  OverlayRootWidgetDefinition,
  ResolvedOverlayWidgetDefinition,
} from "./overlay-widget-registry.types";
export { isRootOverlayDefinition } from "./overlay-widget-registry.types";
