import {
  DEFAULT_CLIPS_WIDGET_CONFIG,
  type ClipDisplayFieldLayout,
  type DisplayFieldKey,
} from "@repo/ui/components/overlay/types/clips";

export function getDefaultLayoutForField(
  field: DisplayFieldKey
): ClipDisplayFieldLayout {
  return { ...DEFAULT_CLIPS_WIDGET_CONFIG.displayFieldLayouts[field] };
}
