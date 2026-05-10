"use client";

import { TimerWidgetRenderer } from "@repo/ui";
import type { OverlayCanvasProps } from "../../registry/overlay-widget-registry.types";

export function TimerWidgetCanvas({ item, zoom }: OverlayCanvasProps) {
  return <TimerWidgetRenderer item={item} zoom={zoom} />;
}
