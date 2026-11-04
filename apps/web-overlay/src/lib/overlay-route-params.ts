import { isGuid } from "@repo/schemas/ids";

export function safeDecodeOverlaySegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Matches UUID-shaped scene ids from `overlay_scenes.id`. */
export function isOverlaySceneUuid(value: string): boolean {
  return isGuid(value.trim());
}
