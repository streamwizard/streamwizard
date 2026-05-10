import type { ClipNestedDisplayFieldDefinition } from "../types";

export const titleField: ClipNestedDisplayFieldDefinition<"title"> = {
  key: "title",
  label: "Title",
  formatPreviewText: (clip) => clip?.title ?? "",
};
