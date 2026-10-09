import type { WidgetBaseDefinition } from "../../widget-definition";
import { SHAPE_WIDGET_TYPE, createDefaultShapeWidgetConfig } from "./shape-widget-config";
import { ShapeWidgetRenderer } from "./ShapeWidgetRenderer";

export const SHAPE_WIDGET_DEFAULT_SIZE = { w: 300, h: 300 } as const;

export const shapeWidgetBaseDefinition: WidgetBaseDefinition<typeof SHAPE_WIDGET_TYPE> = {
  type: SHAPE_WIDGET_TYPE,
  defaultSize: { ...SHAPE_WIDGET_DEFAULT_SIZE },
  createDefaultConfig: createDefaultShapeWidgetConfig,
  Renderer: ShapeWidgetRenderer,
};
