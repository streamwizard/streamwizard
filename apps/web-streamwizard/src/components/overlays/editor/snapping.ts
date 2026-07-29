/** Pure snapping math for the overlay editor canvas. All coordinates are scene-space. */

export interface Guide {
  orientation: "v" | "h";
  /** Scene-space coordinate of the guide line (x for vertical, y for horizontal). */
  position: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface SnapResult {
  x: number;
  y: number;
  guides: Guide[];
}

/**
 * Snap a moving rect to scene edges, scene center, and other rects' edges/centers.
 * Axes resolve independently; the closest candidate within `threshold` wins per axis.
 */
export function computeSnap(
  moving: Rect,
  targets: Rect[],
  scene: { width: number; height: number },
  threshold: number
): SnapResult {
  const vCandidates: number[] = [0, scene.width / 2, scene.width];
  const hCandidates: number[] = [0, scene.height / 2, scene.height];
  for (const t of targets) {
    vCandidates.push(t.x, t.x + t.w / 2, t.x + t.w);
    hCandidates.push(t.y, t.y + t.h / 2, t.y + t.h);
  }

  const guides: Guide[] = [];

  const snapAxis = (
    pos: number,
    size: number,
    candidates: number[]
  ): { pos: number; guide: number | null } => {
    const edges = [pos, pos + size / 2, pos + size];
    let best: { delta: number; candidate: number } | null = null;
    for (const candidate of candidates) {
      for (const edge of edges) {
        const delta = candidate - edge;
        if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
          best = { delta, candidate };
        }
      }
    }
    return best ? { pos: pos + best.delta, guide: best.candidate } : { pos, guide: null };
  };

  const sx = snapAxis(moving.x, moving.w, vCandidates);
  const sy = snapAxis(moving.y, moving.h, hCandidates);

  if (sx.guide !== null) guides.push({ orientation: "v", position: sx.guide });
  if (sy.guide !== null) guides.push({ orientation: "h", position: sy.guide });

  return { x: sx.pos, y: sy.pos, guides };
}
