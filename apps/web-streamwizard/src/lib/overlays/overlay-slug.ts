/**
 * Overlay URLs are `<overlay host>/<slug>` and nothing else, so the slug is
 * the secret: whoever has it can load the overlay. The readable name prefix
 * adds nothing to that; the random suffix carries all of it.
 *
 * Shared by the overlay server actions and the dashboard UI (the "Upgrade URL"
 * prompt), so it must stay free of server-only imports.
 */

const SUFFIX_LENGTH = 16;
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
/** Longest name prefix kept; the suffix is what matters, the name is for humans. */
const MAX_PREFIX_LENGTH = 48;

// Byte values at or above this would bias the alphabet (256 % 36 != 0), so
// they are thrown away and redrawn.
const UNBIASED_LIMIT = 256 - (256 % ALPHABET.length);

/** 16 characters from a 36-letter alphabet, ~82 bits, from the platform CSPRNG. */
export function randomSlugSuffix(): string {
  let out = "";
  const bytes = new Uint8Array(SUFFIX_LENGTH * 2);
  while (out.length < SUFFIX_LENGTH) {
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b >= UNBIASED_LIMIT) continue;
      out += ALPHABET[b % ALPHABET.length];
      if (out.length === SUFFIX_LENGTH) break;
    }
  }
  return out;
}

export function generateSlug(name: string): string {
  const prefix = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, MAX_PREFIX_LENGTH)
    .replace(/^-|-$/g, "");
  return `${prefix || "overlay"}-${randomSlugSuffix()}`;
}

const STRONG_SLUG = new RegExp(`-[a-z0-9]{${SUFFIX_LENGTH}}$`);

/**
 * True for slugs made before the suffix was lengthened (6 characters from
 * Math.random). Those URLs still work, but the dashboard asks the streamer to
 * replace them.
 */
export function isLegacySlug(slug: string): boolean {
  return !STRONG_SLUG.test(slug);
}
