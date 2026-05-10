"use client";

import {
  DEFAULT_CLIPS_WIDGET_ITEM_CONFIG,
  type ClipsWidgetItemConfig,
  type OverlayItem,
} from "@/types/overlays";
import type { OverlayInspectorAppendProps } from "../../registry/overlay-widget-registry.types";
import { ClipsWidgetConfigPanel } from "./clips-widget-config";

export function ClipsWidgetSettings({
  item,
  updateItem,
  clipFolders,
}: OverlayInspectorAppendProps) {
  function handleConfigUpdate(updates: Partial<ClipsWidgetItemConfig>) {
    updateItem(item.id, {
      config: {
        ...(item.config as ClipsWidgetItemConfig),
        ...updates,
      },
    });
  }

  return (
    <ClipsWidgetConfigPanel
      config={{
        ...DEFAULT_CLIPS_WIDGET_ITEM_CONFIG,
        ...(item.config as ClipsWidgetItemConfig),
      }}
      onUpdate={handleConfigUpdate}
      clipFolders={clipFolders}
    />
  );
}
