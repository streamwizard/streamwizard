"use client";

import type { CSSProperties } from "react";
import type { GoalWidgetItemConfig } from "../goal-widget-config";
import type { GoalView } from "../goal-view";
import { FitText, GoalIcon, statsMaxWidth, statsText } from "./shared";

/**
 * Icon, title on the left, numbers and percent on the right. Bar, Blocks and
 * Strip share it; nothing renders when all of it is switched off.
 */
export function TitleRow({
  view,
  cfg,
  style,
}: {
  view: GoalView;
  cfg: GoalWidgetItemConfig;
  style?: CSSProperties;
}) {
  // No title set here or on Twitch: show none rather than a made-up one.
  const showTitle = cfg.showTitle && view.title !== "";
  const stats = statsText(view, cfg);
  if (!showTitle && !stats && !cfg.showIcon) return null;
  const iconSize = Math.round(cfg.fontSize * 1.05);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: Math.round(cfg.fontSize * 0.4), minWidth: 0, ...style }}>
      {cfg.showIcon && <GoalIcon kind={view.icon} url={cfg.iconUrl} size={iconSize} color={cfg.fillColor} />}
      <span style={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {showTitle ? view.title : ""}
      </span>
      {/* The title gives way first (ellipsis); numbers shrink only if they alone don't fit. */}
      {stats && (
        <FitText align="right" style={{ flexShrink: 0, maxWidth: statsMaxWidth(showTitle) }}>
          {stats}
        </FitText>
      )}
    </div>
  );
}

/** "12 subs to go" under a bar, smaller and a touch dimmer than the title. */
export function RemainingLine({ view, cfg, align = "right" }: { view: GoalView; cfg: GoalWidgetItemConfig; align?: "left" | "right" | "center" }) {
  if (!cfg.showRemaining) return null;
  return (
    <FitText align={align} style={{ fontSize: Math.round(cfg.fontSize * 0.72), opacity: 0.85 }}>
      {view.remainingText}
    </FitText>
  );
}
