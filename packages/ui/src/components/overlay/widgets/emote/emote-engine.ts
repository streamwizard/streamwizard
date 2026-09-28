import type { EmoteAnimation } from "./emote-widget-config";

/**
 * The emote widget's particle engine. No DOM, no React: the renderer calls
 * `step` once per animation frame and draws whatever `frameOf` returns.
 *
 * Every style is a closed-form function of the particle's start values and its
 * age, so a particle never carries velocity state from frame to frame. That
 * keeps a dropped frame or a resized scene from knocking anything off course,
 * and it makes each style testable with plain numbers.
 */

export interface EmoteParticle {
  id: number;
  url: string;
  style: EmoteAnimation;
  /** Drawn width and height at scale 1, in px. */
  size: number;
  /** Seconds since spawn. */
  age: number;
  /** Seconds on screen. */
  life: number;
  /** Start point or origin, as 0–1 of the scene so a resize keeps the layout. */
  ox: number;
  oy: number;
  /** Direction in radians, for styles that fly outwards. */
  angle: number;
  /** 0–1 spread of speed or distance, so a burst doesn't move as one block. */
  speed: number;
  /** Radians per second. 0 under reduced motion. */
  spin: number;
  /** Random phase for wobbles, so neighbours don't sway in step. */
  phase: number;
  /** -1 or 1: which way a slide or bounce starts. */
  side: -1 | 1;
}

/** Where and how to draw one particle this frame. */
export interface EmoteFrame {
  x: number;
  y: number;
  scale: number;
  alpha: number;
  rotation: number;
}

export interface SpawnOptions {
  size: number;
  /** ms on screen. */
  duration: number;
  /**
   * Shared origin for the whole batch (0–1 of the scene). Explosion, fireworks
   * and spiral fly out from it. Omitted picks one per batch.
   */
  origin?: { x: number; y: number };
  /** Drops spin, and the renderer spawns fewer emotes. */
  reducedMotion?: boolean;
}

export interface EmoteEngine {
  readonly particles: readonly EmoteParticle[];
  /** One emote per entry of `urls`, round-robin until `count` are out. */
  spawn(urls: readonly string[], style: EmoteAnimation, count: number, opts: SpawnOptions): void;
  /** Ages every particle and drops the finished ones. */
  step(dt: number): void;
  setMax(max: number): void;
  clear(): void;
}

export type Rng = () => number;

/** Longest step one frame may take, so a backgrounded tab doesn't jump to the end. */
const MAX_STEP = 0.1;

const TAU = Math.PI * 2;

export function createEmoteEngine({ max = 150, rng = Math.random }: { max?: number; rng?: Rng } = {}): EmoteEngine {
  let particles: EmoteParticle[] = [];
  let cap = max;
  let nextId = 1;

  const trim = () => {
    // Oldest first, so the newest emotes always get their full run.
    if (particles.length > cap) particles = particles.slice(particles.length - cap);
  };

  return {
    get particles() {
      return particles;
    },
    spawn(urls, style, count, opts) {
      if (urls.length === 0 || count <= 0) return;
      const origin = opts.origin ?? batchOrigin(style, rng);
      const life = opts.duration / 1000;
      for (let i = 0; i < count; i++) {
        particles.push({
          id: nextId++,
          url: urls[i % urls.length]!,
          style,
          size: opts.size * (0.85 + rng() * 0.3),
          age: 0,
          // A little spread so a burst doesn't all vanish on the same frame.
          life: life * (0.85 + rng() * 0.3),
          ...startPoint(style, origin, rng),
          angle: rng() * TAU,
          speed: 0.5 + rng() * 0.5,
          spin: opts.reducedMotion ? 0 : (rng() - 0.5) * 4,
          phase: rng() * TAU,
          side: rng() < 0.5 ? -1 : 1,
        });
      }
      trim();
    },
    step(dt) {
      const d = Math.min(MAX_STEP, Math.max(0, dt));
      let alive = 0;
      for (const p of particles) {
        p.age += d;
        if (p.age < p.life) particles[alive++] = p;
      }
      particles.length = alive;
    },
    setMax(next) {
      cap = Math.max(1, next);
      trim();
    },
    clear() {
      particles = [];
    },
  };
}

/** Where a batch flies out from. Bursts start near the middle, never on an edge. */
function batchOrigin(style: EmoteAnimation, rng: Rng): { x: number; y: number } {
  switch (style) {
    case "explosion":
    case "spiral":
      return { x: 0.25 + rng() * 0.5, y: 0.3 + rng() * 0.4 };
    case "fireworks":
      // x is the launch column, y the height the rocket pops at.
      return { x: 0.15 + rng() * 0.7, y: 0.15 + rng() * 0.3 };
    default:
      return { x: rng(), y: rng() };
  }
}

/** Per-particle start. Styles that share the batch origin keep it as is. */
function startPoint(
  style: EmoteAnimation,
  origin: { x: number; y: number },
  rng: Rng,
): { ox: number; oy: number } {
  switch (style) {
    case "explosion":
    case "fireworks":
    case "spiral":
      return { ox: origin.x, oy: origin.y };
    case "float_up":
    case "rain":
      return { ox: 0.03 + rng() * 0.94, oy: 0 };
    case "slide_side":
      return { ox: 0, oy: 0.08 + rng() * 0.84 };
    default:
      return { ox: 0.05 + rng() * 0.9, oy: 0.05 + rng() * 0.9 };
  }
}

