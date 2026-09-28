import type { CreditsData } from "@repo/schemas";

/**
 * Browser event that starts a roll on the editor canvas. Without `data` the
 * widget rolls the real credits it fetched; with `data` it rolls that instead
 * (the settings' "Roll with sample data"). detail: `{ sceneId, data? }`.
 */
export const CREDITS_ROLL_BROWSER_EVENT = "streamwizard:credits-roll";

export interface CreditsRollBrowserEventDetail {
  sceneId: string;
  data?: CreditsData;
}

/**
 * Browser event the settings fire to stop a roll on the canvas, drop any
 * sample data and read the real credits again. detail: `{ sceneId }`.
 */
export const CREDITS_RESET_BROWSER_EVENT = "streamwizard:credits-reset";

export interface CreditsResetBrowserEventDetail {
  sceneId: string;
}

export interface CreditsWidgetFrame {
  type: string;
  payload?: unknown;
}

/**
 * True for the socket frames that mean the stream started or ended. rest-api
 * writes sys.stream_id and sys.is_live on stream.online and stream.offline,
 * and every user-state write is pushed to the room; the raw stream.* events
 * never reach an overlay. The widget reads the credits again on these.
 */
export function streamChangedFromFrame(frame: CreditsWidgetFrame): boolean {
  if (frame?.type !== "streamwizard.user_state") return false;
  const p = frame.payload as { key?: unknown } | null | undefined;
  if (!p || typeof p !== "object") return false;
  return p.key === "sys.stream_id" || p.key === "sys.is_live";
}
