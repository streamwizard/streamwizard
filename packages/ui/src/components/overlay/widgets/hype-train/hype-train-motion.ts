/**
 * How the train moves. The bouncing ride, DVD-logo style: the engine drives in a straight line at
 * an angle and bounces off the widget's edges, and every car follows the
 * engine's trail, so the train bends round each bounce like a real one would
 * round a corner. Pure: the renderer owns the clock.
 */

export interface Point {
  x: number;
  y: number;
}

export interface BounceMotion {
  /** Oldest first; the last point is the engine's nose. */
  trail: Point[];
  /** Unit vector. */
  dir: Point;
  /** Whether the nose has been fully inside, per axis. Edges only bounce once it has. */
  inside: { x: boolean; y: boolean };
  /** The way the train is turning towards on each axis, +1 or -1. An edge flips it. */
  want: { x: number; y: number };
  /** Size of the heading on each axis, from the entry angle. The heading turns towards `want` times this. */
  base: { x: number; y: number };
}

export interface BounceBox {
  w: number;
  h: number;
  /** How close the nose gets to a side edge before bouncing. */
  padX: number;
  /** Same for top and bottom; about half the train's height so it stays on screen. */
  padY: number;
  /**
   * How tight a bounce turns, in px. A train can't reflect off a wall on the
   * spot the way a DVD logo does: the wagons behind would fold onto each other.
   */
  turnRadius: number;
}

/** Entry angles, in degrees from horizontal. Shallow enough to read as a train, steep enough to cross the screen. */
const MIN_ANGLE = 18;
const MAX_ANGLE = 38;

/** Starts just off one side edge, heading in at a random angle. `rand` returns [0, 1). */
export function createBounceMotion(box: BounceBox, trainLength: number, rand: () => number = Math.random): BounceMotion {
  const fromLeft = rand() < 0.5;
  const angle = ((MIN_ANGLE + (MAX_ANGLE - MIN_ANGLE) * rand()) * Math.PI) / 180;
  const down = rand() < 0.5 ? 1 : -1;
  const dir = { x: Math.cos(angle) * (fromLeft ? 1 : -1), y: Math.sin(angle) * down };
  const head = {
    x: fromLeft ? -box.padX : box.w + box.padX,
    y: box.padY + (box.h - 2 * box.padY) * (0.2 + 0.6 * rand()),
  };
  const tail = { x: head.x - dir.x * trainLength, y: head.y - dir.y * trainLength };
  return {
    trail: [tail, head],
    dir,
    inside: { x: false, y: false },
    want: { x: Math.sign(dir.x), y: Math.sign(dir.y) },
    base: { x: Math.abs(dir.x), y: Math.abs(dir.y) },
  };
}

/**
 * Straight across instead: starts just off one side at height `y` and never
 * bounces. Stepped with `bouncing` false, it drives straight off the far side.
 */
export function createAcrossMotion(box: BounceBox, trainLength: number, leftToRight: boolean, y: number): BounceMotion {
  const dir = { x: leftToRight ? 1 : -1, y: 0 };
  const head = { x: leftToRight ? -box.padX : box.w + box.padX, y };
  const tail = { x: head.x - dir.x * trainLength, y };
  return {
    trail: [tail, head],
    dir,
    inside: { x: false, y: true },
    want: { x: dir.x, y: 1 },
    base: { x: 1, y: 0 },
  };
}

/**
 * Moves the nose `distance` px. While `bouncing`, an edge turns it round;
 * after that it drives straight off. `keep` is how much trail to hold on to:
 * the train's length.
 */
export function stepBounceMotion(
  m: BounceMotion,
  distance: number,
  box: BounceBox,
  bouncing: boolean,
  keep: number,
): BounceMotion {
  const head = m.trail[m.trail.length - 1]!;
  const minX = box.padX;
  const maxX = Math.max(minX, box.w - box.padX);
  const minY = box.padY;
  const maxY = Math.max(minY, box.h - box.padY);

  // Turn towards where the train wants to go, no faster than the turn radius allows.
  const want = { ...m.want };
  let heading = Math.atan2(m.dir.y, m.dir.x);
  const target = Math.atan2(m.base.y * want.y, m.base.x * want.x);
  let diff = target - heading;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  const maxTurn = distance / Math.max(1, box.turnRadius);
  heading += Math.abs(diff) <= maxTurn ? diff : Math.sign(diff) * maxTurn;
  const dir = { x: Math.cos(heading), y: Math.sin(heading) };

  let x = head.x + dir.x * distance;
  let y = head.y + dir.y * distance;
  const inside = {
    x: m.inside.x || (x >= minX && x <= maxX),
    y: m.inside.y || (y >= minY && y <= maxY),
  };

  if (bouncing && inside.x) {
    // Mid-turn the nose slides along the edge rather than through it.
    if (x <= minX) (x = minX), (want.x = 1);
    else if (x >= maxX) (x = maxX), (want.x = -1);
  }
  if (bouncing && inside.y) {
    if (y <= minY) (y = minY), (want.y = 1);
    else if (y >= maxY) (y = maxY), (want.y = -1);
  }

  return { ...m, trail: trimTrail([...m.trail, { x, y }], keep), dir, inside, want };
}

