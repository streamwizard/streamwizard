"use client";

import { TextWidgetRenderer } from "@repo/ui";
import type { OverlayCanvasProps } from "../../registry/overlay-widget-registry.types";

export function TextWidgetCanvas({ item, zoom }: OverlayCanvasProps) {
  return <TextWidgetRenderer item={item} zoom={zoom} />;
}
