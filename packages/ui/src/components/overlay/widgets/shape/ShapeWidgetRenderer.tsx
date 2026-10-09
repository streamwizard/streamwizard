"use client";

import { useId, useMemo } from "react";
import { getDesignSize } from "../../lib/item-scale";
import type { OverlayItem } from "../../types";
import { roundingRadiusPx } from "../media/media-widget-config";
import { normalizeShapeWidgetConfig, shapeGradientLine, shapePolygonPoints } from "./shape-widget-config";

export interface ShapeWidgetRendererProps {
  item: OverlayItem;
}

export function ShapeWidgetRenderer({ item }: ShapeWidgetRendererProps) {
  const cfg = useMemo(() => normalizeShapeWidgetConfig(item.config), [item.config]);
  const { w, h } = getDesignSize(item);
  // Colons from useId are legal in an id but not inside url(#...).
  const id = `sw-shape-${useId().replace(/:/g, "")}`;
  const isLine = cfg.shape === "line";
  // A line is all color: with no fill there would be nothing left of it.
  const fillType = isLine && cfg.fillType === "none" ? "solid" : cfg.fillType;
  const fillGradient = fillType === "gradient";
  const strokeGradient = !isLine && cfg.strokeWidth > 0 && cfg.strokeType === "gradient";
  const fill = fillType === "none" ? "none" : fillGradient ? `url(#${id}-fill)` : cfg.fillColor;

  // The outline is centred on the shape's edge, so the shape is drawn half an
  // outline in from the box and nothing sticks out of it.
  const inset = cfg.strokeWidth / 2;
  const paint = {
    fill,
    fillOpacity: cfg.fillOpacity,
    stroke: cfg.strokeWidth <= 0 ? "none" : strokeGradient ? `url(#${id}-stroke)` : cfg.strokeColor,
    strokeWidth: cfg.strokeWidth,
    // Round joins keep a sharp star point from poking past the box.
    strokeLinejoin: "round" as const,
  };

  let shape;
  if (isLine) {
    // A round cap adds half the thickness past each end, so the line starts that far in.
    const cap = cfg.roundedEnds ? Math.min(cfg.lineWidth, w) / 2 : 0;
    shape = (
      <line
        x1={cap}
        y1={h / 2}
        x2={w - cap}
        y2={h / 2}
        stroke={fill}
        strokeOpacity={cfg.fillOpacity}
        strokeWidth={cfg.lineWidth}
        strokeLinecap={cfg.roundedEnds ? "round" : "butt"}
      />
    );
  } else if (cfg.shape === "ellipse") {
    shape = <ellipse cx={w / 2} cy={h / 2} rx={Math.max(0, w / 2 - inset)} ry={Math.max(0, h / 2 - inset)} {...paint} />;
  } else if (cfg.shape === "rectangle") {
    const box = { w: Math.max(0, w - cfg.strokeWidth), h: Math.max(0, h - cfg.strokeWidth) };
    shape = (
      <rect x={inset} y={inset} width={box.w} height={box.h} rx={roundingRadiusPx(cfg.rounding, box)} {...paint} />
    );
  } else {
    const points = shapePolygonPoints(cfg.shape, w, h, inset)
      .map(([x, y]) => `${x},${y}`)
      .join(" ");
    shape = <polygon points={points} {...paint} />;
  }

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ display: "block" }}
      aria-hidden
    >
      {fillGradient || strokeGradient ? (
        // In box px, not the shape's bounding box: a line has no height to measure.
        <defs>
          {fillGradient ? (
            <linearGradient
              id={`${id}-fill`}
              gradientUnits="userSpaceOnUse"
              {...shapeGradientLine(cfg.gradientAngle, w, h)}
            >
              <stop offset="0" stopColor={cfg.fillColor} />
              <stop offset="1" stopColor={cfg.gradientColor} />
            </linearGradient>
          ) : null}
          {strokeGradient ? (
            <linearGradient
              id={`${id}-stroke`}
              gradientUnits="userSpaceOnUse"
              {...shapeGradientLine(cfg.strokeGradientAngle, w, h)}
            >
              <stop offset="0" stopColor={cfg.strokeColor} />
              <stop offset="1" stopColor={cfg.strokeGradientColor} />
            </linearGradient>
          ) : null}
        </defs>
      ) : null}
      {shape}
    </svg>
  );
}
