/**
 * How a widget says "something just happened on screen" without knowing who,
 * if anyone, is counting. The rendered overlay listens and adds the counts to
 * its usage heartbeat; in the editor nothing listens and the event is a no-op.
 *
 * Clips play straight from the Twitch CDN and alerts arrive over the socket,
 * so no server of ours sees either one happen. This is the only place it can
 * be counted.
 */
export const OVERLAY_ACTIVITY_EVENT = "streamwizard:overlay-activity";

export type OverlayActivityKind = "clip_played" | "alert_shown";

export function reportOverlayActivity(kind: OverlayActivityKind): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<{ kind: OverlayActivityKind }>(OVERLAY_ACTIVITY_EVENT, { detail: { kind } }));
}
