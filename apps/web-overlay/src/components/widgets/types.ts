import type { OverlayItem } from "@repo/ui/overlay";
import type { OverlaySceneRow } from "@/app/actions/overlay";

/** Props passed to every registered overlay widget. `scene` is optional — only clips widget needs it. */
export type OverlayWidgetProps = {
  item: OverlayItem;
  scene?: OverlaySceneRow;
};
