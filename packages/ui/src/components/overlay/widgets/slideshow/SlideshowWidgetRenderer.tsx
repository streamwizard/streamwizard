"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { getDesignSize } from "../../lib/item-scale";
import type { OverlayItem } from "../../types";
import { roundingRadiusPx } from "../media/media-widget-config";
import {
  SLIDESHOW_TRANSITION_MS,
  nextSlideIndex,
  normalizeSlideshowWidgetConfig,
  type SlideshowWidgetItemConfig,
} from "./slideshow-widget-config";

export interface SlideshowWidgetRendererProps {
  item: OverlayItem;
  /** Editor flag: shows a placeholder while the list is empty. */
  isEditor?: boolean;
}

const KEYFRAMES = `
@keyframes sw-slideshow-fade-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes sw-slideshow-fade-out { from { opacity: 1 } to { opacity: 0 } }
@keyframes sw-slideshow-slide-in { from { transform: translateX(100%) } to { transform: translateX(0) } }
@keyframes sw-slideshow-slide-out { from { transform: translateX(0) } to { transform: translateX(-100%) } }
`;

interface SlideState {
  /** Counts up per change. Layers are keyed on it, so each change starts fresh animations. */
  seq: number;
  index: number;
  /** The picture on its way out; null before the first change. */
  previous: number | null;
}

function layerAnimation(cfg: SlideshowWidgetItemConfig, direction: "in" | "out"): string {
  return `sw-slideshow-${cfg.transition}-${direction} ${SLIDESHOW_TRANSITION_MS}ms ease both`;
}

/**
 * The pictures themselves. Mounted per list of pictures, so a changed list
 * starts over from the first one instead of pointing past the end.
 */
function Slides({ cfg, radius }: { cfg: SlideshowWidgetItemConfig; radius: number }) {
  const { images } = cfg;
  const [state, setState] = useState<SlideState>({ seq: 0, index: 0, previous: null });

  useEffect(() => {
    if (images.length < 2) return;
    const id = window.setInterval(() => {
      setState((s) => ({
        seq: s.seq + 1,
        index: nextSlideIndex(s.index, images.length, cfg.shuffle),
        previous: s.index,
      }));
    }, cfg.intervalSeconds * 1000);
    return () => window.clearInterval(id);
  }, [images.length, cfg.intervalSeconds, cfg.shuffle]);

  // Only the picture on screen is in the page, so the rest are fetched ahead
  // of time; otherwise each one would pop in half-loaded on the first lap.
  useEffect(() => {
    for (const src of images) new Image().src = src;
  }, [images]);

  const layer: CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: cfg.fit,
    display: "block",
  };
  // The picture on its way out, while there is a transition to show it leaving.
  const leaving = cfg.transition === "none" ? null : state.previous;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", borderRadius: radius }}>
      <style>{KEYFRAMES}</style>
      {leaving !== null ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={state.seq - 1}
          src={images[leaving]}
          alt=""
          draggable={false}
          style={{ ...layer, animation: layerAnimation(cfg, "out") }}
        />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={state.seq}
        src={images[state.index]}
        alt=""
        draggable={false}
        style={{ ...layer, animation: leaving !== null ? layerAnimation(cfg, "in") : undefined }}
      />
    </div>
  );
}

export function SlideshowWidgetRenderer({ item, isEditor = false }: SlideshowWidgetRendererProps) {
  const cfg = useMemo(() => normalizeSlideshowWidgetConfig(item.config), [item.config]);
  const radius = roundingRadiusPx(cfg.rounding, getDesignSize(item));

  if (cfg.images.length === 0) {
    if (!isEditor) return null;
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 12,
          border: "2px dashed rgba(255,255,255,0.45)",
          borderRadius: 12,
          background: "rgba(0,0,0,0.35)",
          color: "rgba(255,255,255,0.85)",
          fontFamily: "system-ui, sans-serif",
          fontSize: 18,
          textAlign: "center",
        }}
      >
        Add images in the settings
      </div>
    );
  }

  return <Slides key={cfg.images.join("\n")} cfg={cfg} radius={radius} />;
}
