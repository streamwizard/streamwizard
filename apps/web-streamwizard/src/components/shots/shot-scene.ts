import type { OverlaySceneWithItems } from "@repo/ui/overlay";

/**
 * A scene that exists only in memory for the length of a screenshot.
 *
 * The subscriber token is a short obvious placeholder rather than a realistic
 * one. A real token is the key an overlay page uses to read its own live data,
 * and the leak scanner fails any shot that shows something token-shaped. This
 * value only has to be non-empty so the widgets actually open their socket,
 * which the harness then intercepts.
 */
export function shotScene(opts: {
  id: string;
  width: number;
  height: number;
}): OverlaySceneWithItems {
  const now = new Date("2026-08-14T21:10:00.000Z").toISOString();
  return {
    id: opts.id,
    user_id: "shot-user",
    name: "Screenshot scene",
    slug: opts.id,
    subscriber_token: "shot-room",
    width: opts.width,
    height: opts.height,
    is_active: true,
    created_at: now,
    updated_at: now,
    items: [],
  };
}
