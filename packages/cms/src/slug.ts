export const MAX_SLUG_LENGTH = 80;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// "How to set up OBS (2026)" -> "how-to-set-up-obs-2026". Accents are folded
// ("Café" -> "cafe"); anything that still isn't a-z or 0-9 becomes a dash.
export function slugify(input: string, maxLength: number = MAX_SLUG_LENGTH): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= maxLength) return slug;
  // Cut on a word boundary when there is one close enough.
  const cut = slug.slice(0, maxLength);
  const lastDash = cut.lastIndexOf("-");
  return (lastDash > maxLength / 2 ? cut.slice(0, lastDash) : cut).replace(/-+$/, "");
}

export function isValidSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= MAX_SLUG_LENGTH && SLUG.test(slug);
}
