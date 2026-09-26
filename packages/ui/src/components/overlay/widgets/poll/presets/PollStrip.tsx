"use client";

import {
  FitText,
  SHARE_EASE,
  SHARE_MS,
  capRadius,
  choiceValueText,
  textStyle,
  trackPaint,
  type PollPresetProps,
} from "./shared";

/**
 * One line: the question, who's ahead and the countdown, over a thin bar
 * split by share. Built for tickers and corners.
 */
export function PollStrip({ view, cfg }: PollPresetProps) {
  const showTitle = cfg.showTitle && view.title !== "";
  const lineHeight = Math.max(4, Math.round(cfg.fontSize * 0.22));
  const radius = capRadius(cfg.radius, lineHeight);
  const gap = Math.round(cfg.fontSize * 0.6);
  const lead = view.leader;
  const leadValue = lead ? choiceValueText(lead, cfg) : "";
  const status = view.ended
    ? view.resultText
    : lead
      ? [lead.title, leadValue].filter(Boolean).join(" ")
      : "No votes yet";
  const right = !view.ended && cfg.showTimer ? view.timerText : "";
  const dotColor = lead && view.resultText !== "Tie" ? lead.color : null;
  const dot = Math.round(cfg.fontSize * 0.55);

  return (
    <div
      style={{
        ...textStyle(cfg),
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: Math.round(cfg.fontSize * 0.3),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap, minWidth: 0, whiteSpace: "nowrap" }}>
        {showTitle && (
          <span style={{ flex: "0 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", opacity: 0.8 }}>
            {view.title}
          </span>
        )}
        <FitText
          align={showTitle ? "right" : "left"}
          style={{ flex: "1 1 auto", maxWidth: showTitle ? "60%" : "100%", marginLeft: showTitle ? "auto" : undefined }}
        >
          {/* The leader's colour as a dot: coloured text gets lost over busy footage. */}
          {dotColor && (
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: dot,
                height: dot,
                marginRight: Math.round(dot * 0.6),
                borderRadius: "50%",
                background: dotColor,
                boxShadow: "0 1px 2px rgba(0,0,0,0.6)",
                verticalAlign: "middle",
              }}
            />
          )}
          {status}
        </FitText>
        {right && (
          <span style={{ flexShrink: 0, opacity: 0.85, marginLeft: showTitle ? 0 : "auto" }}>{right}</span>
        )}
      </div>
      <div
        role="img"
        aria-label={view.label}
        style={{
          display: "flex",
          height: lineHeight,
          borderRadius: radius,
          background: trackPaint(cfg),
          overflow: "hidden",
        }}
      >
        {view.choices.map((c) => (
          <div
            key={c.id}
            className="sw-goal-motion"
            style={{
              width: `${c.share * 100}%`,
              background: c.color,
              opacity: view.ended && view.leader && !c.isWinner ? 0.42 : 1,
              transition: `width ${SHARE_MS}ms ${SHARE_EASE}, opacity ${SHARE_MS}ms ease`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
