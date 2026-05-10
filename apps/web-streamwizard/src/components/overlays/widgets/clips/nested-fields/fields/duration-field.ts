import type { ClipNestedDisplayFieldDefinition } from "../types";

export const durationField: ClipNestedDisplayFieldDefinition<"duration"> = {
  key: "duration",
  label: "Duration",
  formatPreviewText: (clip) =>
    clip?.duration != null ? `${clip.duration}s` : "",
};
