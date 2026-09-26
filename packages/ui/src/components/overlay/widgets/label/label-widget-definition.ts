import type { WidgetBaseDefinition } from "../../widget-definition";
import {
  LABEL_WIDGET_TYPE,
  createDefaultLabelWidgetConfig,
  normalizeLabelWidgetConfig,
} from "./label-widget-config";
import { LabelWidgetRenderer } from "./LabelWidgetRenderer";

export const LABEL_WIDGET_DEFAULT_SIZE = { w: 480, h: 64 } as const;

export const labelWidgetBaseDefinition: WidgetBaseDefinition<typeof LABEL_WIDGET_TYPE> = {
  type: LABEL_WIDGET_TYPE,
  defaultSize: { ...LABEL_WIDGET_DEFAULT_SIZE },
  createDefaultConfig: createDefaultLabelWidgetConfig,
  Renderer: LabelWidgetRenderer,
  collectFontFamilies: (item) => [normalizeLabelWidgetConfig(item.config).fontFamily],
};
