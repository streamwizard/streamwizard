import type { ClipNestedDisplayFieldDefinition } from "../types";

export const creatorField: ClipNestedDisplayFieldDefinition<"creator"> = {
  key: "creator",
  label: "Creator",
  formatPreviewText: (clip) => clip?.creator_name ?? "",
};
