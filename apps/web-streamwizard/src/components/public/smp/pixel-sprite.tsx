import Image from "next/image";
import type { SmpSprite } from "@/components/public/smp/smp-content";

/*
 * One of the mod's 16x16 textures. `scale` is a whole number, so every art
 * pixel covers the same number of screen pixels. `unoptimized`: the files are
 * a few hundred bytes, and the image optimizer would resample them.
 */
export function PixelSprite({ sprite, scale = 3 }: { sprite: SmpSprite; scale?: 2 | 3 | 4 }) {
  const size = 16 * scale;
  return (
    <Image
      src={`/img/smp/${sprite}.png`}
      alt=""
      width={size}
      height={size}
      unoptimized
      className="pixel-art shrink-0"
      style={{ width: size, height: size }}
    />
  );
}
