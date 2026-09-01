/** Zoom bounds for the editor canvas. The readout shows 10% to 200%. */
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 2;

/** Breathing room around the scene when fitting, in screen px. */
export const FIT_MARGIN_PX = 32;

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}

/**
 * The zoom that shows the whole scene inside the pane, with a margin.
 *
 * Takes the tighter of the two axes so nothing is cropped, and clamps like
 * every other zoom path — a scene far larger than the pane lands on the minimum
 * rather than failing. A pane that hasn't been laid out yet (zero width or
 * height) leaves the zoom alone by returning the current one.
 */
export function computeFitZoom(
  pane: { width: number; height: number },
  scene: { width: number; height: number },
  currentZoom: number,
  marginPx: number = FIT_MARGIN_PX
): number {
  if (pane.width <= 0 || pane.height <= 0) return currentZoom;
  if (scene.width <= 0 || scene.height <= 0) return currentZoom;

  const availableW = pane.width - marginPx * 2;
  const availableH = pane.height - marginPx * 2;
  if (availableW <= 0 || availableH <= 0) return ZOOM_MIN;

  return clampZoom(Math.min(availableW / scene.width, availableH / scene.height));
}

/** Multiplier per wheel notch. A trackpad pinch arrives as many small deltas. */
export const WHEEL_ZOOM_STEP = 1.1;

/** Where a wheel notch lands, given the direction the wheel turned. */
export function wheelZoom(zoom: number, deltaY: number, step: number = WHEEL_ZOOM_STEP): number {
  return clampZoom(zoom * (deltaY < 0 ? step : 1 / step));
}

/**
 * How far to move the pan so a scene point sits back under the cursor.
 *
 * Measured after the new zoom has been laid out, because the canvas is
 * flex-centred in a scrolling pane: where the box lands is a fact to read, not
 * a number to predict.
 */
export function focalPanCorrection(
  rect: { left: number; top: number },
  focus: { clientX: number; clientY: number; sceneX: number; sceneY: number },
  zoom: number
): { dx: number; dy: number } {
  return {
    dx: focus.clientX - (rect.left + focus.sceneX * zoom),
    dy: focus.clientY - (rect.top + focus.sceneY * zoom),
  };
}
