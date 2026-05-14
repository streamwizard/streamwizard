import { IrlFieldWidgetRenderer } from "./IrlFieldWidgetRenderer";
import { DEFAULT_IRL_FIELD_WIDGET_ITEM_CONFIG, resolvedTextWidgetFontFamily } from "../../types";
import type { OverlayItem } from "../../types";

export const IRL_FIELD_WIDGET_DEFAULT_SIZE = { w: 200, h: 50 } as const;

export function collectIrlFieldFontFamilies(item: OverlayItem): string[] {
  const cfg = item.config as { fontFamily?: string };
  const f = resolvedTextWidgetFontFamily(cfg);
  return f ? [f] : [];
}

export { IrlFieldWidgetRenderer };
export { DEFAULT_IRL_FIELD_WIDGET_ITEM_CONFIG };
