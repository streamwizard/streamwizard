/**
 * The water in the Liquid goal design, as a small physics simulation.
 *
 * The surface is a row of columns joined by springs: each is pulled back to
 * the water level, passes some of its motion to its neighbours, and loses a
 * little every step. A hit in one place sends ripples out that bounce off the
 * walls and die down, and small random nudges keep it moving while idle
 * without ever looping.
 *
 * Progress pours in from a tap above the card: the stream falls, and only the
 * water that has landed raises the level, so a bigger jump means a longer
 * pour. Everything is in CSS pixels of the card; no DOM in here.
 */

export interface LiquidDroplet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

export interface LiquidStream {
  x: number;
  width: number;
  /** Top of the falling water; 0 while the tap is open. */
  top: number;
  /** Leading edge; it stops at the surface once it lands. */
  bottom: number;
}

export interface LiquidSim {
  resize(width: number, height: number): void;
  /**
   * Where the water should end up, 0–1. Up pours from the tap (`animate`),
   * down drains, and `animate: false` snaps straight there (first paint, a new
   * goal, reduced motion).
   */
  setTarget(level: number, animate: boolean): void;
  /** A sideways slosh across the whole surface, e.g. when the goal is reached. */
  slosh(strength?: number): void;
  /** Advances by `dt` seconds (capped, and split into fixed steps inside). */
  step(dt: number): void;
  /** The surface's y per column, left to right, in px from the top. */
  surface(): number[];
  level(): number;
  stream(): LiquidStream | null;
  droplets(): readonly LiquidDroplet[];
  /** True while anything is still moving enough to be worth drawing. */
  settled(): boolean;
}

const COLUMNS = 48;
const FIXED_DT = 1 / 60;
/** At most this much time is simulated per call, so a stalled tab can't explode it. */
const MAX_STEP = 0.1;

const TENSION = 0.025;
const DAMPING = 0.028;
const SPREAD = 0.24;
const SPREAD_PASSES = 4;

/** Chance per step of an idle nudge, and its size relative to a 200px card. */
const IDLE_CHANCE = 0.06;
const IDLE_KICK = 1.8;

/**
 * The resting swell: two long waves whose speed and size wander at random,
 * drawn on top of the springs. The springs damp small nudges fast; this is
 * what keeps calm water visibly alive. Height in px for a 200px card.
 */
const SWELL_HEIGHT = 2.6;

const GRAVITY = 1400;
/** How fast the level sinks when the number drops, in levels per second. */
const DRAIN_RATE = 0.25;
const MAX_DROPLETS = 150;

