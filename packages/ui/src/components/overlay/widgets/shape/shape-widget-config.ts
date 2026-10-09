/**
 * A plain shape: the building block for frames, backdrops, dividers and
 * anything else a streamer wants to draw behind or around their widgets.
 */
export const SHAPE_WIDGET_TYPE = "shape_widget" as const;
export type ShapeWidgetType = typeof SHAPE_WIDGET_TYPE;

export const SHAPE_WIDGET_SHAPES = ["rectangle", "ellipse", "triangle", "diamond", "star", "line"] as const;
export type ShapeWidgetShape = (typeof SHAPE_WIDGET_SHAPES)[number];

/** `none` leaves the inside empty: an outline-only shape, a frame. */
export const SHAPE_WIDGET_FILL_TYPES = ["none", "solid", "gradient"] as const;
export type ShapeWidgetFillType = (typeof SHAPE_WIDGET_FILL_TYPES)[number];

export const SHAPE_WIDGET_STROKE_TYPES = ["solid", "gradient"] as const;
export type ShapeWidgetStrokeType = (typeof SHAPE_WIDGET_STROKE_TYPES)[number];

/** The outline a shape gets when its fill is turned off and it had none, so it does not vanish. */
export const SHAPE_WIDGET_FRAME_STROKE_WIDTH = 8;

export const SHAPE_WIDGET_LIMITS = {
  strokeWidth: { min: 0, max: 60 },
  lineWidth: { min: 1, max: 100 },
  rounding: { min: 0, max: 100 },
  gradientAngle: { min: 0, max: 360 },
} as const;

export interface ShapeWidgetItemConfig {
  shape: ShapeWidgetShape;
  /** Fill of the shape, and the color of a line. */
  fillColor: string;
  /** 0–1. Zero leaves only the outline. */
  fillOpacity: number;
  strokeColor: string;
  /** Outline thickness in px. Zero = no outline. */
  strokeWidth: number;
  /** Corner rounding in percent, rectangles only. 100 on a square is a circle. */
  rounding: number;
  /** Thickness of a line in px. */
  lineWidth: number;
  /** Nothing, one color, or a blend from `fillColor` to `gradientColor`. */
  fillType: ShapeWidgetFillType;
  gradientColor: string;
  /** Direction the blend runs in, the CSS way: 0 is up, 90 is to the right. */
  gradientAngle: number;
  /** One color, or a blend from `strokeColor` to `strokeGradientColor`. */
  strokeType: ShapeWidgetStrokeType;
  strokeGradientColor: string;
  strokeGradientAngle: number;
  /** Lines only: round caps instead of square ends. */
  roundedEnds: boolean;
}

export function createDefaultShapeWidgetConfig(): ShapeWidgetItemConfig {
  return {
    shape: "rectangle",
    fillColor: "#9e7aff",
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWidth: 0,
    rounding: 0,
    lineWidth: 8,
    fillType: "solid",
    gradientColor: "#00d4ff",
    gradientAngle: 90,
    strokeType: "solid",
    strokeGradientColor: "#00d4ff",
    strokeGradientAngle: 90,
    roundedEnds: false,
  };
}

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function color(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_COLOR.test(value) ? value : fallback;
}

function clamped(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

/** Fills gaps and clamps a stored config, so a partial or old row still renders. */
export function normalizeShapeWidgetConfig(raw: unknown): ShapeWidgetItemConfig {
  const d = createDefaultShapeWidgetConfig();
  const c = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof ShapeWidgetItemConfig, unknown>>;
  const L = SHAPE_WIDGET_LIMITS;
  return {
    shape: SHAPE_WIDGET_SHAPES.includes(c.shape as ShapeWidgetShape) ? (c.shape as ShapeWidgetShape) : d.shape,
    fillColor: color(c.fillColor, d.fillColor),
    fillOpacity: clamped(c.fillOpacity, 0, 1, d.fillOpacity),
    strokeColor: color(c.strokeColor, d.strokeColor),
    strokeWidth: clamped(c.strokeWidth, L.strokeWidth.min, L.strokeWidth.max, d.strokeWidth),
    rounding: clamped(c.rounding, L.rounding.min, L.rounding.max, d.rounding),
    lineWidth: clamped(c.lineWidth, L.lineWidth.min, L.lineWidth.max, d.lineWidth),
    fillType: SHAPE_WIDGET_FILL_TYPES.includes(c.fillType as ShapeWidgetFillType)
      ? (c.fillType as ShapeWidgetFillType)
      : d.fillType,
    gradientColor: color(c.gradientColor, d.gradientColor),
    gradientAngle: clamped(c.gradientAngle, L.gradientAngle.min, L.gradientAngle.max, d.gradientAngle),
    strokeType: SHAPE_WIDGET_STROKE_TYPES.includes(c.strokeType as ShapeWidgetStrokeType)
      ? (c.strokeType as ShapeWidgetStrokeType)
      : d.strokeType,
    strokeGradientColor: color(c.strokeGradientColor, d.strokeGradientColor),
    strokeGradientAngle: clamped(
      c.strokeGradientAngle,
      L.gradientAngle.min,
      L.gradientAngle.max,
      d.strokeGradientAngle
    ),
    roundedEnds: typeof c.roundedEnds === "boolean" ? c.roundedEnds : d.roundedEnds,
  };
}

/**
 * Start and end of a gradient crossing a `w` x `h` box at `angle` degrees,
 * through its centre. Long enough that the first color lands exactly on one
 * corner and the last on the opposite one, the way a CSS linear-gradient does.
 */
export function shapeGradientLine(
  angle: number,
  w: number,
  h: number
): { x1: number; y1: number; x2: number; y2: number } {
  const rad = (angle * Math.PI) / 180;
  // 0 degrees points up; y grows downward on screen.
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const half = (Math.abs(dx) * w + Math.abs(dy) * h) / 2;
  return {
    x1: w / 2 - dx * half,
    y1: h / 2 - dy * half,
    x2: w / 2 + dx * half,
    y2: h / 2 + dy * half,
  };
}

/** Outer-to-inner radius of the star's points. */
const STAR_INNER_RATIO = 0.4;
const STAR_POINTS = 5;

/**
 * The corners of a polygon shape inside a `w` x `h` box, pulled in by `inset`
 * on every side so an outline of twice that width stays inside the box.
 * Empty for shapes that are not polygons.
 */
export function shapePolygonPoints(
  shape: ShapeWidgetShape,
  w: number,
  h: number,
  inset = 0
): Array<[number, number]> {
  const left = inset;
  const top = inset;
  const right = Math.max(inset, w - inset);
  const bottom = Math.max(inset, h - inset);
  const cx = w / 2;
  const cy = h / 2;

  if (shape === "triangle") {
    return [
      [cx, top],
      [right, bottom],
      [left, bottom],
    ];
  }
  if (shape === "diamond") {
    return [
      [cx, top],
      [right, cy],
      [cx, bottom],
      [left, cy],
    ];
  }
  if (shape === "star") {
    const rx = (right - left) / 2;
    const ry = (bottom - top) / 2;
    return Array.from({ length: STAR_POINTS * 2 }, (_, i): [number, number] => {
      const reach = i % 2 === 0 ? 1 : STAR_INNER_RATIO;
      // First point straight up, then alternating outer and inner points.
      const angle = -Math.PI / 2 + (i * Math.PI) / STAR_POINTS;
      return [cx + Math.cos(angle) * rx * reach, cy + Math.sin(angle) * ry * reach];
    });
  }
  return [];
}
