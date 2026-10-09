import { describe, expect, it } from "bun:test";
import { shapeWidgetItemConfigSchema } from "../../../../overlay-schemas";
import {
  SHAPE_WIDGET_LIMITS,
  createDefaultShapeWidgetConfig,
  normalizeShapeWidgetConfig,
  shapeGradientLine,
  shapePolygonPoints,
} from "./shape-widget-config";

describe("normalizeShapeWidgetConfig", () => {
  it("gives a missing or broken config the defaults", () => {
    expect(normalizeShapeWidgetConfig(null)).toEqual(createDefaultShapeWidgetConfig());
    expect(
      normalizeShapeWidgetConfig({ shape: "blob", fillColor: "red", fillOpacity: "half", strokeWidth: NaN })
    ).toEqual(createDefaultShapeWidgetConfig());
  });

  it("keeps valid values and clamps the numbers", () => {
    const cfg = normalizeShapeWidgetConfig({
      shape: "star",
      fillColor: "#fff",
      fillOpacity: 2,
      strokeColor: "#112233",
      strokeWidth: 999,
      rounding: -5,
      lineWidth: 0,
      fillType: "gradient",
      gradientColor: "#000",
      gradientAngle: 720,
      strokeType: "gradient",
      strokeGradientColor: "#abc",
      strokeGradientAngle: -20,
      roundedEnds: true,
    });
    expect(cfg).toEqual({
      shape: "star",
      fillColor: "#fff",
      fillOpacity: 1,
      strokeColor: "#112233",
      strokeWidth: SHAPE_WIDGET_LIMITS.strokeWidth.max,
      rounding: 0,
      lineWidth: SHAPE_WIDGET_LIMITS.lineWidth.min,
      fillType: "gradient",
      gradientColor: "#000",
      gradientAngle: 360,
      strokeType: "gradient",
      strokeGradientColor: "#abc",
      strokeGradientAngle: 0,
      roundedEnds: true,
    });
  });

  it("reads a shape saved before gradients existed as a solid fill", () => {
    const cfg = normalizeShapeWidgetConfig({ shape: "ellipse", fillColor: "#ff0000" });
    expect(cfg.fillType).toBe("solid");
    expect(cfg.strokeType).toBe("solid");
    expect(cfg.roundedEnds).toBe(false);
  });

  it("keeps a fill of none, which is how an outline-only shape is stored", () => {
    expect(normalizeShapeWidgetConfig({ fillType: "none" }).fillType).toBe("none");
  });
});

describe("shapeGradientLine", () => {
  const close = (line: ReturnType<typeof shapeGradientLine>, expected: number[]) => {
    [line.x1, line.y1, line.x2, line.y2].forEach((v, i) => expect(v).toBeCloseTo(expected[i]!));
  };

  it("runs left to right at 90 degrees and top to bottom at 180", () => {
    close(shapeGradientLine(90, 200, 100), [0, 50, 200, 50]);
    close(shapeGradientLine(180, 200, 100), [100, 0, 100, 100]);
  });

  it("points up at 0, the way CSS gradients do", () => {
    close(shapeGradientLine(0, 200, 100), [100, 100, 100, 0]);
  });

  it("reaches corner to corner on a square at 45 degrees", () => {
    close(shapeGradientLine(45, 100, 100), [0, 100, 100, 0]);
  });
});

describe("shapePolygonPoints", () => {
  it("draws a triangle point up across the whole box", () => {
    expect(shapePolygonPoints("triangle", 200, 100)).toEqual([
      [100, 0],
      [200, 100],
      [0, 100],
    ]);
  });

  it("puts a diamond's corners on the middle of each side", () => {
    expect(shapePolygonPoints("diamond", 200, 100)).toEqual([
      [100, 0],
      [200, 50],
      [100, 100],
      [0, 50],
    ]);
  });

  it("gives a star ten corners, the first one straight up", () => {
    const points = shapePolygonPoints("star", 200, 200);
    expect(points).toHaveLength(10);
    expect(points[0]![0]).toBeCloseTo(100);
    expect(points[0]![1]).toBeCloseTo(0);
  });

  it("pulls every corner in by the inset, so an outline stays inside the box", () => {
    for (const shape of ["triangle", "diamond", "star"] as const) {
      for (const [x, y] of shapePolygonPoints(shape, 200, 120, 10)) {
        expect(x).toBeGreaterThanOrEqual(10 - 1e-9);
        expect(x).toBeLessThanOrEqual(190 + 1e-9);
        expect(y).toBeGreaterThanOrEqual(10 - 1e-9);
        expect(y).toBeLessThanOrEqual(110 + 1e-9);
      }
    }
  });

  it("has no corners for shapes that are not polygons", () => {
    expect(shapePolygonPoints("rectangle", 100, 100)).toEqual([]);
    expect(shapePolygonPoints("ellipse", 100, 100)).toEqual([]);
    expect(shapePolygonPoints("line", 100, 100)).toEqual([]);
  });
});

describe("shape widget schema", () => {
  it("defaults to the same config the widget is created with", () => {
    expect(shapeWidgetItemConfigSchema.parse({})).toEqual(createDefaultShapeWidgetConfig());
  });
});
