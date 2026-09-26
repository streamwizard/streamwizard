"use client";

import type { CSSProperties, ReactNode } from "react";
import type { HypeTrainWidgetPreset } from "./hype-train-widget-config";

/**
 * The train, drawn in SVG. Every car is authored facing left, 200 design px
 * tall, with the rail at y = 196; the renderer mirrors them for a train riding
 * right and scales the whole row to the widget's height.
 */

export const TRAIN_H = 200;
export const LOCO_W = 250;
export const WAGON_W = 180;
export const CABOOSE_W = 150;
export const COUPLER_W = 12;
const RAIL_Y = 196;

export interface TrainPaint {
  body: string;
  accent: string;
  /** Chassis, roofs, outlines. */
  dark: string;
}

/** Golden Kappa trains ride in gold, whatever the widget's colours. */
export function trainPaint(trainColor: string, accentColor: string, trainType: string): TrainPaint {
  if (trainType === "golden_kappa") return { body: "#e8b923", accent: "#fff3c4", dark: "#5a4309" };
  return { body: trainColor, accent: accentColor, dark: shade(trainColor, -0.62) };
}

/** Lighten (amount > 0) or darken (amount < 0) a hex colour. */
export function shade(hex: string, amount: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = Number.parseInt(h, 16);
  if (Number.isNaN(n)) return hex;
  const mix = (c: number) =>
    Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)
      .toString(16)
      .padStart(2, "0");
  return `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`;
}

/** Bright toy colours, one per wagon in turn. */
const TOY_PALETTE = ["#ef476f", "#06d6a0", "#118ab2", "#ffd166", "#9b5de5", "#f15bb5"];

export const HYPE_TRAIN_KEYFRAMES = `
@keyframes sw-ht-spin { to { transform: rotate(-360deg) } }
@keyframes sw-ht-bob { 0%, 100% { transform: none } 50% { transform: translateY(-2px) } }
@keyframes sw-ht-puff {
  0% { transform: translate(0, 0) scale(0.35); opacity: 0.9 }
  100% { transform: translate(52px, -34px) scale(1.7); opacity: 0 }
}
@keyframes sw-ht-glow { 0%, 100% { opacity: 0.55 } 50% { opacity: 1 } }
.sw-ht-wheel { animation: sw-ht-spin var(--sw-ht-spin, 0.6s) linear infinite; transform-box: fill-box; transform-origin: center }
.sw-ht-bob { animation: sw-ht-bob 0.42s ease-in-out infinite }
.sw-ht-puff { animation: sw-ht-puff 1.6s ease-out infinite; transform-box: fill-box; transform-origin: center }
.sw-ht-glow { animation: sw-ht-glow 1.2s ease-in-out infinite }
.sw-ht[data-parked="true"] .sw-ht-wheel, .sw-ht[data-parked="true"] .sw-ht-bob { animation-play-state: paused }
@media (prefers-reduced-motion: reduce) {
  .sw-ht-wheel, .sw-ht-bob, .sw-ht-puff, .sw-ht-glow { animation: none !important }
}
`;

function Wheel({ cx, r, fill, hub, spokes = true }: { cx: number; r: number; fill: string; hub: string; spokes?: boolean }) {
  const cy = RAIL_Y - r;
  return (
    <g className="sw-ht-wheel">
      <circle cx={cx} cy={cy} r={r} fill={fill} />
      <circle cx={cx} cy={cy} r={r * 0.72} fill="none" stroke={hub} strokeOpacity={0.5} strokeWidth={2} />
      {spokes ? (
        <>
          <line x1={cx - r * 0.7} y1={cy} x2={cx + r * 0.7} y2={cy} stroke={hub} strokeWidth={2.5} />
          <line x1={cx} y1={cy - r * 0.7} x2={cx} y2={cy + r * 0.7} stroke={hub} strokeWidth={2.5} />
        </>
      ) : (
        <circle cx={cx + r * 0.45} cy={cy} r={r * 0.18} fill={hub} />
      )}
      <circle cx={cx} cy={cy} r={r * 0.24} fill={hub} />
    </g>
  );
}

