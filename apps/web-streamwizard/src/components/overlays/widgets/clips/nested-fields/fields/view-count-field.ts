import type { ClipNestedDisplayFieldDefinition } from "../types";

export const viewCountField: ClipNestedDisplayFieldDefinition<"viewCount"> = {
  key: "viewCount",
  label: "View count",
  formatPreviewText: (clip) =>
    clip?.view_count != null ? `${clip.view_count.toLocaleString()} views` : "",
};
