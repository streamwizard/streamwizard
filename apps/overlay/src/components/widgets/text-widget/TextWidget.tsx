"use client";

import type { OverlayWidgetProps } from "@/components/widgets/types";
import type { Json } from "@/types/supabase";

function cfg(config: Json): Record<string, unknown> {
  return typeof config === "object" && config !== null && !Array.isArray(config)
    ? (config as Record<string, unknown>)
    : {};
}

const FALLBACK_TEXT_COLOR = "#ffffff";

export function TextWidget({ item }: OverlayWidgetProps) {
  const raw = item.config;
  const c = cfg(raw);
  const text = typeof c.text === "string" ? c.text : "";
  const fontSize = typeof c.fontSize === "number" ? c.fontSize : 24;
  const color =
    typeof c.color === "string" && c.color.startsWith("#")
      ? c.color
      : FALLBACK_TEXT_COLOR;
  const alignRaw = c.align;
  const textAlign =
    alignRaw === "center" || alignRaw === "right" ? alignRaw : "left";
  const fontWeight =
    c.fontWeight === 500 ||
    c.fontWeight === 600 ||
    c.fontWeight === 700 ||
    c.fontWeight === 400
      ? c.fontWeight
      : 400;
  const fontFamily =
    typeof c.fontFamily === "string" && c.fontFamily.trim()
      ? `"${c.fontFamily.trim()}", sans-serif`
      : "system-ui, sans-serif";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        display: "flex",
        alignItems: "flex-start",
        justifyContent:
          textAlign === "center"
            ? "center"
            : textAlign === "right"
              ? "flex-end"
              : "flex-start",
        boxSizing: "border-box",
      }}
    >
      <span
        style={{
          fontSize,
          color,
          fontWeight,
          fontFamily,
          textAlign,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          lineHeight: 1.2,
          margin: 0,
        }}
      >
        {text}
      </span>
    </div>
  );
}
