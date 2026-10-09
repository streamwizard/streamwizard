"use client";

import { useMemo } from "react";
import { Circle, Diamond, Minus, Square, Star, Triangle, type LucideIcon } from "lucide-react";
import { ColorPicker, Label, cn } from "@repo/ui";
import {
  InspectorReveal,
  InspectorSection,
  SegmentedField,
  SliderField,
  SwitchField,
  type SegmentedOption,
} from "@/components/overlays/inspector-fields";
import {
  SHAPE_WIDGET_FRAME_STROKE_WIDTH,
  SHAPE_WIDGET_LIMITS,
  SHAPE_WIDGET_SHAPES,
  createDefaultShapeWidgetConfig,
  normalizeShapeWidgetConfig,
  type ShapeWidgetFillType,
  type ShapeWidgetItemConfig,
  type ShapeWidgetShape,
  type ShapeWidgetStrokeType,
} from "@repo/ui/overlay";
import type { OverlayInspectorAppendProps } from "../../registry/overlay-widget-registry.types";

const SHAPES: Record<ShapeWidgetShape, { label: string; icon: LucideIcon }> = {
  rectangle: { label: "Rectangle", icon: Square },
  ellipse: { label: "Circle", icon: Circle },
  triangle: { label: "Triangle", icon: Triangle },
  diamond: { label: "Diamond", icon: Diamond },
  star: { label: "Star", icon: Star },
  line: { label: "Line", icon: Minus },
};

const FILL_TYPE_OPTIONS: readonly SegmentedOption<ShapeWidgetFillType>[] = [
  { value: "none", label: "None" },
  { value: "solid", label: "Color" },
  { value: "gradient", label: "Gradient" },
];

/** A line is nothing but its color, so it cannot go without one. */
const LINE_FILL_TYPE_OPTIONS = FILL_TYPE_OPTIONS.filter((option) => option.value !== "none");

const STROKE_TYPE_OPTIONS: readonly SegmentedOption<ShapeWidgetStrokeType>[] = [
  { value: "solid", label: "Color" },
  { value: "gradient", label: "Gradient" },
];

/** One color, or the two ends of a gradient and the way it runs. */
function PaintFields({
  id,
  what,
  gradient,
  color,
  gradientColor,
  angle,
  onColor,
  onGradientColor,
  onAngle,
}: {
  id: string;
  /** "Fill", "Line" or "Outline": names the pickers for screen readers. */
  what: string;
  gradient: boolean;
  color: string;
  gradientColor: string;
  angle: number;
  onColor: (color: string) => void;
  onGradientColor: (color: string) => void;
  onAngle: (angle: number) => void;
}) {
  return (
    <>
      <div className={gradient ? "grid grid-cols-2 gap-2" : undefined}>
        <div className="min-w-0 space-y-1.5">
          <Label className="text-xs">{gradient ? "From" : "Color"}</Label>
          <ColorPicker
            value={color}
            onChange={onColor}
            aria-label={gradient ? `${what} gradient start color` : `${what} color`}
          />
        </div>
        {gradient ? (
          <div className="min-w-0 space-y-1.5">
            <Label className="text-xs">To</Label>
            <ColorPicker value={gradientColor} onChange={onGradientColor} aria-label={`${what} gradient end color`} />
          </div>
        ) : null}
      </div>
      <InspectorReveal show={gradient} marginTop={0}>
        <SliderField
          id={`${id}-angle`}
          label="Direction"
          unit="°"
          hint="90° runs left to right, 180° top to bottom."
          value={angle}
          min={SHAPE_WIDGET_LIMITS.gradientAngle.min}
          max={SHAPE_WIDGET_LIMITS.gradientAngle.max}
          onChange={onAngle}
        />
      </InspectorReveal>
    </>
  );
}

