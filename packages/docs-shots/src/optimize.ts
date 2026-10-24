import sharp from "sharp";

/**
 * The dashboard is near-neutral by design, so it quantizes extremely well.
 * Step down the palette until the file fits rather than reaching for lossy.
 */
const LADDER = [
  { palette: true, colours: 256, effort: 10 },
  { palette: true, colours: 192, effort: 10 },
  { palette: true, colours: 128, effort: 10 },
] as const;

export const DEFAULT_MAX_KB = 300;

/**
 * Over budget almost always means the crop is too wide, which is an editorial
 * problem rather than a compression one. Fail loudly instead of shipping a
 * 900KB screenshot of a button.
 */
export async function optimize(png: Buffer, shotId: string, maxKb = DEFAULT_MAX_KB): Promise<Buffer> {
  let best = png;
  for (const opts of LADDER) {
    const out = await sharp(png).png(opts).toBuffer();
    if (out.length < best.length) best = out;
    if (best.length <= maxKb * 1024) return best;
  }
  throw new Error(
    `${shotId}: still ${(best.length / 1024).toFixed(0)}KB after quantizing (budget ${maxKb}KB). ` +
      `Tighten the crop, or drop dsf to 1 for this shot.`,
  );
}

/** The stage backdrop in (harness)/shots/widget/[type]/page.tsx, as RGB. */
const BACKDROP = [0x0b, 0x0b, 0x12] as const;

/**
 * A screenshot of an empty box is the quiet failure this harness is most prone
 * to: the crop is right, the run is green, and the widget never rendered.
 *
 * Flatness alone does not prove that, since a shape widget legitimately fills
 * its whole frame with one colour. Flat *and still the backdrop* does.
 */
export async function assertNotBlank(png: Buffer, shotId: string): Promise<void> {
  const { channels } = await sharp(png).stats();
  const spread = Math.max(...channels.map((c) => c.max - c.min));
  if (spread >= 12) return;

  const isBackdrop = channels
    .slice(0, 3)
    .every((c, i) => Math.abs(c.mean - (BACKDROP[i] ?? 0)) < 10);
  if (isBackdrop) {
    throw new Error(
      `${shotId}: the capture is still the bare backdrop, so the widget drew ` +
        `nothing. Check the actions reached the page; they run after settle.`,
    );
  }
}
