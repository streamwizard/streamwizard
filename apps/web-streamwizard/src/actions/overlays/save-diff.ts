/**
 * What one Save in the overlay editor changed, worked out from the rows that
 * were in the table before it and what was written.
 *
 * The editor only ever said "a widget was dropped on the canvas", and said it
 * before saving, so an add that was undone a second later counted the same as
 * one that went on stream. The table can't answer it afterwards either: a
 * removed item is a deleted row, and every save rewrites the rest. So the
 * difference is taken here, at the one moment both sides are known.
 *
 * Only widget types and ids leave this module. Never a config: a custom
 * widget's config can hold whatever its author typed.
 */

/** Clip fields are parts of a clips widget, not widgets someone added. */
const CHILD_TYPE = "clip_display_field";

export interface StoredOverlayItem {
  id: string;
  type: string;
  config: unknown;
}

export interface WidgetRef {
  type: string;
  /** Which custom widget, for `custom_widget` items. */
  customWidgetId?: string;
}

export interface OverlaySaveDiff {
  added: WidgetRef[];
  removed: WidgetRef[];
  /** Types of the widgets whose settings changed, each listed once. */
  reconfiguredTypes: string[];
  reconfiguredCount: number;
  /** Widgets on the overlay after the save. */
  itemCount: number;
}

// Postgres hands jsonb back with its keys in its own order, and JSON drops
// `undefined`. Comparing two configs as written would call every widget
// changed on every save, so both sides are put in one order first.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value === null || typeof value !== "object") return value;
  const source = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    if (source[key] !== undefined) sorted[key] = canonical(source[key]);
  }
  return sorted;
}

function sameConfig(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function widgetRef(item: { type: string; config: unknown }): WidgetRef {
  if (item.type !== "custom_widget") return { type: item.type };
  const widgetId = (item.config as { widget_id?: unknown } | null)?.widget_id;
  return typeof widgetId === "string" && widgetId ? { type: item.type, customWidgetId: widgetId } : { type: item.type };
}

export function diffOverlaySave(save: {
  /** The scene's rows before this save. */
  stored: StoredOverlayItem[];
  deletedIds: string[];
  /** Rows that stayed, with the config as it was written. */
  updated: StoredOverlayItem[];
  inserted: Array<{ type: string; config: unknown }>;
}): OverlaySaveDiff {
  const storedById = new Map(save.stored.map((row) => [row.id, row]));
  const isWidget = (item: { type: string }) => item.type !== CHILD_TYPE;

  const removed = save.deletedIds
    .map((id) => storedById.get(id))
    .filter((row): row is StoredOverlayItem => !!row && isWidget(row))
    .map(widgetRef);

  const reconfigured = save.updated.filter((item) => {
    const before = storedById.get(item.id);
    return isWidget(item) && !!before && !sameConfig(before.config, item.config);
  });

  return {
    added: save.inserted.filter(isWidget).map(widgetRef),
    removed,
    reconfiguredTypes: [...new Set(reconfigured.map((item) => item.type))].sort(),
    reconfiguredCount: reconfigured.length,
    itemCount: save.updated.filter(isWidget).length + save.inserted.filter(isWidget).length,
  };
}
