"use client";

import { useGoogleFont } from "@/hooks/use-google-font";
import { formatClockWidgetDisplay } from "@/lib/format-clock-widget";
import { normalizeClockWidgetConfig, resolvedTextWidgetFontFamily } from "@/types/overlays";
import { useEffect, useState } from "react";
import type { OverlayCanvasProps } from "../../registry/overlay-widget-registry.types";

function justifyForAlign(align: "left" | "center" | "right") {
  if (align === "left") return "flex-start";
  if (align === "right") return "flex-end";
  return "center";
}

export function ClockWidgetCanvas({ item, zoom }: OverlayCanvasProps) {
  const cfg = normalizeClockWidgetConfig(item.config);
  const fontFamily = resolvedTextWidgetFontFamily(cfg);
  useGoogleFont(fontFamily);

  const [display, setDisplay] = useState(() =>
    formatClockWidgetDisplay(cfg, new Date())
  );

  useEffect(() => {
    const c = normalizeClockWidgetConfig(item.config);
    function tick() {
      const t = new Date();
      setDisplay(formatClockWidgetDisplay(c, t));
    }
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [item.config]);

  const stacked = cfg.layout === "stacked" && cfg.showDate && cfg.showTime;

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
      {stacked ? (
        <span className="tabular-nums leading-tight max-w-full whitespace-pre-line">
          {display}
        </span>
      ) : (
        <span className="tabular-nums whitespace-nowrap leading-snug max-w-full">
          {display}
        </span>
      )}
    </div>
  );
}
