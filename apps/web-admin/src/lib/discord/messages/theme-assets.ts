import type { StaticImageData } from "next/image";
import { THEMES } from "@repo/discord-message";
import type { BuilderTheme } from "@repo/ui/message-builder";
import classic from "@repo/discord-message/assets/themes/classic.png";
import classicBlurple from "@repo/discord-message/assets/themes/classic-blurple.png";
import classicMidnight from "@repo/discord-message/assets/themes/classic-midnight.png";
import animeSakura from "@repo/discord-message/assets/themes/anime-sakura.png";
import animeSunset from "@repo/discord-message/assets/themes/anime-sunset.png";
import animeSpeedlines from "@repo/discord-message/assets/themes/anime-speedlines.gif";
import gamingArcade from "@repo/discord-message/assets/themes/gaming-arcade.png";
import gamingPixels from "@repo/discord-message/assets/themes/gaming-pixels.png";
import gamingNeonGrid from "@repo/discord-message/assets/themes/gaming-neon-grid.gif";
import lofiDusk from "@repo/discord-message/assets/themes/lofi-dusk.png";
import lofiPaper from "@repo/discord-message/assets/themes/lofi-paper.png";
import lofiRain from "@repo/discord-message/assets/themes/lofi-rain.gif";
import glitchRgb from "@repo/discord-message/assets/themes/glitch-rgb.png";
import glitchScanlines from "@repo/discord-message/assets/themes/glitch-scanlines.png";
import glitchSignal from "@repo/discord-message/assets/themes/glitch-signal.gif";
import spaceNebula from "@repo/discord-message/assets/themes/space-nebula.png";
import spaceStars from "@repo/discord-message/assets/themes/space-stars.gif";
import minimalSlate from "@repo/discord-message/assets/themes/minimal-slate.png";
import minimalCream from "@repo/discord-message/assets/themes/minimal-cream.png";

// The theme files live in @repo/discord-message, where the bot reads them from
// disk. Importing them here has Next bundle the same files for the preview.
// A theme added to the catalog needs a line here too; the page throws if one
// is missing rather than showing a blank banner.
const IMAGES: Record<string, StaticImageData> = {
  "classic": classic,
  "classic-blurple": classicBlurple,
  "classic-midnight": classicMidnight,
  "anime-sakura": animeSakura,
  "anime-sunset": animeSunset,
  "anime-speedlines": animeSpeedlines,
  "gaming-arcade": gamingArcade,
  "gaming-pixels": gamingPixels,
  "gaming-neon-grid": gamingNeonGrid,
  "lofi-dusk": lofiDusk,
  "lofi-paper": lofiPaper,
  "lofi-rain": lofiRain,
  "glitch-rgb": glitchRgb,
  "glitch-scanlines": glitchScanlines,
  "glitch-signal": glitchSignal,
  "space-nebula": spaceNebula,
  "space-stars": spaceStars,
  "minimal-slate": minimalSlate,
  "minimal-cream": minimalCream,
};

/** Catalog plus bundled image URLs, serialisable for the client builder. */
export function getBuilderThemes(): BuilderTheme[] {
  return THEMES.map((theme) => {
    const image = IMAGES[theme.id];
    if (!image) throw new Error(`Theme "${theme.id}" has no image in theme-assets.ts`);
    return { ...theme, imageUrl: image.src };
  });
}