// ─── Motion ─────────────────────────────────────────────────────────────────

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeOutBack = (t: number) => {
  const c = 1.70158;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};

/** Fades in over the first `inEnd` and out from `outStart`, both as 0–1 of life. */
function fade(u: number, inEnd: number, outStart: number): number {
  const fadeIn = inEnd > 0 ? clamp01(u / inEnd) : 1;
  const fadeOut = outStart < 1 ? clamp01((1 - u) / (1 - outStart)) : 1;
  return Math.min(fadeIn, fadeOut);
}

/** Bounces a position between 0 and `span`, as a ball off two walls. */
function reflect(pos: number, span: number): number {
  if (span <= 0) return 0;
  const period = span * 2;
  const m = ((pos % period) + period) % period;
  return m <= span ? m : period - m;
}

/**
 * Where a particle sits at its current age, in scene px. `x`/`y` are the
 * emote's centre. Pure: same particle, same age, same scene, same answer.
 */
export function frameOf(p: EmoteParticle, width: number, height: number): EmoteFrame {
  const u = clamp01(p.age / p.life);
  const s = p.age;
  const half = p.size / 2;

  switch (p.style) {
    case "float_up": {
      const travel = height + p.size;
      return {
        x: p.ox * width + Math.sin(s * 2 + p.phase) * p.size * 0.4,
        y: height + half - travel * u,
        scale: 1,
        alpha: fade(u, 0.05, 0.8),
        rotation: Math.sin(s * 1.5 + p.phase) * 0.2,
      };
    }

    case "rain": {
      // Speeds up as it falls, and lands just past the bottom edge at the end.
      const travel = height + p.size;
      return {
        x: p.ox * width + Math.sin(s + p.phase) * p.size * 0.15,
        y: -half + travel * (0.3 * u + 0.7 * u * u),
        scale: 1,
        alpha: fade(u, 0.02, 0.95),
        rotation: p.spin * s,
      };
    }

    case "bounce": {
      const pace = (width + height) * 0.25 * (0.6 + p.speed * 0.8);
      return {
        x: half + reflect(p.ox * (width - p.size) + Math.cos(p.angle) * pace * s, width - p.size),
        y: half + reflect(p.oy * (height - p.size) + Math.sin(p.angle) * pace * s, height - p.size),
        scale: 1,
        alpha: fade(u, 0.05, 0.85),
        rotation: p.spin * 0.5 * s,
      };
    }

    case "explosion": {
      // Fast out, slowed by drag, with a little gravity pulling it down.
      const reach = Math.hypot(width, height) * 0.3 * p.speed;
      const drag = 1 - Math.exp(-4 * u);
      return {
        x: p.ox * width + Math.cos(p.angle) * reach * drag,
        y: p.oy * height + Math.sin(p.angle) * reach * drag + height * 0.15 * u * u,
        scale: easeOutBack(clamp01(u / 0.12)),
        alpha: fade(u, 0, 0.6),
        rotation: p.spin * s,
      };
    }

    case "fireworks": {
      // Rises together as one rocket, then pops outwards and droops.
      const launch = 0.3;
      const apexX = p.ox * width;
      const apexY = p.oy * height;
      if (u < launch) {
        const t = easeOutCubic(u / launch);
        return {
          x: apexX,
          y: height + half - (height + half - apexY) * t,
          scale: 0.6,
          alpha: 1,
          rotation: 0,
        };
      }
      const t = (u - launch) / (1 - launch);
      const reach = Math.min(width, height) * 0.3 * p.speed;
      return {
        x: apexX + Math.cos(p.angle) * reach * easeOutCubic(t),
        y: apexY + Math.sin(p.angle) * reach * easeOutCubic(t) + height * 0.15 * t * t,
        scale: 0.6 + 0.4 * easeOutBack(clamp01(t / 0.2)),
        alpha: fade(t, 0, 0.5),
        rotation: p.spin * 0.5 * t,
      };
    }

    case "spiral": {
      const turns = 1.25 + p.speed;
      const theta = p.angle + turns * TAU * u;
      const radius = Math.min(width, height) * 0.7 * u * (0.6 + p.speed * 0.4);
      return {
        x: p.ox * width + Math.cos(theta) * radius,
        y: p.oy * height + Math.sin(theta) * radius,
        scale: 0.4 + 0.8 * u,
        alpha: fade(u, 0.05, 0.75),
        rotation: p.spin === 0 ? 0 : theta,
      };
    }

    case "zoom": {
      // Pops in, holds, then grows while it fades.
      const scale = u < 0.15 ? 1.6 * easeOutBack(u / 0.15) : u < 0.7 ? 1.6 : 1.6 + 1.4 * ((u - 0.7) / 0.3);
      return {
        x: p.ox * width,
        y: p.oy * height,
        scale: Math.max(0, scale),
        alpha: fade(u, 0, 0.7),
        rotation: Math.sin(s * 2 + p.phase) * (p.spin === 0 ? 0 : 0.15),
      };
    }

    case "slide_side": {
      const travel = width + p.size;
      const along = -half + travel * u;
      return {
        x: p.side === 1 ? along : width - along,
        y: p.oy * height + Math.sin(s * 3 + p.phase) * p.size * 0.2,
        scale: 1,
        alpha: fade(u, 0.03, 0.97),
        rotation: Math.sin(s * 3 + p.phase) * 0.1,
      };
    }
  }
}
