import type { ComponentType } from "react";
import type { OverlayItem, OverlayItemConfig, RootOverlayItemType } from "./types";

export interface WidgetRendererProps {
  item: OverlayItem;
  /**
   * Canvas zoom level from the editor (0.1–2). Renderers receive this so internal
   * pixel calculations (drag handle offsets, hit-test areas) remain correct at any
   * zoom level. The canvas wrapper applies `transform: scale(zoom)` on the scene
   * container — the renderer's root element must NOT apply its own scale transform.
   * Live overlay always omits this (effectively zoom=1).
   */
  zoom?: number;
}

export interface WidgetBaseDefinition<T extends RootOverlayItemType = RootOverlayItemType> {
  type: T;
  /** Default pixel size when placed on the canvas. */
  defaultSize: { w: number; h: number };
  /**
   * Factory for default config values when a widget is created.
   * Populated by per-widget base definition objects in packages/ui.
   */
  createDefaultConfig?: () => OverlayItemConfig;
  /**
   * Pure renderer — receives the item with its config and emits visual output.
   * This same component is used in both the editor preview and the live overlay,
   * guaranteeing identical visual output in both contexts.
   * Populated by per-widget base definition objects in packages/ui.
   */
  Renderer?: ComponentType<WidgetRendererProps>;
  /** Returns Google Font family names to preload for this item, if any. */
  collectFontFamilies?: (item: OverlayItem) => string[];
}
