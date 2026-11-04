import type { OverlayWidgetRow } from "@repo/supabase/queries/overlays/widgets";
import type { WidgetFieldSchema } from "@repo/ui/overlay";

/** A custom widget the user owns (`overlay_widgets`), with its field schema typed. */
export type Widget = Omit<OverlayWidgetRow, "fields"> & { fields: WidgetFieldSchema };

/** A starter template in the widget library's Starters tab, without its source. */
export interface WidgetTemplate {
  id: string;
  slug: string;
  name: string;
  description: string;
  tags: string[];
}
