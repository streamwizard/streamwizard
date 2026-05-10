import {
  DEFAULT_CLIPS_WIDGET_CONFIG,
  type ClipDisplayFieldLayout,
  type DisplayFieldKey,
} from "@/types/overlays";

export function getDefaultLayoutForField(
  field: DisplayFieldKey
): ClipDisplayFieldLayout {
  return { ...DEFAULT_CLIPS_WIDGET_CONFIG.displayFieldLayouts[field] };
}
