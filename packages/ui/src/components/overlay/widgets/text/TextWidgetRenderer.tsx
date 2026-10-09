"use client";

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useGoogleFont } from "../../hooks/use-google-font";
import { getDesignSize } from "../../lib/item-scale";
import { normalizeTextWidgetConfig } from "../../types";
import type { OverlayItem, TextWidgetItemConfig } from "../../types";
import { hexToRgba } from "../goal/presets/shared";
import { roundingRadiusPx } from "../media/media-widget-config";

export type WidgetRenderProps = {
  item: OverlayItem;
};

const SHADOW = "0 1px 2px rgba(0,0,0,0.85), 0 0 6px rgba(0,0,0,0.45)";

const KEYFRAMES = `
@keyframes sw-text-ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
@media (prefers-reduced-motion: reduce) { .sw-text-ticker { animation: none !important } }
`;

/** Horizontal padding of the box, in px. The ticker needs it to know its own width. */
const PADDING_X = 8;

function justifyForAlign(align: "left" | "center" | "right"): string {
  if (align === "left") return "flex-start";
  if (align === "right") return "flex-end";
  return "center";
}

/**
 * The text, with an outline when one is set. A CSS text stroke is centred on
 * the edge of each letter, so half of it eats into the letter itself. Drawing
 * the stroke at double width on a copy behind the real text leaves exactly the
 * outer half showing, and works in every browser OBS has shipped.
 */
function StyledText({ cfg, style }: { cfg: TextWidgetItemConfig; style: CSSProperties }) {
  const text = cfg.scroll ? cfg.text.replace(/\s*\n\s*/g, " ") : cfg.text;
  const shadow = cfg.textShadow ? SHADOW : undefined;

  if (cfg.outlineWidth <= 0) {
    return <span style={{ ...style, textShadow: shadow }}>{text}</span>;
  }

  return (
    <span style={{ display: "inline-grid", maxWidth: style.maxWidth }}>
      <span
        aria-hidden
        style={{
          ...style,
          gridArea: "1 / 1",
          WebkitTextStroke: `${cfg.outlineWidth * 2}px ${cfg.outlineColor}`,
          strokeLinejoin: "round",
          textShadow: shadow,
        }}
      >
        {text}
      </span>
      <span style={{ ...style, gridArea: "1 / 1" }}>{text}</span>
    </span>
  );
}

/**
 * Runs its content across the box in a loop. Two copies sit side by side and
 * the pair slides left by one copy, so the seam never shows. Each copy is at
 * least as wide as the box, or a short line would leave it half empty.
 */
function Ticker({ boxWidth, speed, gap, children }: { boxWidth: number; speed: number; gap: number; children: ReactNode }) {
  const copyRef = useRef<HTMLDivElement>(null);
  const [copyWidth, setCopyWidth] = useState(0);

  useLayoutEffect(() => {
    const el = copyRef.current;
    if (!el) return;
    const measure = () => setCopyWidth(el.offsetWidth);
    measure();
    // The font arrives after first paint and changes the width with it.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const copyStyle: CSSProperties = {
    flex: "0 0 auto",
    minWidth: boxWidth,
    paddingRight: gap,
    boxSizing: "border-box",
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ width: "100%", overflow: "hidden" }}>
      <div
        className="sw-text-ticker"
        style={{
          display: "flex",
          width: "max-content",
          animation: copyWidth > 0 ? `sw-text-ticker ${copyWidth / speed}s linear infinite` : "none",
        }}
      >
        <div ref={copyRef} style={copyStyle}>
          {children}
        </div>
        <div aria-hidden style={copyStyle}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function TextWidgetRenderer({ item }: WidgetRenderProps) {
  const cfg = useMemo(() => normalizeTextWidgetConfig(item.config), [item.config]);
  useGoogleFont(cfg.fontFamily);
  const design = getDesignSize(item);

  const body = cfg.scroll ? (
    <>
      <style>{KEYFRAMES}</style>
      <Ticker boxWidth={Math.max(0, design.w - PADDING_X * 2)} speed={cfg.scrollSpeed} gap={cfg.fontSize * 2}>
        <StyledText cfg={cfg} style={{ whiteSpace: "nowrap", lineHeight: 1.2 }} />
      </Ticker>
    </>
  ) : (
    <StyledText
      cfg={cfg}
      style={{ wordBreak: "break-word", whiteSpace: "pre-wrap", lineHeight: 1.2, maxWidth: "100%" }}
    />
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: justifyForAlign(cfg.align),
        boxSizing: "border-box",
        padding: `4px ${PADDING_X}px`,
        color: cfg.color,
        fontSize: cfg.fontSize,
        fontWeight: cfg.fontWeight,
        fontFamily: `"${cfg.fontFamily}", sans-serif`,
        textAlign: cfg.align,
        background: cfg.backgroundOpacity > 0 ? hexToRgba(cfg.backgroundColor, cfg.backgroundOpacity) : undefined,
        borderRadius: roundingRadiusPx(cfg.backgroundRounding, design),
      }}
    >
      {body}
    </div>
  );
}
