import { guidSchema } from "@repo/schemas/ids";
import { z } from "zod";

/** Per source file (html, js, css) of a custom widget. */
export const MAX_WIDGET_SOURCE_CHARS = 500_000;

const MAX_WIDGET_FIELDS = 200;
const MAX_WIDGET_TAGS = 20;

const widgetName = z.string().trim().min(1, "Give the widget a name").max(200, "Keep the name under 200 characters");
const widgetDescription = z.string().max(2000, "Keep the description under 2000 characters");
const widgetSource = z.string().max(MAX_WIDGET_SOURCE_CHARS, "That source file is too long");
const widgetTags = z.array(z.string().max(50)).max(MAX_WIDGET_TAGS, `Use at most ${MAX_WIDGET_TAGS} tags`);

/**
 * The editor's field definitions (WidgetFieldSchema). Only bounded here; the
 * editor and renderer read each definition defensively.
 */
export const widgetFieldsSchema = z
  .record(z.string().max(100), z.unknown())
  .refine((fields) => Object.keys(fields).length <= MAX_WIDGET_FIELDS, `Use at most ${MAX_WIDGET_FIELDS} fields`);

const widgetSourceShape = {
  description: widgetDescription,
  html: widgetSource,
  js: widgetSource,
  extra_css: widgetSource,
  fields: widgetFieldsSchema,
  tags: widgetTags,
};

export const createWidgetSchema = z.object({ name: widgetName, ...widgetSourceShape }).partial().required({ name: true });

export const updateWidgetSchema = z.object({
  id: guidSchema,
  updates: z.object({ name: widgetName, ...widgetSourceShape }).partial(),
});

/** Ids read out of overlay item configs; anything that isn't a uuid can't match a row and is dropped. */
export const widgetIdsSchema = z
  .array(z.string().max(100))
  .max(500)
  .transform((ids) => [...new Set(ids)].filter((id) => guidSchema.safeParse(id).success));

export const widgetInstanceSchema = z.object({ overlayItemId: guidSchema, widgetId: guidSchema });

export const publishWidgetSchema = z.object({
  widgetId: guidSchema,
  title: z.string().trim().min(1, "Give the listing a title").max(200, "Keep the title under 200 characters"),
  description: widgetDescription,
  tags: widgetTags,
});
