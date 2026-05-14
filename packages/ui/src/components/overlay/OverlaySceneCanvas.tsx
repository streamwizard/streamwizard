"use client";

import type { ComponentType } from "react";
import { useMemo, type ReactNode } from "react";
import type { OverlayItem, OverlayScene } from "./types";
import { useGoogleFonts } from "./hooks/use-google-font";
import { textWidgetBaseDefinition } from "./widgets/text/text-widget-definition";
import { timerWidgetBaseDefinition } from "./widgets/timer/timer-widget-definition";
import { clockWidgetBaseDefinition } from "./widgets/clock/clock-widget-definition";
import { TextWidgetRenderer } from "./widgets/text/TextWidgetRenderer";
import { TimerWidgetRenderer } from "./widgets/timer/TimerWidgetRenderer";
import { ClockWidgetRenderer } from "./widgets/clock/ClockWidgetRenderer";
import {
  IrlFieldWidgetRenderer,
  collectIrlFieldFontFamilies,
} from "./widgets/irl/irl-field-widget-definition";
import { IRL_FIELD_WIDGET_TYPES } from "./types";

export type OverlayWidgetProps = {
  item: OverlayItem;
  scene: OverlayScene;
};

export type OverlayWidgetRegistration = {
  id: string;
  Component: ComponentType<OverlayWidgetProps>;
  collectFontFamilies?: (item: OverlayItem) => string[];
};

type W = ComponentType<OverlayWidgetProps>;

const CORE_WIDGETS: OverlayWidgetRegistration[] = [
  {
    id: "text_widget",
    Component: TextWidgetRenderer as W,
    collectFontFamilies: textWidgetBaseDefinition.collectFontFamilies,
  },
  {
    id: "timer_widget",
    Component: TimerWidgetRenderer as W,
    collectFontFamilies: timerWidgetBaseDefinition.collectFontFamilies,
  },
  {
    id: "clock_widget",
    Component: ClockWidgetRenderer as W,
    collectFontFamilies: clockWidgetBaseDefinition.collectFontFamilies,
  },
  ...IRL_FIELD_WIDGET_TYPES.map((type) => ({
    id: type,
    Component: IrlFieldWidgetRenderer as W,
    collectFontFamilies: collectIrlFieldFontFamilies,
  })),
];

function collectFonts(
  items: OverlayItem[],
  registry: Map<string, OverlayWidgetRegistration>
): string[] {
  const set = new Set<string>();
  for (const item of items) {
    const reg = registry.get(item.type);
    for (const f of reg?.collectFontFamilies?.(item) ?? []) {
      if (f.trim()) set.add(f.trim());
    }
  }
  return [...set];
}

function OverlayLayerWrapper({
  item,
  children,
}: {
  item: OverlayItem;
  children: ReactNode;
}) {
  const opacity =
    typeof item.opacity === "number" && Number.isFinite(item.opacity)
      ? Math.min(1, Math.max(0, item.opacity))
      : 1;

  return (
    <div
      style={{
        position: "absolute",
        left: item.x,
        top: item.y,
        width: item.w,
        height: item.h,
        zIndex: item.z_index,
        opacity,
        transform: `rotate(${item.rotation}deg)`,
        transformOrigin: "center center",
        pointerEvents: "none",
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}

/**
 * Renders an overlay scene. Core widgets (text, timer, clock) are built-in.
 * Pass additional widget registrations via `widgets` for app-specific types
 * (e.g. clips widget with its data-fetching container).
 */
export function OverlaySceneCanvas({
  scene,
  items,
  widgets = [],
}: {
  scene: OverlayScene;
  items: OverlayItem[];
  /** App-specific widget registrations appended on top of the core registry. */
  widgets?: OverlayWidgetRegistration[];
}) {
  const registry = useMemo(() => {
    const map = new Map(CORE_WIDGETS.map((w) => [w.id, w]));
    for (const w of widgets) map.set(w.id, w);
    return map;
  }, [widgets]);

  const fonts = useMemo(() => collectFonts(items, registry), [items, registry]);
  useGoogleFonts(fonts);

  return (
    <div
      style={{
        position: "relative",
        width: scene.width,
        height: scene.height,
        overflow: "hidden",
        background: "transparent",
      }}
    >
      {items.map((item) => {
        const reg = registry.get(item.type);
        if (!reg) return null;
        const Widget = reg.Component;
        return (
          <OverlayLayerWrapper key={item.id} item={item}>
            <Widget item={item} scene={scene} />
          </OverlayLayerWrapper>
        );
      })}
    </div>
  );
}
