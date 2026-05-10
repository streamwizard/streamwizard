import type { OverlayItemRow, OverlaySceneRow } from "@/app/actions/overlay";

/** Props passed to every registered overlay widget (scene + one layer item). */
export type OverlayWidgetProps = {
  scene: OverlaySceneRow;
  item: OverlayItemRow;
};
