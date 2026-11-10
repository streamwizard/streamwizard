import type { ReactNode } from "react";
import type { PreviewClip } from "@/types/clips";
import type { DisplayFieldKey } from "@repo/ui/components/overlay/types/clips";

/** One clips-widget nested display row (`clip_display_field` variants). Customize per key in `fields/*.ts`. */
export interface ClipNestedDisplayFieldDefinition<
  K extends DisplayFieldKey = DisplayFieldKey,
> {
  key: K;
  label: string;
  formatPreviewText: (clip: PreviewClip | undefined) => string;
  /** Override the default truncated text layer; value is the non-empty string from `formatPreviewText`. */
  renderPreview?: (value: string) => ReactNode;
}
