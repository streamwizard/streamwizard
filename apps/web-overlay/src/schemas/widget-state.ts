import { z } from "zod";

/**
 * Per-placement widget state (/api/widgets/state): one JSON object per placed
 * widget, read on every overlay load.
 *
 * 16 KiB is twice the 8 KiB a single channel-state value may hold
 * (/api/widgets/user-state). A placement keeps all of its keys in this one
 * object, so it gets room for a handful of values, while staying small enough
 * to load with the overlay.
 */
export const MAX_WIDGET_STATE_BYTES = 16 * 1024;

/**
 * The state plus an item id, an optional token and the JSON around them.
 * Checked before parsing so a huge body never becomes an object.
 */
export const MAX_WIDGET_STATE_BODY_BYTES = MAX_WIDGET_STATE_BYTES + 1024;

const MAX_STATE_KEY_LENGTH = 64;

export const widgetItemIdSchema = z.uuid();

/** A plain object of JSON values; arrays, primitives and null are refused. */
export const widgetStateSchema = z.record(z.string().max(MAX_STATE_KEY_LENGTH), z.json());

export const widgetStateWriteSchema = z.object({
  itemId: widgetItemIdSchema,
  state: widgetStateSchema,
});

/** UTF-8 size of the state as it will be stored. */
export function widgetStateBytes(state: z.infer<typeof widgetStateSchema>): number {
  return Buffer.byteLength(JSON.stringify(state), "utf8");
}
