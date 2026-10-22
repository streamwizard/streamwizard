import { isValidSlug, slugify } from "@repo/cms";

// When a heading gets its anchor, and when it loses it.
//
// An anchor is a URL: #set-up-obs is what someone linked to, and rewording
// the heading must not move it. So it is decided once, from the text the
// heading first had, and then left alone. Pure, so the rules can be read and
// tested without an editor.

export interface HeadingState {
  /** Where the heading starts in the document, for the transaction. */
  pos: number;
  text: string;
  anchor: string | null;
  /** The caret is inside this heading: it is still being typed. */
  holdsSelection: boolean;
}

export interface AnchorUpdate {
  pos: number;
  /** null clears the anchor, so an emptied heading can earn a new one. */
  anchor: string | null;
}

/** Headings are one page section each; 60 characters is plenty for a fragment. */
const MAX_ANCHOR_LENGTH = 60;

/**
 * What to change about the headings in one editor. Nothing is ever renamed:
 * the only moves are stamping a heading that has no anchor and clearing one
 * that has lost its text.
 */
export function anchorUpdates(headings: readonly HeadingState[]): AnchorUpdate[] {
  const updates: AnchorUpdate[] = [];
  // Only within this editor: a guide's intro and each section are separate
  // editors, and pageOutline settles collisions across the whole page.
  const taken = new Set(headings.flatMap((heading) => (heading.anchor ? [heading.anchor] : [])));

  for (const heading of headings) {
    const text = heading.text.trim();

    if (!text) {
      // Emptied: drop the anchor so retyping earns one from the new words,
      // rather than keeping a slug of something nobody can see.
      if (heading.anchor) updates.push({ pos: heading.pos, anchor: null });
      continue;
    }

    if (heading.anchor) continue;
    // Stamping mid-word would freeze "Setup" as "s" on the first keystroke.
    if (heading.holdsSelection) continue;

    const base = slugify(text, MAX_ANCHOR_LENGTH);
    if (!isValidSlug(base)) continue;

    let anchor = base;
    for (let n = 2; taken.has(anchor); n++) anchor = `${base}-${n}`;
    taken.add(anchor);
    updates.push({ pos: heading.pos, anchor });
  }

  return updates;
}