function Puffs({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g>
      {[0, 0.55, 1.1].map((delay) => (
        <circle
          key={delay}
          className="sw-ht-puff"
          cx={x}
          cy={y}
          r={14}
          fill={color}
          style={{ animationDelay: `${delay}s`, opacity: 0 }}
        />
      ))}
    </g>
  );
}

/**
 * A car's SVG, mirrored when the train faces right. Without `mirror` it
 * follows the `--sw-ht-flip` variable, which a bouncing ride sets per car as it
 * turns; the car's text is never mirrored either way.
 */
function CarSvg({ width, mirror, children, style }: { width: number; mirror: boolean; children: ReactNode; style?: CSSProperties }) {
  return (
    <svg
      width={width}
      height={TRAIN_H}
      viewBox={`0 0 ${width} ${TRAIN_H}`}
      style={{ position: "absolute", inset: 0, overflow: "visible", transform: mirror ? "scaleX(-1)" : "var(--sw-ht-flip, none)", ...style }}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function Locomotive({
  preset,
  paint,
  mirror,
  level,
  showLevel,
  color,
}: {
  preset: HypeTrainWidgetPreset;
  paint: TrainPaint;
  mirror: boolean;
  level: number;
  showLevel: boolean;
  color: string;
}) {
  const { body, accent, dark } = paint;
  // The cab is at the back of the engine; that's where the level plate goes.
  const plateX = preset === "neon" ? 176 : 203;
  // A bouncing train turns round mid-ride, so there the mirror comes from --sw-ht-m (0 or 1) instead.
  const plateLeft = mirror
    ? LOCO_W - plateX - 38
    : `calc(${plateX - 38}px + var(--sw-ht-m, 0) * ${LOCO_W - 2 * plateX}px)`;
  const plateTop = preset === "neon" ? 128 : 118;

  let art: ReactNode;
  if (preset === "neon") {
    art = (
      <>
        <g className="sw-ht-bob">
          <path d="M6,172 C6,122 52,90 112,88 L240,88 Q248,88 248,96 L248,172 Z" fill="#0d0b1a" stroke={body} strokeWidth={3} />
          <path d="M40,114 C58,101 82,97 112,97 L236,97 L236,122 L58,122 Z" fill={body} opacity={0.75} />
          <rect className="sw-ht-glow" x={16} y={150} width={230} height={6} rx={3} fill={accent} />
          <ellipse cx={17} cy={146} rx={7} ry={4} fill="#ffffff" />
          <rect x={6} y={166} width={242} height={10} rx={3} fill={body} />
        </g>
        {[62, 120, 190, 228].map((cx) => (
          <Wheel key={cx} cx={cx} r={11} fill={dark} hub={accent} spokes={false} />
        ))}
      </>
    );
  } else if (preset === "toy") {
    art = (
      <>
        <Puffs x={66} y={46} color="#ffffff" />
        <g className="sw-ht-bob">
          <rect x={52} y={60} width={28} height={44} rx={8} fill="#ef476f" />
          <rect x={46} y={50} width={40} height={16} rx={8} fill="#ef476f" />
          <rect x={22} y={98} width={134} height={58} rx={26} fill={body} />
          <circle cx={30} cy={126} r={9} fill={accent} />
          <rect x={154} y={64} width={86} height={92} rx={14} fill="#06d6a0" />
          <rect x={146} y={50} width={102} height={18} rx={9} fill="#ef476f" />
          <rect x={170} y={80} width={52} height={32} rx={10} fill="#ffffff" />
          <rect x={12} y={150} width={234} height={22} rx={10} fill={accent} />
        </g>
        {[58, 116, 204].map((cx) => (
          <Wheel key={cx} cx={cx} r={20} fill="#ef476f" hub="#ffffff" spokes={false} />
        ))}
      </>
    );
  } else {
    art = (
      <>
        <Puffs x={71} y={36} color="#e9e6f2" />
        <g className="sw-ht-bob">
          <polygon points="4,190 26,158 46,158 46,190" fill={dark} />
          <rect x={24} y={158} width={222} height={14} rx={3} fill={dark} />
          <rect x={34} y={96} width={136} height={64} rx={16} fill={body} />
          <rect x={46} y={104} width={112} height={7} rx={3.5} fill={shade(body, 0.45)} opacity={0.6} />
          <rect x={72} y={96} width={8} height={64} fill={accent} />
          <rect x={132} y={96} width={8} height={64} fill={accent} />
          <rect x={60} y={66} width={22} height={32} fill={dark} />
          <polygon points="50,46 92,46 84,68 58,68" fill={dark} />
          <rect x={47} y={40} width={48} height={9} rx={3} fill={accent} />
          <path d="M104,97 a14,14 0 0 1 28,0 z" fill={accent} />
          <circle cx={34} cy={118} r={10} fill={accent} />
          <circle cx={34} cy={118} r={5} fill="#ffffff" />
          <rect x={164} y={60} width={78} height={100} rx={6} fill={shade(body, -0.22)} />
          <rect x={156} y={47} width={94} height={16} rx={5} fill={dark} />
          <rect x={180} y={74} width={46} height={34} rx={5} fill="#ffe9b0" opacity={0.9} />
        </g>
        <Wheel cx={48} r={14} fill={dark} hub={accent} />
        <Wheel cx={92} r={24} fill={dark} hub={accent} />
        <Wheel cx={146} r={24} fill={dark} hub={accent} />
        <Wheel cx={212} r={18} fill={dark} hub={accent} />
        <rect x={90} y={170} width={58} height={5} rx={2.5} fill={accent} opacity={0.85} />
      </>
    );
  }

  return (
    <div style={{ position: "relative", width: LOCO_W, height: TRAIN_H, flex: "none" }}>
      <CarSvg width={LOCO_W} mirror={mirror} style={preset === "neon" ? { filter: `drop-shadow(0 0 8px ${body})` } : undefined}>
        {art}
      </CarSvg>
      {showLevel ? (
        <div
          style={{
            position: "absolute",
            left: plateLeft,
            top: plateTop,
            width: 76,
            textAlign: "center",
            fontSize: 22,
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: 1,
            color: preset === "neon" ? accent : color,
            textShadow: "0 2px 4px rgba(0,0,0,0.55)",
            whiteSpace: "nowrap",
          }}
        >
          LV {level}
        </div>
      ) : null}
    </div>
  );
}

/** One wagon's body; `width` lets the "+N more" caboose reuse it. */
function WagonArt({ preset, paint, width, index }: { preset: HypeTrainWidgetPreset; paint: TrainPaint; width: number; index: number }) {
  const { body, accent, dark } = paint;
  const w = width;
  if (preset === "neon") {
    return (
      <>
        <g className="sw-ht-bob" style={{ animationDelay: `${-index * 0.13}s` }}>
          <rect x={4} y={90} width={w - 8} height={82} rx={14} fill="#0d0b1a" stroke={body} strokeWidth={3} />
          <rect className="sw-ht-glow" x={14} y={154} width={w - 28} height={5} rx={2.5} fill={accent} />
        </g>
        <Wheel cx={36} r={11} fill={dark} hub={accent} spokes={false} />
        <Wheel cx={w - 36} r={11} fill={dark} hub={accent} spokes={false} />
      </>
    );
  }
  if (preset === "toy") {
    return (
      <>
        <g className="sw-ht-bob" style={{ animationDelay: `${-index * 0.13}s` }}>
          <rect x={8} y={94} width={w - 16} height={64} rx={14} fill={TOY_PALETTE[index % TOY_PALETTE.length]} />
          <rect x={4} y={150} width={w - 8} height={22} rx={10} fill={accent} />
        </g>
        <Wheel cx={42} r={18} fill="#ef476f" hub="#ffffff" spokes={false} />
        <Wheel cx={w - 42} r={18} fill="#ef476f" hub="#ffffff" spokes={false} />
      </>
    );
  }
  return (
    <>
      <g className="sw-ht-bob" style={{ animationDelay: `${-index * 0.13}s` }}>
        <rect x={8} y={160} width={w - 16} height={12} rx={3} fill={dark} />
        <polygon points={`6,98 ${w - 6},98 ${w - 16},164 16,164`} fill={shade(body, -0.12)} />
        <rect x={0} y={91} width={w} height={10} rx={3} fill={accent} />
        <rect x={w / 3 - 2} y={101} width={4} height={60} fill={shade(body, -0.3)} />
        <rect x={(2 * w) / 3 - 2} y={101} width={4} height={60} fill={shade(body, -0.3)} />
      </g>
      <Wheel cx={44} r={17} fill={dark} hub={accent} />
      <Wheel cx={w - 44} r={17} fill={dark} hub={accent} />
    </>
  );
}

const TEXT_SHADOW = "0 2px 4px rgba(0,0,0,0.7)";

export function Wagon({
  preset,
  paint,
  mirror,
  index,
  name,
  amount,
  avatar,
  showAvatar,
  color,
}: {
  preset: HypeTrainWidgetPreset;
  paint: TrainPaint;
  mirror: boolean;
  index: number;
  name: string;
  amount: string;
  avatar: string | null;
  showAvatar: boolean;
  color: string;
}) {
  return (
    <div style={{ position: "relative", width: WAGON_W, height: TRAIN_H, flex: "none" }}>
      {showAvatar ? (
        // Sits behind the wagon's front wall, so the rider pokes out over the rim.
        <div
          style={{
            position: "absolute",
            left: WAGON_W / 2 - 34,
            top: 40,
            width: 68,
            height: 68,
            borderRadius: "50%",
            overflow: "hidden",
            border: `3px solid ${paint.accent}`,
            background: paint.body,
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 30,
            fontWeight: 800,
            color: "#ffffff",
          }}
        >
          {avatar ? (
            <img src={avatar} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            (name.trim()[0] ?? "?").toUpperCase()
          )}
        </div>
      ) : null}
      <CarSvg width={WAGON_W} mirror={mirror}>
        <WagonArt preset={preset} paint={paint} width={WAGON_W} index={index} />
      </CarSvg>
      <div
        style={{
          position: "absolute",
          left: 14,
          right: 14,
          top: showAvatar ? 106 : 100,
          textAlign: "center",
          color,
          textShadow: TEXT_SHADOW,
          lineHeight: 1.1,
        }}
      >
        <div
          style={{
            fontSize: showAvatar ? 20 : 24,
            fontWeight: 800,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {name}
        </div>
        {amount ? (
          // Toy wagons come in every colour, the trim's included, so the amount stays in the text colour there.
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              marginTop: 3,
              color: preset === "toy" ? color : paint.accent,
              opacity: preset === "toy" ? 0.85 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {amount}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Caboose({
  preset,
  paint,
  mirror,
  index,
  more,
  color,
}: {
  preset: HypeTrainWidgetPreset;
  paint: TrainPaint;
  mirror: boolean;
  index: number;
  more: number;
  color: string;
}) {
  return (
    <div style={{ position: "relative", width: CABOOSE_W, height: TRAIN_H, flex: "none" }}>
      <CarSvg width={CABOOSE_W} mirror={mirror}>
        <WagonArt preset={preset} paint={paint} width={CABOOSE_W} index={index} />
      </CarSvg>
      <div
        style={{
          position: "absolute",
          left: 10,
          right: 10,
          top: 104,
          textAlign: "center",
          color,
          textShadow: TEXT_SHADOW,
          lineHeight: 1.05,
          fontWeight: 800,
        }}
      >
        <div style={{ fontSize: 28 }}>+{more}</div>
        <div style={{ fontSize: 14, opacity: 0.85 }}>more</div>
      </div>
    </div>
  );
}

export function Coupler({ color }: { color: string }) {
  return (
    <div style={{ position: "relative", width: COUPLER_W, height: TRAIN_H, flex: "none" }}>
      <div style={{ position: "absolute", left: -6, right: -6, top: 162, height: 6, borderRadius: 3, background: color }} />
    </div>
  );
}

/** Width of a train with this many wagons, in design px. */
export function trainDesignWidth(wagons: number, caboose: boolean): number {
  const cars = wagons + (caboose ? 1 : 0);
  return LOCO_W + wagons * WAGON_W + (caboose ? CABOOSE_W : 0) + cars * COUPLER_W;
}
