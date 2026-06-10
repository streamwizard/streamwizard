export const CLIP_VIEWS = ["grid", "list", "details"] as const;

export type ClipView = (typeof CLIP_VIEWS)[number];

export const DEFAULT_CLIP_VIEW: ClipView = "grid";

export function parseClipView(view?: string): ClipView {
  return (CLIP_VIEWS as readonly string[]).includes(view ?? "")
    ? (view as ClipView)
    : DEFAULT_CLIP_VIEW;
}

export function getClipViewContainerClass(view: ClipView): string {
  switch (view) {
    case "list":
      return "flex flex-col gap-3";
    case "details":
      return "w-full";
    default:
      return "grid grid-cols-4 gap-4";
  }
}
