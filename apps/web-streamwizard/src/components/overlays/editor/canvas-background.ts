import type { CSSProperties } from "react";
import type { CanvasBackground } from "./canvas-preferences";

const CHECKER_LIGHT = "#5a5a5a";
const CHECKER_DARK = "#3f3f3f";
const CHECKER_TILE_PX = 16;

/**
 * What sits behind the widgets while designing. Purely an editor aid — the live
 * overlay is always transparent.
 *
 * The checkerboard is the one that earns its place: against a flat colour a
 * transparent PNG's soft edges are invisible, and a halo only shows up once it
 * is over something with contrast in it.
 */
export const CANVAS_BACKGROUND_STYLES: Record<CanvasBackground, CSSProperties> = {
  // Opaque, not rgba(...,0.9): a translucent fill composites with whatever is
  // behind it, so the canvas ends up a slightly different black to everything
  // around it instead of one flat colour.
  dark: { background: "#000000" },
  light: { background: "#f4f4f5" },
  grey: { background: "#808080" },
  // Streamers key against this, so it doubles as a chroma preview.
  green: { background: "#00b140" },
  checker: {
    backgroundColor: CHECKER_DARK,
    backgroundImage: `
      linear-gradient(45deg, ${CHECKER_LIGHT} 25%, transparent 25%),
      linear-gradient(-45deg, ${CHECKER_LIGHT} 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, ${CHECKER_LIGHT} 75%),
      linear-gradient(-45deg, transparent 75%, ${CHECKER_LIGHT} 75%)
    `,
    backgroundSize: `${CHECKER_TILE_PX * 2}px ${CHECKER_TILE_PX * 2}px`,
    backgroundPosition: `0 0, 0 ${CHECKER_TILE_PX}px, ${CHECKER_TILE_PX}px -${CHECKER_TILE_PX}px, -${CHECKER_TILE_PX}px 0`,
  },
};
