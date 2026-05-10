"use client";

import type { OverlayItemRow } from "@/app/actions/overlay";
import type { ComponentType } from "react";
import type { OverlayWidgetProps } from "@/components/widgets/types";
import { readGoogleFontFamilyFromConfig } from "@/components/widgets/font-from-config";
import { ClipsWidget } from "@/components/widgets/clips-widget/ClipsWidget";
import { TextWidget } from "@/components/widgets/text-widget/TextWidget";
import { TimerWidget } from "@/components/widgets/timer-widget/TimerWidget";

export type OverlayWidgetRegistration = {
  /** Must match `overlay_items.type` from Supabase. */
  id: string;
  Component: ComponentType<OverlayWidgetProps>;
  /** Fonts to load via Google Fonts CSS (optional). */
  collectFontFamilies?: (item: OverlayItemRow) => string[];
};

function fontsFromTextConfig(item: OverlayItemRow): string[] {
  const ff = readGoogleFontFamilyFromConfig(item.config);
  return ff ? [ff] : [];
}

/**
 * Single registry for overlay widgets. To add a widget:
 * 1. Create `src/components/widgets/<your-widget>/YourWidget.tsx`
 * 2. Export a component with props `OverlayWidgetProps`
 * 3. Append an entry here with matching `id` (DB `type` string)
 */
export const overlayWidgetRegistry: OverlayWidgetRegistration[] = [
  {
    id: "text_widget",
    Component: TextWidget,
    collectFontFamilies: fontsFromTextConfig,
  },
  {
    id: "timer_widget",
    Component: TimerWidget,
    collectFontFamilies: fontsFromTextConfig,
  },
  {
    id: "clips_widget",
    Component: ClipsWidget,
  },
];

const byType = new Map<string, OverlayWidgetRegistration>(
  overlayWidgetRegistry.map((w) => [w.id, w])
);

export function getOverlayWidgetRegistration(
  type: string
): OverlayWidgetRegistration | undefined {
  return byType.get(type);
}

export function collectOverlayGoogleFontFamilies(
  items: OverlayItemRow[]
): string[] {
  const set = new Set<string>();
  for (const item of items) {
    const reg = getOverlayWidgetRegistration(item.type);
    const fonts = reg?.collectFontFamilies?.(item) ?? [];
    for (const f of fonts) {
      if (f.trim()) set.add(f.trim());
    }
  }
  return [...set];
}

/** Known widget type ids (for dashboards / validation tooling). */
export const OVERLAY_WIDGET_TYPE_IDS = overlayWidgetRegistry.map((w) => w.id);
