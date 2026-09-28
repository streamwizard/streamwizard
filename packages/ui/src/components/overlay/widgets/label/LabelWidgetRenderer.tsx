"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  buildDemoLabelSnapshot,
  formatLabelTemplate,
  getLabelDefinition,
  labelTemplateValues,
  resolveLabel,
  type LabelSnapshot,
  type ResolvedLabel,
} from "@repo/schemas";
import { useGoogleFont } from "../../hooks/use-google-font";
import type { OverlayItem, OverlayScene } from "../../types";
import {
  LABEL_ANIMATE_PREVIEW_EVENT,
  effectiveLabelTemplate,
  normalizeLabelWidgetConfig,
  type LabelAnimatePreviewDetail,
  type LabelWidgetItemConfig,
} from "./label-widget-config";
import { useStreamLabels } from "./use-stream-labels";

export interface LabelWidgetRendererProps {
  item: OverlayItem;
  /** Needed for the snapshot read and the live WS subscription on the overlay. */
  scene?: OverlayScene;
  /** Editor flag: reads through the dashboard session and fills empty labels with sample data. */
  isEditor?: boolean;
}

const SHADOW = "0 1px 2px rgba(0,0,0,0.85), 0 0 6px rgba(0,0,0,0.45)";

const KEYFRAMES = `
@keyframes sw-label-pop { 0% { transform: scale(0.6); opacity: 0 } 60% { transform: scale(1.12); opacity: 1 } 100% { transform: scale(1) } }
@keyframes sw-label-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes sw-label-slide_up { from { transform: translateY(70%); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes sw-label-slide_side { from { transform: translateX(-40%); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes sw-label-bounce {
  0% { transform: translateY(-110%); opacity: 0 }
  45% { transform: translateY(0); opacity: 1 }
  65% { transform: translateY(-18%) }
  82% { transform: translateY(0) }
  92% { transform: translateY(-5%) }
  100% { transform: translateY(0) }
}
@keyframes sw-label-typewriter { from { clip-path: inset(0 100% 0 0) } to { clip-path: inset(0 0 0 0) } }
@keyframes sw-label-glow {
  0% { filter: drop-shadow(0 0 0 transparent); transform: scale(1) }
  30% { filter: drop-shadow(0 0 0.35em var(--sw-label-glow)) drop-shadow(0 0 0.8em var(--sw-label-glow)); transform: scale(1.05) }
  100% { filter: drop-shadow(0 0 0 transparent); transform: scale(1) }
}
@keyframes sw-label-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
@media (prefers-reduced-motion: reduce) { .sw-label-enter, .sw-label-marquee { animation: none !important } }
`;

/** Formatted lines for a resolved label; empty when there is nothing to show. */
function linesFor(resolved: ResolvedLabel, cfg: LabelWidgetItemConfig): string[] {
  const template = effectiveLabelTemplate(cfg);
  switch (resolved.shape) {
    case "entry":
      return resolved.entry ? [formatLabelTemplate(template, labelTemplateValues(resolved.entry))] : [];
    case "number":
      return resolved.value === null ? [] : [formatLabelTemplate(template, { amount: resolved.value })];
    case "list":
    case "leaders":
      return resolved.items
        .slice(0, cfg.count)
        .map((item) => formatLabelTemplate(template, labelTemplateValues(item)))
        .filter(Boolean);
  }
}

function justify(align: LabelWidgetItemConfig["align"]): string {
  if (align === "left") return "flex-start";
  if (align === "right") return "flex-end";
  return "center";
}

/** The CSS animation for a new value, or undefined for none. */
function enterAnimation(cfg: LabelWidgetItemConfig, text: string): string | undefined {
  const ms = cfg.animationDuration;
  switch (cfg.animation) {
    case "none":
      return undefined;
    case "typewriter":
      // One step per character, so letters appear whole.
      return `sw-label-typewriter ${ms}ms steps(${Math.max(1, [...text].length)}, end) both`;
    case "bounce":
      return `sw-label-bounce ${ms}ms ease-out both`;
    case "glow":
      return `sw-label-glow ${Math.max(ms, 600)}ms ease-out both`;
    case "pop":
      return `sw-label-pop ${ms}ms cubic-bezier(0.34, 1.56, 0.64, 1) both`;
    default:
      return `sw-label-${cfg.animation} ${ms}ms cubic-bezier(0.22, 1, 0.36, 1) both`;
  }
}

let demoSnapshot: LabelSnapshot | null = null;

