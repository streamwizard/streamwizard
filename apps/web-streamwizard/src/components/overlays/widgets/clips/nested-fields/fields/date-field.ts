import type { ClipNestedDisplayFieldDefinition } from "../types";

export const dateField: ClipNestedDisplayFieldDefinition<"date"> = {
  key: "date",
  label: "Date",
  formatPreviewText: (clip) =>
    clip ? new Date(clip.created_at_twitch).toLocaleDateString() : "",
};
