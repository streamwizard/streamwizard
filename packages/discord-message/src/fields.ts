// How Discord lays out embed fields, and the drag-and-drop edit built on it.
// A field only knows whether it is inline; rows follow from the order: inline
// fields that follow each other share a row, three at most, and a field that
// isn't inline takes a row of its own.

type Layoutable = { id: string; inline: boolean };

export const FIELDS_PER_ROW = 3;

/** The fields cut into the rows Discord shows them in. */
export function fieldRows<T extends Layoutable>(fields: readonly T[]): T[][] {
  const rows: T[][] = [];
  let open: T[] | null = null;
  for (const field of fields) {
    if (!field.inline) {
      rows.push([field]);
      open = null;
    } else if (open && open.length < FIELDS_PER_ROW) {
      open.push(field);
    } else {
      open = [field];
      rows.push(open);
    }
  }
  return rows;
}

/** Where a dragged field lands, relative to the field it was dropped on. */
export type FieldDropSide = "left" | "right" | "above" | "below";

/**
 * Moves a field next to another one. Left and right put the two side by side;
 * above and below give the moved field a row of its own, clear of the whole
 * row the target sits in. Everything else keeps its setting, so what is left
 * of a row closes up. Unknown ids leave the fields as they were.
 */
export function dropField<T extends Layoutable>(fields: readonly T[], fieldId: string, targetId: string, side: FieldDropSide): T[] {
  const moved = fields.find((field) => field.id === fieldId);
  if (!moved || fieldId === targetId || !fields.some((field) => field.id === targetId)) return [...fields];

  const rest = fields.filter((field) => field.id !== fieldId);
  const beside = side === "left" || side === "right";

  let anchorId = targetId;
  if (!beside) {
    const row = fieldRows(rest).find((fieldsInRow) => fieldsInRow.some((field) => field.id === targetId)) ?? [];
    anchorId = (side === "above" ? row[0] : row.at(-1))?.id ?? targetId;
  }

  const next = rest.map((field) => (beside && field.id === targetId ? { ...field, inline: true } : field));
  const anchor = next.findIndex((field) => field.id === anchorId);
  const at = side === "left" || side === "above" ? anchor : anchor + 1;
  next.splice(at, 0, { ...moved, inline: beside });
  return next;
}
