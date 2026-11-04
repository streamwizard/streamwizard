import { sameConfig } from "./save-diff";

/**
 * Helpers for writing one editor save in as few requests as possible. Not
 * server actions.
 */

/** The parts of an overlay_items row these helpers look at. */
interface ItemRow {
  id: string;
  z_index: number;
}

/**
 * Whether writing `next` would change the stored row. Only the keys of `next`
 * count, so columns the save never writes (created_at, updated_at) are left out.
 *
 * x, y, w, h and friends are `real` columns: Postgres keeps them as 32-bit
 * floats, so 10.3 comes back as the nearest float to it. Numbers are compared
 * at that precision, or every fractional position would look changed on every
 * save. Configs are compared key-order-blind, like the save analytics do.
 */
export function overlayItemRowChanged(stored: object | undefined, next: object): boolean {
  if (!stored) return true;
  const before = stored as Record<string, unknown>;
  for (const [key, value] of Object.entries(next)) {
    const old = before[key];
    if (key === "config") {
      if (!sameConfig(old, value)) return true;
    } else if (typeof value === "number" && typeof old === "number") {
      if (Math.fround(value) !== Math.fround(old)) return true;
    } else if (value !== old) {
      return true;
    }
  }
  return false;
}

/**
 * The scene's rows after a save, put together from what was read before it
 * and what the writes returned, in the order a fresh read gives them
 * (z_index ascending).
 */
export function mergeSavedItemRows<Row extends ItemRow>(
  stored: Row[],
  deletedIds: string[],
  written: Row[],
): Row[] {
  const deleted = new Set(deletedIds);
  const byId = new Map<string, Row>();
  for (const row of stored) if (!deleted.has(row.id)) byId.set(row.id, row);
  for (const row of written) byId.set(row.id, row);
  return [...byId.values()].sort((a, b) => a.z_index - b.z_index);
}
