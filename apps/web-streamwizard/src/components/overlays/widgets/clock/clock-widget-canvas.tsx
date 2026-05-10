"use client";

import { ClockWidgetRenderer } from "@repo/ui";
import type { OverlayCanvasProps } from "../../registry/overlay-widget-registry.types";

export function ClockWidgetCanvas({ item, zoom }: OverlayCanvasProps) {
  return <ClockWidgetRenderer item={item} zoom={zoom} />;
}