/** Drops trail points the last car has already passed, keeping at least `keep` px. */
function trimTrail(trail: Point[], keep: number): Point[] {
  let length = 0;
  for (let i = trail.length - 1; i > 0; i--) {
    length += dist(trail[i]!, trail[i - 1]!);
    if (length >= keep) return i - 1 > 0 ? trail.slice(i - 1) : trail;
  }
  return trail;
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Points `distances` px back along the trail from the nose, in the order
 * asked. Any order works: a wagon overtaking another asks for a spot ahead of
 * the car in front of it. Past the end of the trail it carries on in a
 * straight line.
 */
export function pointsAlongTrail(trail: readonly Point[], distances: readonly number[]): Point[] {
  const order = distances.map((d, i) => ({ d, i })).sort((a, b) => a.d - b.d);
  const out: Point[] = new Array(distances.length);
  let i = trail.length - 1;
  let walked = 0;
  for (const { d, i: slot } of order) {
    if (i === 0) {
      out[slot] = { ...trail[0]! };
      continue;
    }
    while (true) {
      const seg = dist(trail[i]!, trail[i - 1]!);
      if (walked + seg >= d || i === 1) {
        const a = trail[i]!;
        const b = trail[i - 1]!;
        const t = seg > 0 ? (d - walked) / seg : 0;
        out[slot] = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        break;
      }
      walked += seg;
      i--;
    }
  }
  return out;
}

export interface CarPlacement {
  x: number;
  y: number;
  /** Radians, applied after the mirror. */
  angle: number;
  /** Heading right: the car is mirrored, since every car is drawn facing left. */
  mirrored: boolean;
}

/** Where a car between `front` and `back` (px behind the nose) sits and how it's turned. */
export function placeCar(front: Point, back: Point): CarPlacement {
  const heading = Math.atan2(front.y - back.y, front.x - back.x);
  const mirrored = front.x >= back.x;
  return {
    x: (front.x + back.x) / 2,
    y: (front.y + back.y) / 2,
    // Facing left, the car's own forward is already half a turn round.
    angle: mirrored ? heading : heading - Math.PI,
    mirrored,
  };
}

/** Whether a point is further than `margin` outside the box. */
export function offBox(p: Point, box: { w: number; h: number }, margin: number): boolean {
  return p.x < -margin || p.x > box.w + margin || p.y < -margin || p.y > box.h + margin;
}

export interface JoinPose {
  opacity: number;
  /** Multiplies the car's size. */
  scale: number;
  /** Design px above the track. */
  lift: number;
  /** Design px further back along the track than the car's own spot. */
  behind: number;
}

export const JOIN_EFFECT_MS: Record<string, number> = { drop: 900, chase: 1200, pop: 550, fade: 500, none: 0 };

const REST: JoinPose = { opacity: 1, scale: 1, lift: 0, behind: 0 };

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function easeOutBack(t: number): number {
  const c = 1.9;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
}

function easeOutBounce(t: number): number {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
}

/** How a new wagon looks `t` (0 to 1) of the way through arriving. */
export function joinPose(effect: string, t: number): JoinPose {
  const p = Math.min(1, Math.max(0, t));
  if (p >= 1) return REST;
  switch (effect) {
    case "drop":
      return { ...REST, lift: (1 - easeOutBounce(p)) * 260, opacity: Math.min(1, p * 5) };
    case "chase": {
      // Catches up from behind and arcs over the wagons it passes on the way to its spot.
      const e = easeOutCubic(p);
      return { ...REST, behind: (1 - e) * 700, lift: Math.sin(Math.PI * e) * 90, opacity: Math.min(1, p * 3) };
    }
    case "pop":
      return { ...REST, scale: Math.max(0, easeOutBack(p)) };
    case "fade":
      return { ...REST, opacity: p };
    default:
      return REST;
  }
}

/**
 * A wagon moving up the ranking hops over the ones it passes: an arc that
 * peaks halfway. `travel` is the whole move forward in design px, `progress`
 * how much of it is done (0 to 1).
 */
export function overtakeLift(travel: number, progress: number): number {
  if (travel <= 0) return 0;
  const p = Math.min(1, Math.max(0, progress));
  return Math.sin(Math.PI * p) * Math.min(90, travel * 0.35);
}
