"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { getDesignSize } from "../../lib/item-scale";
import type { OverlayItem } from "../../types";
import {
  normalizeImageWidgetConfig,
  normalizeVideoWidgetConfig,
  roundingRadiusPx,
  type ImageWidgetItemConfig,
} from "./media-widget-config";

export interface MediaWidgetRendererProps {
  item: OverlayItem;
  /** Editor flag: shows a placeholder while empty and keeps videos muted. */
  isEditor?: boolean;
}

function mediaStyle(cfg: ImageWidgetItemConfig, item: OverlayItem): CSSProperties {
  return {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: cfg.fit,
    borderRadius: roundingRadiusPx(cfg.rounding, getDesignSize(item)),
  };
}

/** On the canvas an empty slot has to be something you can see and select. */
function EmptySlot({ text }: { text: string }) {
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
      {text}
    </div>
  );
}

export function ImageWidgetRenderer({ item, isEditor = false }: MediaWidgetRendererProps) {
  const cfg = useMemo(() => normalizeImageWidgetConfig(item.config), [item.config]);

  if (!cfg.url) return isEditor ? <EmptySlot text="Pick an image in the settings" /> : null;

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={cfg.url} alt="" draggable={false} style={mediaStyle(cfg, item)} />;
}

export function VideoWidgetRenderer({ item, isEditor = false }: MediaWidgetRendererProps) {
  const cfg = useMemo(() => normalizeVideoWidgetConfig(item.config), [item.config]);
  const videoRef = useRef<HTMLVideoElement>(null);
  // The editor is a place to arrange things, not to hear them on a loop.
  const volume = isEditor ? 0 : cfg.volume;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = volume === 0;
    // OBS lets a browser source start with sound; a normal tab does not. There
    // a silent video beats a frozen one.
    video.play().catch(() => {
      video.muted = true;
      void video.play().catch(() => {});
    });
  }, [volume, cfg.url]);

  if (!cfg.url) return isEditor ? <EmptySlot text="Pick a video in the settings" /> : null;

  return (
    <video
      ref={videoRef}
      key={cfg.url}
      src={cfg.url}
      autoPlay
      loop={cfg.loop}
      muted={volume === 0}
      playsInline
      style={mediaStyle(cfg, item)}
    />
  );
}