export function createLiquidSim(width: number, height: number, random: () => number = Math.random): LiquidSim {
  let w = width;
  let h = height;
  const heights = new Float64Array(COLUMNS);
  const speeds = new Float64Array(COLUMNS);
  const left = new Float64Array(COLUMNS);
  const right = new Float64Array(COLUMNS);
  let level = 0;
  let target = 0;
  let accumulator = 0;

  // The pour: how much is still to come out of the tap, how fast, and the
  // stream's falling ends.
  let pending = 0;
  let rate = 0;
  let stream: LiquidStream | null = null;
  let headVy = 0;
  let tailVy = 0;
  let tapOpen = false;
  let landed = false;
  const drops: LiquidDroplet[] = [];

  // Swell: per wave a phase, a drifting speed, and a drifting size.
  const swell = [
    { k: 1.7, phase: random() * 6.28, speed: 0.6, amp: 0.7 },
    { k: 3.3, phase: random() * 6.28, speed: -0.9, amp: 0.4 },
  ];

  const scale = () => Math.max(0.5, h / 200);
  const baseY = () => h * (1 - level);
  const columnAt = (x: number) => Math.max(0, Math.min(COLUMNS - 1, Math.round((x / Math.max(1, w)) * (COLUMNS - 1))));
  const surfaceAt = (x: number) => baseY() - heights[columnAt(x)]!;

  function kick(col: number, amount: number) {
    if (col < 0 || col >= COLUMNS) return;
    speeds[col]! += amount;
  }

  function openTap(amount: number) {
    pending += amount;
    // Bigger jumps pour longer: a single follow is a short splash, a big
    // cheer runs for a couple of seconds.
    const seconds = Math.min(3, 0.6 + amount * 6);
    rate = Math.max(rate, pending / seconds);
    if (!stream || !tapOpen) {
      const width = Math.min(14, 4 + amount * 40) * scale();
      stream = { x: w * (0.2 + random() * 0.6), width, top: 0, bottom: 0 };
      headVy = 120;
      tailVy = 0;
      landed = false;
    } else {
      stream.width = Math.min(14 * scale(), Math.max(stream.width, (4 + amount * 40) * scale()));
    }
    tapOpen = true;
  }

  function stepOnce(dt: number) {
    const s = scale();

    // Springs back to the level, then the ripple spreading between columns.
    for (let i = 0; i < COLUMNS; i++) {
      speeds[i]! += -TENSION * heights[i]! - DAMPING * speeds[i]!;
      heights[i]! += speeds[i]!;
    }
    for (let pass = 0; pass < SPREAD_PASSES; pass++) {
      for (let i = 0; i < COLUMNS; i++) {
        if (i > 0) {
          left[i] = SPREAD * (heights[i]! - heights[i - 1]!);
          speeds[i - 1]! += left[i]!;
        }
        if (i < COLUMNS - 1) {
          right[i] = SPREAD * (heights[i]! - heights[i + 1]!);
          speeds[i + 1]! += right[i]!;
        }
      }
      for (let i = 0; i < COLUMNS; i++) {
        if (i > 0) heights[i - 1]! += left[i]!;
        if (i < COLUMNS - 1) heights[i + 1]! += right[i]!;
      }
    }

    // Swell drift: speeds and sizes random-walk inside a band, so the calm
    // motion never settles into a pattern.
    for (const wave of swell) {
      wave.speed = Math.max(-1.6, Math.min(1.6, wave.speed + (random() - 0.5) * 0.08));
      wave.amp = Math.max(0.25, Math.min(1, wave.amp + (random() - 0.5) * 0.03));
      wave.phase += wave.speed * dt;
    }

    // Idle: small nudges at random places and times, so it never loops.
    if (level > 0 && random() < IDLE_CHANCE) {
      kick(Math.floor(random() * COLUMNS), (random() - 0.5) * IDLE_KICK * s);
    }

    // The stream: its head falls to the surface, the water that lands raises
    // the level and pushes the surface down, and once the tap closes its tail
    // falls after it.
    if (stream) {
      const surfaceY = surfaceAt(stream.x);
      if (!landed) {
        headVy += GRAVITY * dt;
        stream.bottom += headVy * dt;
        if (stream.bottom >= surfaceY) {
          stream.bottom = surfaceY;
          landed = true;
          kick(columnAt(stream.x), -6 * s);
        }
      } else {
        stream.bottom = surfaceY;
      }

      if (landed && pending > 0) {
        const pour = Math.min(pending, rate * dt);
        pending -= pour;
        level = Math.min(1, level + pour);
        target = Math.max(target, level);
        // A steady push down under the stream, and spray.
        const col = columnAt(stream.x);
        kick(col, -0.9 * s);
        kick(col - 1, -0.45 * s);
        kick(col + 1, -0.45 * s);
        if (drops.length < MAX_DROPLETS && random() < 0.7) {
          drops.push({
            x: stream.x + (random() - 0.5) * stream.width,
            y: surfaceY,
            vx: (random() - 0.5) * 220 * s,
            vy: -(120 + random() * 220) * s,
            r: (1 + random() * 1.8) * s,
          });
        }
      }
      if (pending <= 1e-6 && tapOpen) {
        pending = 0;
        tapOpen = false;
        rate = 0;
      }
      if (!tapOpen) {
        tailVy += GRAVITY * dt;
        stream.top += tailVy * dt;
        if (stream.top >= stream.bottom) {
          stream = null;
        }
      }
    }

    // Draining: no tap, the level just sinks.
    if (!stream && pending === 0 && level > target) {
      level = Math.max(target, level - DRAIN_RATE * dt);
    }

    // Droplets fly, fall, and ripple the surface where they land.
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i]!;
      d.vy += GRAVITY * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.x < 0 || d.x > w) d.vx = -d.vx;
      if (d.vy > 0 && d.y >= surfaceAt(d.x)) {
        kick(columnAt(d.x), -0.35 * s);
        drops.splice(i, 1);
      }
    }
  }

  return {
    resize(width, height) {
      w = width;
      h = height;
    },

    setTarget(next, animate) {
      const clamped = Math.min(1, Math.max(0, next));
      if (!animate) {
        level = clamped;
        target = clamped;
        pending = 0;
        rate = 0;
        stream = null;
        tapOpen = false;
        drops.length = 0;
        return;
      }
      const coming = level + pending;
      if (clamped > coming + 1e-6) {
        target = clamped;
        openTap(clamped - coming);
      } else if (clamped < level) {
        // The number went down: stop pouring and let it drain.
        target = clamped;
        pending = 0;
        tapOpen = false;
      }
    },

    slosh(strength = 1) {
      const s = scale() * strength;
      for (let i = 0; i < COLUMNS; i++) {
        speeds[i]! += (i / (COLUMNS - 1) - 0.5) * 7 * s;
      }
    },

    step(dt) {
      accumulator += Math.min(MAX_STEP, Math.max(0, dt));
      while (accumulator >= FIXED_DT) {
        stepOnce(FIXED_DT);
        accumulator -= FIXED_DT;
      }
    },

    surface() {
      const y = baseY();
      // The swell fades out near empty and full, so it never pokes past the card.
      const room = Math.min(level, 1 - level) * h;
      const swellPx = level > 0 ? Math.min(SWELL_HEIGHT * scale(), room) : 0;
      return Array.from(heights, (height, i) => {
        const x = i / (COLUMNS - 1);
        let wave = 0;
        for (const s of swell) wave += Math.sin(x * Math.PI * s.k + s.phase) * s.amp;
        return y - height - wave * swellPx;
      });
    },

    level: () => level,
    stream: () => stream,
    droplets: () => drops,

    settled() {
      if (stream || drops.length > 0 || pending > 0 || level !== target) return false;
      for (let i = 0; i < COLUMNS; i++) {
        if (Math.abs(heights[i]!) > 0.05 || Math.abs(speeds[i]!) > 0.05) return false;
      }
      return true;
    },
  };
}
