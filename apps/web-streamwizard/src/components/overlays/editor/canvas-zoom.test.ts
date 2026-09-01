import { expect, test } from "bun:test";
import {
  ZOOM_MAX,
  ZOOM_MIN,
  clampZoom,
  computeFitZoom,
  focalPanCorrection,
  wheelZoom,
} from "./canvas-zoom";

const scene = { width: 1920, height: 1080 };

test("zoom clamps to the editor's range", () => {
  expect(clampZoom(5)).toBe(ZOOM_MAX);
  expect(clampZoom(0.01)).toBe(ZOOM_MIN);
  expect(clampZoom(0.75)).toBe(0.75);
  expect(clampZoom(Number.NaN)).toBe(1);
});

test("fit takes the tighter axis so nothing is cropped", () => {
  // A wide, short pane: height is the constraint.
  const zoom = computeFitZoom({ width: 4000, height: 620 }, scene, 0.5, 10);
  expect(zoom).toBeCloseTo(600 / 1080, 5);
});

test("fit leaves the margin free on both sides", () => {
  const zoom = computeFitZoom({ width: 1984, height: 4000 }, scene, 0.5, 32);
  // 1984 - 64 = 1920, so the scene lands at exactly 100%.
  expect(zoom).toBe(1);
});

test("a scene far bigger than the pane lands on the minimum, not a failure", () => {
  expect(computeFitZoom({ width: 100, height: 100 }, { width: 20000, height: 20000 }, 0.5, 10))
    .toBe(ZOOM_MIN);
});

test("a tiny scene is capped at the maximum", () => {
  expect(computeFitZoom({ width: 4000, height: 4000 }, { width: 10, height: 10 }, 0.5, 10))
    .toBe(ZOOM_MAX);
});

test("an unmeasured pane leaves the zoom alone", () => {
  expect(computeFitZoom({ width: 0, height: 0 }, scene, 0.42)).toBe(0.42);
});

test("a pane smaller than its own margins falls back to the minimum", () => {
  expect(computeFitZoom({ width: 40, height: 40 }, scene, 0.5, 32)).toBe(ZOOM_MIN);
});

test("a wheel notch up zooms in, down zooms out", () => {
  expect(wheelZoom(1, -100, 1.1)).toBeCloseTo(1.1, 5);
  expect(wheelZoom(1, 100, 1.1)).toBeCloseTo(1 / 1.1, 5);
});

test("wheel zoom respects the same bounds as everything else", () => {
  expect(wheelZoom(ZOOM_MAX, -100)).toBe(ZOOM_MAX);
  expect(wheelZoom(ZOOM_MIN, 100)).toBe(ZOOM_MIN);
});

test("no correction is needed when the point is already under the cursor", () => {
  // Cursor at 500, canvas at 100, scene point 400 at zoom 1 => already 500.
  const correction = focalPanCorrection(
    { left: 100, top: 50 },
    { clientX: 500, clientY: 250, sceneX: 400, sceneY: 200 },
    1
  );
  expect(correction).toEqual({ dx: 0, dy: 0 });
});

test("the correction pulls a drifted focal point back under the cursor", () => {
  // At zoom 2 the same scene point now sits at 100 + 800 = 900, cursor is at 500.
  const correction = focalPanCorrection(
    { left: 100, top: 50 },
    { clientX: 500, clientY: 250, sceneX: 400, sceneY: 200 },
    2
  );
  expect(correction).toEqual({ dx: -400, dy: -200 });
});