export function LabelWidgetRenderer({ item, scene, isEditor = false }: LabelWidgetRendererProps) {
  const cfg = useMemo(() => normalizeLabelWidgetConfig(item.config), [item.config]);
  useGoogleFont(cfg.fontFamily);

  const { status, snapshot } = useStreamLabels({ isEditor, token: scene?.subscriber_token, sceneId: scene?.id });
  const def = getLabelDefinition(cfg.labelId);

  let lines = linesFor(resolveLabel(snapshot, def, cfg.period), cfg);
  // The editor fills an empty label with sample data, dimmed, so the layout
  // can be judged before the channel has a single follower.
  let preview = false;
  if (lines.length === 0 && isEditor) {
    demoSnapshot ??= buildDemoLabelSnapshot();
    lines = linesFor(resolveLabel(demoSnapshot, def, cfg.period), cfg);
    preview = lines.length > 0;
  }

  // The animation plays when the value changes, never on first load: an
  // overlay (re)loading in OBS shouldn't replay every label. `tick` keys the
  // animated span, so each change (or a Preview click) starts it over.
  const changeKey = lines.join("\n");
  const seen = useRef<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (seen.current !== null && seen.current !== changeKey) setTick((t) => t + 1);
    seen.current = changeKey;
  }, [changeKey]);

  // Editor: the settings' Preview button replays it.
  useEffect(() => {
    if (!isEditor || typeof window === "undefined") return;
    const onPreview = (e: Event) => {
      if ((e as CustomEvent<LabelAnimatePreviewDetail>).detail?.itemId === item.id) setTick((t) => t + 1);
    };
    window.addEventListener(LABEL_ANIMATE_PREVIEW_EVENT, onPreview);
    return () => window.removeEventListener(LABEL_ANIMATE_PREVIEW_EVENT, onPreview);
  }, [isEditor, item.id]);

  const prefix = cfg.prefix.trim();
  const isList = def.shape === "list" || (def.shape === "leaders" && !def.single);

  if (lines.length === 0) {
    if (!isEditor && (status === "loading" || !cfg.emptyText.trim())) return null;
    lines = cfg.emptyText.trim() ? [cfg.emptyText.trim()] : [];
  }

  const text: CSSProperties = {
    fontFamily: `"${cfg.fontFamily}", sans-serif`,
    fontSize: cfg.fontSize,
    fontWeight: cfg.fontWeight,
    color: cfg.color,
    textShadow: cfg.textShadow ? SHADOW : "none",
    lineHeight: 1.25,
    fontVariantNumeric: "tabular-nums",
  };
  const cross = cfg.align === "left" ? "flex-start" : cfg.align === "right" ? "flex-end" : "center";
  const stacked = cfg.layout === "stacked" || (isList && cfg.direction === "vertical");
  const enter = (line: string): CSSProperties =>
    tick > 0 ? { display: "inline-block", animation: enterAnimation(cfg, line), ["--sw-label-glow" as string]: cfg.prefixColor } : { display: "inline-block" };

  let body;
  if (!isList) {
    body = (
      <span key={tick} className="sw-label-enter" style={{ ...enter(lines[0] ?? ""), whiteSpace: "nowrap" }}>
        {lines[0]}
      </span>
    );
  } else if (cfg.direction === "vertical") {
    body = (
      <span style={{ display: "flex", flexDirection: "column", alignItems: cross, gap: Math.round(cfg.fontSize * 0.15) }}>
        {lines.map((line, i) => (
          <span
            key={i === 0 ? `new:${tick}` : i}
            className={i === 0 ? "sw-label-enter" : undefined}
            style={{ whiteSpace: "nowrap", ...(i === 0 ? enter(line) : null) }}
          >
            {line}
          </span>
        ))}
      </span>
    );
  } else {
    const sep = cfg.separator.trim();
    const row = (
      <span style={{ display: "inline-flex", alignItems: "center", gap: Math.round(cfg.fontSize * 0.5), whiteSpace: "nowrap" }}>
        {lines.map((line, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: Math.round(cfg.fontSize * 0.5) }}>
            {i > 0 && sep && <span style={{ opacity: 0.6 }}>{sep}</span>}
            {/* A ticker is always moving, so only a still row animates its newest entry. */}
            {i === 0 && !cfg.marquee ? (
              <span key={`new:${tick}`} className="sw-label-enter" style={enter(line)}>
                {line}
              </span>
            ) : (
              <span>{line}</span>
            )}
          </span>
        ))}
        {cfg.marquee && sep && <span style={{ opacity: 0.6 }}>{sep}</span>}
      </span>
    );
    body = cfg.marquee ? (
      <span style={{ display: "block", overflow: "hidden", minWidth: 0, flex: "1 1 auto" }}>
        <span
          className="sw-label-marquee"
          style={{
            display: "inline-flex",
            gap: Math.round(cfg.fontSize * 0.5),
            // Two copies scroll by half their width, so the loop is seamless.
            animation: `sw-label-marquee ${Math.max(4, (changeKey.length * cfg.fontSize * 0.55) / cfg.marqueeSpeed)}s linear infinite`,
          }}
        >
          {row}
          {row}
        </span>
      </span>
    ) : (
      row
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        alignItems: isList && cfg.direction === "vertical" ? "flex-start" : "center",
        justifyContent: justify(cfg.align),
        padding: "4px 8px",
        opacity: preview ? 0.55 : 1,
      }}
      title={preview ? "Sample data: shows your real values once there are some" : undefined}
    >
      <style>{KEYFRAMES}</style>
      <div
        style={{
          ...text,
          display: "flex",
          flexDirection: stacked ? "column" : "row",
          alignItems: stacked ? cross : "center",
          gap: stacked ? Math.round(cfg.fontSize * 0.15) : Math.round(cfg.fontSize * 0.35),
          maxWidth: "100%",
          minWidth: 0,
          width: cfg.marquee && isList && cfg.direction === "horizontal" ? "100%" : undefined,
        }}
      >
        {prefix !== "" && (
          <span
            style={{
              color: cfg.prefixColor,
              whiteSpace: "nowrap",
              flexShrink: 0,
              ...(stacked ? { fontSize: Math.round(cfg.fontSize * 0.6) } : null),
            }}
          >
            {prefix}
          </span>
        )}
        {body}
      </div>
    </div>
  );
}