export function ShapeWidgetSettings({ item, updateItem }: OverlayInspectorAppendProps) {
  const cfg = useMemo(() => normalizeShapeWidgetConfig(item.config), [item.config]);
  const isLine = cfg.shape === "line";
  // Mirrors the renderer: a line saved without a fill still shows its color.
  const fillType = isLine && cfg.fillType === "none" ? "solid" : cfg.fillType;

  function patchConfig(updates: Partial<ShapeWidgetItemConfig>) {
    updateItem(item.id, { config: { ...cfg, ...updates } });
  }

  /**
   * A new shape starts from the default look: colors, outline and corners set
   * for the last shape rarely suit the next one. Size, position and rotation
   * are the item's, not the shape's, so they stay.
   */
  function pickShape(shape: ShapeWidgetShape) {
    if (shape === cfg.shape) return;
    updateItem(item.id, { config: { ...createDefaultShapeWidgetConfig(), shape } });
  }

  /**
   * Turning the fill off is how you make a frame. A shape with no outline
   * would disappear with it, so it gets one.
   */
  function pickFillType(next: ShapeWidgetFillType) {
    patchConfig(
      next === "none" && cfg.strokeWidth <= 0
        ? { fillType: next, strokeWidth: SHAPE_WIDGET_FRAME_STROKE_WIDTH }
        : { fillType: next }
    );
  }

  return (
    <div className="space-y-6">
      <InspectorSection title="Shape" defaultOpen>
        <div className="space-y-4">
          <div role="radiogroup" aria-label="Shape" className="grid grid-cols-3 gap-2">
            {SHAPE_WIDGET_SHAPES.map((shape) => {
              const { label, icon: Icon } = SHAPES[shape];
              const selected = cfg.shape === shape;
              return (
                <button
                  key={shape}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => pickShape(shape)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-md border px-2 py-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-input text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <Icon className="size-5" />
                  {label}
                </button>
              );
            })}
          </div>
          <InspectorReveal show={cfg.shape === "rectangle"} marginTop={0}>
            <SliderField
              id="shape-widget-rounding"
              label="Rounded corners"
              unit="%"
              hint="100% turns a square into a circle and a wide box into a pill."
              value={cfg.rounding}
              min={SHAPE_WIDGET_LIMITS.rounding.min}
              max={SHAPE_WIDGET_LIMITS.rounding.max}
              onChange={(rounding) => patchConfig({ rounding })}
            />
          </InspectorReveal>
          <InspectorReveal show={isLine} marginTop={0}>
            <SliderField
              id="shape-widget-line-width"
              label="Thickness"
              unit="px"
              hint="Rotate the widget for a vertical or slanted line."
              value={cfg.lineWidth}
              min={SHAPE_WIDGET_LIMITS.lineWidth.min}
              max={SHAPE_WIDGET_LIMITS.lineWidth.max}
              onChange={(lineWidth) => patchConfig({ lineWidth })}
            />
            <SwitchField
              id="shape-widget-rounded-ends"
              label="Rounded ends"
              checked={cfg.roundedEnds}
              onCheckedChange={(roundedEnds) => patchConfig({ roundedEnds })}
            />
          </InspectorReveal>
        </div>
      </InspectorSection>

      <InspectorSection title={isLine ? "Color" : "Fill"} defaultOpen>
        <div className="space-y-4">
          <SegmentedField
            id="shape-widget-fill-type"
            label="Type"
            hint={isLine ? undefined : "None leaves only the outline: a frame for your webcam or a box around a widget."}
            value={fillType}
            options={isLine ? LINE_FILL_TYPE_OPTIONS : FILL_TYPE_OPTIONS}
            onChange={pickFillType}
          />
          <InspectorReveal show={fillType !== "none"} marginTop={0}>
            <div className="space-y-4">
              <PaintFields
                id="shape-widget-fill"
                what={isLine ? "Line" : "Fill"}
                gradient={fillType === "gradient"}
                color={cfg.fillColor}
                gradientColor={cfg.gradientColor}
                angle={cfg.gradientAngle}
                onColor={(fillColor) => patchConfig({ fillColor })}
                onGradientColor={(gradientColor) => patchConfig({ gradientColor })}
                onAngle={(gradientAngle) => patchConfig({ gradientAngle })}
              />
              <SliderField
                id="shape-widget-fill-opacity"
                label="Opacity"
                unit="%"
                value={Math.round(cfg.fillOpacity * 100)}
                min={0}
                max={100}
                onChange={(opacity) => patchConfig({ fillOpacity: opacity / 100 })}
              />
            </div>
          </InspectorReveal>
        </div>
      </InspectorSection>

      {isLine ? null : (
        <InspectorSection title="Outline" defaultOpen>
          <div className="space-y-4">
            <SliderField
              id="shape-widget-stroke-width"
              label="Thickness"
              unit="px"
              hint="0 is no outline."
              value={cfg.strokeWidth}
              min={SHAPE_WIDGET_LIMITS.strokeWidth.min}
              max={SHAPE_WIDGET_LIMITS.strokeWidth.max}
              onChange={(strokeWidth) => patchConfig({ strokeWidth })}
            />
            <InspectorReveal show={cfg.strokeWidth > 0} marginTop={0}>
              <div className="space-y-4">
                <SegmentedField
                  id="shape-widget-stroke-type"
                  label="Type"
                  value={cfg.strokeType}
                  options={STROKE_TYPE_OPTIONS}
                  onChange={(strokeType) => patchConfig({ strokeType })}
                />
                <PaintFields
                  id="shape-widget-stroke"
                  what="Outline"
                  gradient={cfg.strokeType === "gradient"}
                  color={cfg.strokeColor}
                  gradientColor={cfg.strokeGradientColor}
                  angle={cfg.strokeGradientAngle}
                  onColor={(strokeColor) => patchConfig({ strokeColor })}
                  onGradientColor={(strokeGradientColor) => patchConfig({ strokeGradientColor })}
                  onAngle={(strokeGradientAngle) => patchConfig({ strokeGradientAngle })}
                />
              </div>
            </InspectorReveal>
          </div>
        </InspectorSection>
      )}
    </div>
  );
}
