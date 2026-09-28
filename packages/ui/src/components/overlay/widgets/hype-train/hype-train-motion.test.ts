import { describe, expect, it } from "bun:test";
import {
  createAcrossMotion,
  createBounceMotion,
  joinPose,
  overtakeLift,
  offBox,
  placeCar,
  pointsAlongTrail,
  stepBounceMotion,
  type BounceBox,
  type BounceMotion,
} from "./hype-train-motion";

const BOX: BounceBox = { w: 1000, h: 600, padX: 4, padY: 50, turnRadius: 120 };

/** Fixed "random" values, in call order. */
function seq(...values: number[]) {
  let i = 0;
  return () => values[i++ % values.length]!;
}

function drive(m: BounceMotion, px: number, bouncing: boolean, step = 5) {
  let next = m;
  for (let d = 0; d < px; d += step) next = stepBounceMotion(next, step, BOX, bouncing, 400);
  return next;
}

const head = (m: BounceMotion) => m.trail[m.trail.length - 1]!;

describe("bounce motion", () => {
  it("starts off one side edge, heading in", () => {
    const left = createBounceMotion(BOX, 400, seq(0.1, 0.5, 0.9, 0.5));
    expect(head(left).x).toBeLessThan(0);
    expect(left.dir.x).toBeGreaterThan(0);
    const right = createBounceMotion(BOX, 400, seq(0.9, 0.5, 0.1, 0.5));
    expect(head(right).x).toBeGreaterThan(BOX.w);
    expect(right.dir.x).toBeLessThan(0);
  });

  it("stays inside the box while bouncing", () => {
    let m = createBounceMotion(BOX, 400, seq(0.2, 0.7, 0.3, 0.4));
    m = drive(m, 300, true);
    for (let i = 0; i < 2000; i++) {
      m = stepBounceMotion(m, 7, BOX, true, 400);
      const h = head(m);
      expect(h.x).toBeGreaterThanOrEqual(BOX.padX - 0.001);
      expect(h.x).toBeLessThanOrEqual(BOX.w - BOX.padX + 0.001);
      expect(h.y).toBeGreaterThanOrEqual(BOX.padY - 0.001);
      expect(h.y).toBeLessThanOrEqual(BOX.h - BOX.padY + 0.001);
    }
  });

  it("drives off once bouncing stops", () => {
    let m = drive(createBounceMotion(BOX, 400, seq(0.2, 0.7, 0.3, 0.4)), 800, true);
    m = drive(m, 3000, false);
    expect(offBox(head(m), BOX, 100)).toBe(true);
  });

  it("turns round gradually, not on the spot", () => {
    let m = drive(createBounceMotion(BOX, 400, seq(0.2, 0.7, 0.3, 0.4)), 300, true);
    let prev = Math.atan2(m.dir.y, m.dir.x);
    for (let i = 0; i < 2000; i++) {
      m = stepBounceMotion(m, 7, BOX, true, 400);
      const now = Math.atan2(m.dir.y, m.dir.x);
      let turn = Math.abs(now - prev);
      if (turn > Math.PI) turn = 2 * Math.PI - turn;
      expect(turn).toBeLessThanOrEqual(7 / 120 + 1e-9);
      prev = now;
    }
  });

  it("keeps only as much trail as the train needs", () => {
    const m = drive(createBounceMotion(BOX, 400, seq(0.2, 0.7, 0.3, 0.4)), 5000, true);
    expect(m.trail.length).toBeLessThan(120);
  });

  it("finds points back along the trail and past its end", () => {
    const trail = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
    expect(pointsAlongTrail(trail, [0, 50, 150, 250])).toEqual([
      { x: 100, y: 100 },
      { x: 100, y: 50 },
      { x: 50, y: 0 },
      { x: -50, y: 0 },
    ]);
  });

  it("answers in the order asked, not just ascending", () => {
    const trail = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
    expect(pointsAlongTrail(trail, [150, 0, 50])).toEqual([
      { x: 50, y: 0 },
      { x: 100, y: 100 },
      { x: 100, y: 50 },
    ]);
  });

  it("mirrors cars heading right and keeps them upright", () => {
    const right = placeCar({ x: 100, y: 0 }, { x: 0, y: 0 });
    expect(right).toEqual({ x: 50, y: 0, angle: 0, mirrored: true });
    const left = placeCar({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(left.mirrored).toBe(false);
    expect(Math.abs(left.angle)).toBeCloseTo(0);
  });

  it("across drives straight over at its own height", () => {
    let m = createAcrossMotion(BOX, 400, true, 500);
    expect(head(m).x).toBeLessThan(0);
    m = drive(m, 1500, false);
    expect(head(m).y).toBe(500);
    expect(head(m).x).toBeGreaterThan(BOX.w);
  });
});

describe("join effects", () => {
  it("every effect starts hidden or away and ends at rest", () => {
    for (const effect of ["drop", "chase", "pop", "fade"]) {
      const start = joinPose(effect, 0);
      expect(start.opacity === 0 || start.scale === 0 || start.lift > 0 || start.behind > 0).toBe(true);
      expect(joinPose(effect, 1)).toEqual({ opacity: 1, scale: 1, lift: 0, behind: 0 });
    }
  });

  it("none is always at rest", () => {
    expect(joinPose("none", 0)).toEqual({ opacity: 1, scale: 1, lift: 0, behind: 0 });
  });

  it("drop falls towards the track", () => {
    expect(joinPose("drop", 0).lift).toBeGreaterThan(joinPose("drop", 0.3).lift);
  });
});

describe("overtaking hop", () => {
  it("arcs up and back down, only when moving forward", () => {
    expect(overtakeLift(400, 0)).toBe(0);
    expect(overtakeLift(400, 0.5)).toBeCloseTo(90);
    expect(overtakeLift(400, 1)).toBeCloseTo(0);
    expect(overtakeLift(-400, 0.5)).toBe(0);
  });
});
