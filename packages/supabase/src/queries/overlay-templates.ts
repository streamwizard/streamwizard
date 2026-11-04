import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

export type OverlayTemplateRow = Database["public"]["Tables"]["overlay_templates"]["Row"];
export type OverlayTemplateItemRow = Database["public"]["Tables"]["overlay_template_items"]["Row"];
type WidgetTemplateRow = Database["public"]["Tables"]["overlay_widget_templates"]["Row"];

/** The library's Starters tab: catalog facts only, never the widget source. */
export const WIDGET_TEMPLATE_SUMMARY_COLUMNS = "id, slug, name, description, tags" as const;

/** Installing a widget template copies its source (see OverlayWidgetSource). */
export const WIDGET_TEMPLATE_SOURCE_COLUMNS = "id, name, description, html, js, extra_css, fields, tags" as const;

export type WidgetTemplateSource = Pick<
  WidgetTemplateRow,
  "id" | "name" | "description" | "html" | "js" | "extra_css" | "fields" | "tags"
>;

/** Published templates for the "start from" picker, in catalog order. */
export async function getOverlayTemplates(client: DBClient) {
  return client
    .from("overlay_templates")
    .select("*")
    .eq("is_published", true)
    .order("sort_order", { ascending: true });
}

/**
 * One template plus its items. Items come back in sort_order so the caller can
 * rely on index-to-item alignment when it wires up widget templates afterwards.
 */
export async function getOverlayTemplateBySlug(client: DBClient, slug: string) {
  const { data: template, error: templateError } = await client
    .from("overlay_templates")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (templateError) return { template: null, items: null, error: templateError };
  if (!template) return { template: null, items: null, error: null };

  const { data: items, error: itemsError } = await client
    .from("overlay_template_items")
    .select("*")
    .eq("template_id", template.id)
    .order("sort_order", { ascending: true });

  if (itemsError) return { template: null, items: null, error: itemsError };
  return { template, items: items ?? [], error: null };
}

/** Published widget templates for the library's Starters tab, without their source. */
export async function getWidgetTemplateSummaries(client: DBClient) {
  return client
    .from("overlay_widget_templates")
    .select(WIDGET_TEMPLATE_SUMMARY_COLUMNS)
    .eq("is_published", true)
    .order("sort_order", { ascending: true });
}

export async function getWidgetTemplateById(client: DBClient, id: string) {
  return client
    .from("overlay_widget_templates")
    .select(WIDGET_TEMPLATE_SOURCE_COLUMNS)
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();
}

export async function getWidgetTemplateBySlug(client: DBClient, slug: string) {
  return client
    .from("overlay_widget_templates")
    .select(WIDGET_TEMPLATE_SOURCE_COLUMNS)
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
}

/** Widget templates referenced by an overlay template's items. */
export async function getWidgetTemplatesByIds(client: DBClient, ids: string[]) {
  return client.from("overlay_widget_templates").select(WIDGET_TEMPLATE_SOURCE_COLUMNS).in("id", ids).eq("is_published", true);
}
