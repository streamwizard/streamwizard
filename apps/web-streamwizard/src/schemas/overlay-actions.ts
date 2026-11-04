import { guidSchema } from "@repo/schemas/ids";
import { z } from "zod";
import {
  clipsWidgetItemConfigSchema,
  createSceneSchema,
  overlayItemGroupSchema,
} from "@repo/ui/overlay-schemas";

// Arguments of the overlay server actions. Item and config shapes themselves
// live in @repo/ui/overlay-schemas (re-exported from ./overlay).

export const renderModeSchema = z.enum(["obs", "gps"]);

export const createSceneInputSchema = createSceneSchema.extend({
  render_mode: renderModeSchema.optional(),
});

export const createFromTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  // The template's slug ("starting-soon"), not its uuid.
  templateId: z.string().min(1).max(100),
  render_mode: renderModeSchema.optional(),
});

/** Guards the editor's save against a payload far past anything the editor builds. */
const MAX_SAVED_ITEMS = 500;
const MAX_SAVED_GROUPS = 500;

/**
 * The outer shape of a save. Each item is checked against `overlayItemSchema`
 * as it is written, so here it only has to carry its temp id.
 */
export const saveOverlayItemsSchema = z.object({
  sceneId: guidSchema,
  items: z.array(z.looseObject({ temp_id: z.string().max(100) })).max(MAX_SAVED_ITEMS),
  groups: z.array(overlayItemGroupSchema.omit({ scene_id: true })).max(MAX_SAVED_GROUPS),
});

/** Server actions take at most 1MB, and an export is plain JSON text. */
export const overlayImportTextSchema = z.string().min(1).max(1024 * 1024);

/** The filters the editor's clip preview reads; the rest of the widget config is ignored. */
export const previewClipsConfigSchema = clipsWidgetItemConfigSchema
  .pick({ timeWindow: true, customDateRange: true, sort: true, minViewCount: true, isFeaturedOnly: true })
  .extend({
    folderIds: z.array(guidSchema).max(200),
    gameIds: z.array(z.string().max(32)).max(200),
    creatorIds: z.array(z.string().max(32)).max(200),
  });

const testId = z.string().regex(/^[\w-]{1,64}$/);

export const testOverlayEventSchema = z.object({
  // Checked against the demo catalogue (the allowlist) in the action.
  event: z.string().max(100),
  customPayload: z.unknown().optional(),
  variant: z.string().max(100).optional(),
  forceVariation: z.object({ itemId: testId, variationId: testId }).optional(),
});
