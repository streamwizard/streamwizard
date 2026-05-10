/** Matches UUID-shaped scene ids from `overlay_scenes.id`. */
const OVERLAY_SCENE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function safeDecodeOverlaySegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function isOverlaySceneUuid(value: string): boolean {
  return OVERLAY_SCENE_UUID_RE.test(value.trim());
}
