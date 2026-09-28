"use client";

import {
  EdgePulse,
  FILL_EASE,
  FILL_MS,
  FillShine,
  FitText,
  GoalIcon,
  fillPaint,
  statsText,
  textStyle,
  type GoalPresetProps,
} from "./shared";

/**
 * A thermometer: a tall tube over a round bulb, filling from the bottom. Made
 * for the narrow columns beside a camera or a game HUD.
 *
 * Two layers. The glass (tube + bulb) is drawn opaque inside one wrapper that
 * carries the track opacity, so where the two pieces overlap the see-through
 * glass doesn't double up. The liquid sits inset inside the glass: the bulb is
 * always full, and the column rises from the bulb's centre, so the join is
 * one continuous shape.
 */
export function GoalTube({ view, cfg, pulseKey, celebrating }: GoalPresetProps) {
  // No title set here or on Twitch: show none rather than a made-up one.
  const showTitle = cfg.showTitle && view.title !== "";
  const tube = Math.max(18, Math.round(cfg.fontSize * 1.2));
  const bulb = Math.round(tube * 1.8);
  // The glass wall around the liquid.
  const wall = Math.max(3, Math.round(tube * 0.2));
  const liquidWidth = tube - wall * 2;
  const pulseColor = cfg.fillMode === "gradient" ? cfg.fillColor2 : cfg.fillColor;
  const stats = statsText(view, cfg);

  // The column starts at the bulb's centre (hidden under the bulb's liquid)
  // and rises from there: progress 0 puts its top on the bulb's rim, progress
  // 1 at the inside of the tube's top. Ticks use the same scale, measured
  // from the bottom of the box.
  const travel = `(100% - ${bulb + wall}px)`;
  const column = (t: number) => `calc(${bulb / 2}px + ${travel} * ${t})`;
  const tick = (t: number) => `calc(${bulb}px + ${travel} * ${t})`;

  return (
    <div
      style={{
        ...textStyle(cfg),
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: Math.round(cfg.fontSize * 0.4),
        textAlign: "center",
      }}
    >
      {(showTitle || cfg.showIcon) && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, maxWidth: "100%" }}>
          {cfg.showIcon && <GoalIcon kind={view.icon} url={cfg.iconUrl} size={Math.round(cfg.fontSize * 1.2)} color={cfg.fillColor} />}
          {showTitle && (
            // The column is narrow: wrap, but stop at three lines so the tube keeps its room.
            <span
              style={{
                overflowWrap: "anywhere",
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {view.title}
            </span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={view.target}
        aria-valuenow={view.current}
        aria-label={view.label}
        style={{ position: "relative", flex: "1 1 auto", minHeight: bulb * 2, width: bulb }}
      >
        {/* Glass. */}
        <div aria-hidden style={{ position: "absolute", inset: 0, opacity: cfg.trackOpacity }}>
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: bulb / 2,
              left: (bulb - tube) / 2,
              width: tube,
              borderRadius: `${tube / 2}px ${tube / 2}px 0 0`,
              background: cfg.trackColor,
            }}
          />
          <div
            style={{ position: "absolute", bottom: 0, left: 0, width: bulb, height: bulb, borderRadius: "50%", background: cfg.trackColor }}
          />
        </div>

        {/* Liquid: the column, then the bulb over its bottom end. */}
        <div
          className="sw-goal-motion"
          style={{
            position: "absolute",
            bottom: bulb / 2,
            left: (bulb - liquidWidth) / 2,
            width: liquidWidth,
            height: column(view.progress),
            borderRadius: `${liquidWidth / 2}px ${liquidWidth / 2}px 0 0`,
            background: fillPaint(cfg, "0deg"),
            transition: `height ${FILL_MS}ms ${FILL_EASE}`,
            overflow: "hidden",
          }}
        >
          <FillShine play={celebrating} />
        </div>
        <div
          aria-hidden
          style={{
            position: "absolute",
            bottom: wall,
            left: wall,
            width: bulb - wall * 2,
            height: bulb - wall * 2,
            borderRadius: "50%",
            background: cfg.fillColor,
            boxShadow: `inset -${Math.round(bulb * 0.1)}px -${Math.round(bulb * 0.1)}px 0 rgba(0,0,0,0.18)`,
          }}
        />

        {/* Ticks at a quarter, half and three quarters. */}
        {[0.25, 0.5, 0.75].map((t) => (
          <span
            key={t}
            aria-hidden
            style={{
              position: "absolute",
              left: (bulb - tube) / 2 - Math.round(tube * 0.35),
              width: Math.round(tube * 0.3),
              bottom: tick(t),
              height: 2,
              borderRadius: 1,
              background: cfg.textColor,
              opacity: 0.55,
            }}
          />
        ))}

        {/* The pulse rides the liquid's top edge. */}
        <div
          className="sw-goal-motion"
          aria-hidden
          style={{
            position: "absolute",
            bottom: bulb / 2,
            left: bulb / 2,
            height: column(view.progress),
            transition: `height ${FILL_MS}ms ${FILL_EASE}`,
            pointerEvents: "none",
          }}
        >
          <span style={{ position: "absolute", top: 0, left: 0 }}>
            <EdgePulse pulseKey={pulseKey} color={pulseColor} size={tube * 2} />
          </span>
        </div>
      </div>
      {stats && (
        <FitText align="center" style={{ width: "100%", flexShrink: 0 }}>
          {stats}
        </FitText>
      )}
      {cfg.showRemaining && (
        <FitText align="center" style={{ width: "100%", flexShrink: 0, fontSize: Math.round(cfg.fontSize * 0.72), opacity: 0.85 }}>
          {view.remainingText}
        </FitText>
      )}
    </div>
  );
}
