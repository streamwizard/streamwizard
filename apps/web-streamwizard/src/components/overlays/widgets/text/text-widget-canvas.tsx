"use client";

import { useGoogleFont } from "@/hooks/use-google-font";
import { asTextWidgetConfig, resolvedTextWidgetFontFamily } from "@/types/overlays";
import type { OverlayCanvasProps } from "../../registry/overlay-widget-registry.types";

function justifyForAlign(align: "left" | "center" | "right") {
  if (align === "left") return "flex-start";
  if (align === "right") return "flex-end";
  return "center";
}

export function TextWidgetCanvas({ item, zoom }: OverlayCanvasProps) {
  const cfg = asTextWidgetConfig(item.config);
  const fontFamily = resolvedTextWidgetFontFamily(cfg);
  useGoogleFont(fontFamily);

  return (
    <div
      className="w-full h-full overflow-hidden px-2 py-1"
      style={{
        color: cfg.color,
        fontSize: cfg.fontSize * zoom,
        fontWeight: cfg.fontWeight,
        fontFamily: `"${fontFamily}", sans-serif`,
        textAlign: cfg.align,
        display: "flex",
        alignItems: "center",
        justifyContent: justifyForAlign(cfg.align),
      }}
    >
      <span className="break-words whitespace-pre-wrap leading-snug max-w-full">
        {cfg.text}
      </span>
    </div>
  );
}
