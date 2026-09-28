"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createLiquidSim, type LiquidSim } from "../liquid-sim";
import { FitText, GoalIcon, capRadius, hexToRgba, textStyle, type GoalPresetProps } from "./shared";

/** True when the machine asks for less motion; the water then sits still. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

interface Paint {
  fill: string;
  top: string;
  gradient: boolean;
}

/** Draws one frame: the body with its moving surface, a light rim, the stream, and the spray. */
function draw(ctx: CanvasRenderingContext2D, sim: LiquidSim, w: number, h: number, paint: Paint) {
  ctx.clearRect(0, 0, w, h);
  const pts = sim.surface();
  const stepX = w / (pts.length - 1);
  const highest = Math.min(...pts);

  if (sim.level() > 0 || pts.some((y) => y < h)) {
    const surfacePath = new Path2D();
    surfacePath.moveTo(0, pts[0]!);
    for (let i = 1; i < pts.length; i++) {
      // Through the midpoints, so the columns read as one smooth surface.
      const x0 = (i - 1) * stepX;
      const x1 = i * stepX;
      surfacePath.quadraticCurveTo(x0, pts[i - 1]!, (x0 + x1) / 2, (pts[i - 1]! + pts[i]!) / 2);
    }
    surfacePath.lineTo(w, pts[pts.length - 1]!);

    const body = new Path2D(surfacePath);
    body.lineTo(w, h);
    body.lineTo(0, h);
    body.closePath();
    if (paint.gradient) {
      const g = ctx.createLinearGradient(0, h, 0, Math.min(h - 1, highest));
      g.addColorStop(0, paint.fill);
      g.addColorStop(1, paint.top);
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = paint.fill;
    }
    ctx.fill(body);

    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke(surfacePath);
  }

  const stream = sim.stream();
  ctx.fillStyle = paint.top;
  if (stream && stream.bottom > stream.top) {
    // A slight wobble, so the stream reads as water rather than a bar.
    const wobble = Math.sin(performance.now() / 90) * stream.width * 0.08;
    const x = stream.x - stream.width / 2 + wobble;
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.roundRect(x, stream.top, stream.width, stream.bottom - stream.top + 2, stream.width / 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  for (const d of sim.droplets()) {
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * A card that fills with water from the bottom. The surface is a small
 * physics sim (see liquid-sim.ts): it never loops, and progress pours in from
 * a tap above the card. The numbers float on top.
 */
export function GoalLiquid({ view, cfg, celebrating }: GoalPresetProps) {
  // No title set here or on Twitch: show none rather than a made-up one.
  const showTitle = cfg.showTitle && view.title !== "";
  const radius = capRadius(cfg.radius, 1000);
  const big = Math.round(cfg.fontSize * 2);
  const reduced = usePrefersReducedMotion();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<LiquidSim | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const paintRef = useRef<Paint>({ fill: cfg.fillColor, top: cfg.fillColor, gradient: false });
  paintRef.current = {
    fill: cfg.fillColor,
    top: cfg.fillMode === "gradient" ? cfg.fillColor2 : cfg.fillColor,
    gradient: cfg.fillMode === "gradient",
  };
  const lastRef = useRef<{ goalId: string; progress: number } | null>(null);
  const redrawRef = useRef<() => void>(() => {});

  // Canvas sizing: sharp on any display, following the card's box.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fit = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      if (!simRef.current) simRef.current = createLiquidSim(w, h);
      else simRef.current.resize(w, h);
      redrawRef.current();
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // The level follows the goal: a rise pours, a drop drains, and a new goal
  // or the first paint just starts there (a refresh isn't progress).
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    const prev = lastRef.current;
    const animate = !reduced && prev !== null && prev.goalId === view.goalId;
    sim.setTarget(view.progress, animate);
    lastRef.current = { goalId: view.goalId, progress: view.progress };
    redrawRef.current();
  }, [view.goalId, view.progress, reduced]);

  // Reaching the goal sloshes the whole surface.
  const celebrationKey = celebrating?.key ?? 0;
  useEffect(() => {
    if (celebrationKey > 0 && !reduced) simRef.current?.slosh(1.5);
  }, [celebrationKey, reduced]);

  // The frame loop. Reduced motion draws on changes only.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const paintFrame = () => {
      const sim = simRef.current;
      if (sim) draw(ctx, sim, sizeRef.current.w, sizeRef.current.h, paintRef.current);
    };
    redrawRef.current = paintFrame;
    paintFrame();
    if (reduced) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      simRef.current?.step((now - last) / 1000);
      last = now;
      paintFrame();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  // Colours changed in the editor: repaint even when the water is still.
  useEffect(() => {
    redrawRef.current();
  }, [cfg.fillColor, cfg.fillColor2, cfg.fillMode]);

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={view.target}
      aria-valuenow={view.current}
      aria-label={view.label}
      style={{
        ...textStyle(cfg),
        position: "relative",
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        borderRadius: radius,
        background: hexToRgba(cfg.trackColor, cfg.trackOpacity),
        overflow: "hidden",
        isolation: "isolate",
      }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", zIndex: -1 }}
      />
      <div
        style={{
          position: "relative",
          height: "100%",
          boxSizing: "border-box",
          padding: Math.round(cfg.fontSize * 0.8),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: Math.round(cfg.fontSize * 0.25),
        }}
      >
        {(showTitle || cfg.showIcon) && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, maxWidth: "100%" }}>
            {cfg.showIcon && <GoalIcon kind={view.icon} url={cfg.iconUrl} size={cfg.fontSize} color={cfg.textColor} />}
            {showTitle && (
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{view.title}</span>
            )}
          </div>
        )}
        {cfg.showNumbers && (
          <FitText align="center" style={{ width: "100%", fontSize: big, fontWeight: 700, lineHeight: 1 }}>
            {view.currentText}
            <span style={{ fontSize: Math.round(big * 0.45), fontWeight: cfg.fontWeight, opacity: 0.85 }}>
              {" "}/ {view.targetText} {view.unit}
            </span>
          </FitText>
        )}
        {(cfg.showPercent || cfg.showRemaining) && (
          <FitText align="center" style={{ width: "100%", fontSize: Math.round(cfg.fontSize * 0.72), opacity: 0.9 }}>
            {[cfg.showPercent ? view.percentText : "", cfg.showRemaining ? view.remainingText : ""]
              .filter(Boolean)
              .join(" · ")}
          </FitText>
        )}
      </div>
    </div>
  );
}
