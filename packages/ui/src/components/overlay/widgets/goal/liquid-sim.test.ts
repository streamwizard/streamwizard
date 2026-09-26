import { describe, expect, it } from "bun:test";
import { createLiquidSim } from "./liquid-sim";

/** A repeatable random, so the tests don't depend on luck. */
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function run(sim: ReturnType<typeof createLiquidSim>, seconds: number) {
  for (let t = 0; t < seconds; t += 1 / 60) sim.step(1 / 60);
}

describe("liquid sim", () => {
  it("snaps to a level without pouring", () => {
    const sim = createLiquidSim(360, 200, seeded());
    sim.setTarget(0.4, false);
    expect(sim.level()).toBe(0.4);
    expect(sim.stream()).toBeNull();
  });

  it("pours exactly up to the new level, then closes the tap", () => {
    const sim = createLiquidSim(360, 200, seeded());
    sim.setTarget(0.2, false);
    sim.setTarget(0.5, true);
    expect(sim.stream()).not.toBeNull();
    // Nothing has landed yet: the stream is still falling.
    sim.step(1 / 60);
    expect(sim.level()).toBeCloseTo(0.2, 5);
    run(sim, 6);
    expect(sim.level()).toBeCloseTo(0.5, 6);
    expect(sim.stream()).toBeNull();
  });

  it("pours longer for bigger jumps", () => {
    const pourTime = (to: number) => {
      const sim = createLiquidSim(360, 200, seeded());
      sim.setTarget(0, false);
      sim.setTarget(to, true);
      let t = 0;
      while (sim.level() < to - 1e-6 && t < 10) {
        sim.step(1 / 60);
        t += 1 / 60;
      }
      return t;
    };
    expect(pourTime(0.6)).toBeGreaterThan(pourTime(0.05) + 1);
  });

  it("stacks a second pour onto one still running", () => {
    const sim = createLiquidSim(360, 200, seeded());
    sim.setTarget(0.1, false);
    sim.setTarget(0.3, true);
    run(sim, 0.3);
    sim.setTarget(0.4, true);
    run(sim, 8);
    expect(sim.level()).toBeCloseTo(0.4, 6);
  });

  it("drains when the number goes down", () => {
    const sim = createLiquidSim(360, 200, seeded());
    sim.setTarget(0.8, false);
    sim.setTarget(0.5, true);
    expect(sim.stream()).toBeNull();
    run(sim, 3);
    expect(sim.level()).toBeCloseTo(0.5, 6);
  });

  it("calms back down after a slosh", () => {
    const sim = createLiquidSim(360, 200, seeded());
    sim.setTarget(0.5, false);
    sim.slosh(2);
    run(sim, 0.2);
    const wild = Math.max(...sim.surface().map((y) => Math.abs(y - 100)));
    run(sim, 12);
    const calm = Math.max(...sim.surface().map((y) => Math.abs(y - 100)));
    expect(calm).toBeLessThan(wild / 3);
  });

  it("stays finite over a long run with stalls", () => {
    const sim = createLiquidSim(360, 200, seeded());
    sim.setTarget(0.3, false);
    for (let i = 0; i < 200; i++) {
      if (i % 20 === 0) sim.setTarget(0.3 + (i % 60) / 200, true);
      // Irregular frames, including a few long stalls.
      sim.step(i % 50 === 0 ? 5 : 1 / 30);
    }
    for (const y of sim.surface()) expect(Number.isFinite(y)).toBe(true);
    expect(sim.droplets().length).toBeLessThanOrEqual(150);
  });

  it("empty water stays still", () => {
    const sim = createLiquidSim(360, 200, seeded());
    sim.setTarget(0, false);
    run(sim, 2);
    expect(sim.settled()).toBe(true);
  });
});
