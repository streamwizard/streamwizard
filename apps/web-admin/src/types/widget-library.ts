import type { WidgetFieldSchema } from "@repo/ui/overlay";

/** A community widget submission waiting for review on /widget-library. */
export interface PendingEntry {
  id: string;
  title: string;
  description: string;
  tags: string[];
  created_at: string;
  overlay_widgets: {
    html: string;
    js: string;
    extra_css: string;
    fields: WidgetFieldSchema;
  };
}
