// The text styles a writer picks from, in their words rather than the
// schema's. "H2" means nothing to someone writing a guide; "Heading" does.
// The page title is the only H1, so the body starts at Heading.

export type TextStyleId = "paragraph" | "h2" | "h3" | "h4";

export interface TextStyle {
  id: TextStyleId;
  label: string;
  /** The heading level it writes, or null for body text. */
  level: 2 | 3 | 4 | null;
}

export const TEXT_STYLES: readonly TextStyle[] = [
  { id: "paragraph", label: "Normal text", level: null },
  { id: "h2", label: "Heading", level: 2 },
  { id: "h3", label: "Subheading", level: 3 },
  { id: "h4", label: "Small heading", level: 4 },
];

export interface HeadingFlags {
  h2: boolean;
  h3: boolean;
  h4: boolean;
}

/** Which style the cursor is in. Anything that isn't a heading reads as normal text. */
export function activeTextStyle(flags: HeadingFlags): TextStyleId {
  if (flags.h2) return "h2";
  if (flags.h3) return "h3";
  if (flags.h4) return "h4";
  return "paragraph";
}

export function textStyleLabel(id: TextStyleId): string {
  return TEXT_STYLES.find((style) => style.id === id)?.label ?? "Normal text";
}
