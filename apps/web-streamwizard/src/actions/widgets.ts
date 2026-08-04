"use server";

import { reportError } from "@repo/sentry";

import { getAuthContext } from "@/lib/auth";
import { createAdminClient } from "@repo/supabase/next/admin";
import {
  getWidgetTemplates as _getWidgetTemplates,
  getWidgetTemplateById,
} from "@repo/supabase/queries/overlay-templates";
import { revalidatePath } from "next/cache";
import type { WidgetFieldSchema } from "@repo/ui/overlay";

async function requireAdminContext() {
  const { user } = await getAuthContext();
  if (user.app_metadata?.is_admin !== true) throw new Error("Forbidden");
  return createAdminClient();
}

export interface Widget {
  id: string;
  user_id: string;
  name: string;
  description: string;
  html: string;
  js: string;
  extra_css: string;
  fields: WidgetFieldSchema;
  preview_url: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface WidgetLibraryEntry {
  id: string;
  widget_id: string;
  user_id: string;
  title: string;
  description: string;
  tags: string[];
  likes: number;
  installs: number;
  is_approved: boolean;
  created_at: string;
}

export interface OverlayWidgetInstance {
  id: string;
  overlay_item_id: string;
  widget_id: string;
  user_id: string;
  field_values: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// --- Widget CRUD ---

export async function getWidgets() {
  let supabase, user;
  try {
    ({ supabase, user } = await getAuthContext());
  } catch {
    return { data: null, error: "Unauthorized" };
  }
  const { data, error } = await supabase
    .from("overlay_widgets")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  if (error) reportError(error, "actions/widgets");
  return { data: data as unknown as Widget[] | null, error: error?.message ?? null };
}

export async function getWidget(id: string) {
  let supabase, user;
  try {
    ({ supabase, user } = await getAuthContext());
  } catch {
    return { data: null, error: "Unauthorized" };
  }
  const { data, error } = await supabase
    .from("overlay_widgets")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (error) reportError(error, "actions/widgets");
  return { data: data as unknown as Widget | null, error: error?.message ?? null };
}

/** Batch form of getWidget, for warming a whole scene's widgets in one trip. */
export async function getWidgetsByIds(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return { data: [] as Widget[], error: null };

  let supabase, user;
  try {
    ({ supabase, user } = await getAuthContext());
  } catch {
    return { data: null, error: "Unauthorized" };
  }
  const { data, error } = await supabase
    .from("overlay_widgets")
    .select("*")
    .eq("user_id", user.id)
    .in("id", unique);
  if (error) reportError(error, "actions/widgets");
  return { data: data as unknown as Widget[] | null, error: error?.message ?? null };
}

export async function createWidget(input: {
  name: string;
  description?: string;
  html?: string;
  js?: string;
  extra_css?: string;
  fields?: WidgetFieldSchema;
  tags?: string[];
}) {
  let supabase, user;
  try {
    ({ supabase, user } = await getAuthContext());
  } catch {
    return { data: null, error: "Unauthorized" };
  }
  const { data, error } = await supabase
    .from("overlay_widgets")
    .insert({
      user_id: user.id,
      name: input.name,
      description: input.description ?? "",
      html: input.html ?? "",
      js: input.js ?? "",
      extra_css: input.extra_css ?? "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fields: (input.fields ?? {}) as any,
      tags: input.tags ?? [],
    })
    .select()
    .single();
  revalidatePath("/dashboard/widget-library");
  if (error) reportError(error, "actions/widgets");
  return { data: data as unknown as Widget | null, error: error?.message ?? null };
}

export async function updateWidget(
  id: string,
  updates: Partial<{
    name: string;
    description: string;
    html: string;
    js: string;
    extra_css: string;
    fields: WidgetFieldSchema;
    tags: string[];
  }>
) {
  let supabase, user;
  try {
    ({ supabase, user } = await getAuthContext());
  } catch {
    return { error: "Unauthorized" };
  }
  const { error } = await supabase
    .from("overlay_widgets")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ ...updates, updated_at: new Date().toISOString() } as any)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) reportError(error, "actions/widgets");
  return { error: error?.message ?? null };
}

export async function deleteWidget(id: string) {
  let supabase, user;
  try {
    ({ supabase, user } = await getAuthContext());
  } catch {
    return { error: "Unauthorized" };
  }
  const { error } = await supabase
    .from("overlay_widgets")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath("/dashboard/widget-library");
  if (error) reportError(error, "actions/widgets");
  return { error: error?.message ?? null };
}

// --- Overlay Widget Instances ---

export async function getOrCreateWidgetInstance(
  overlayItemId: string,
  widgetId: string
) {
  let supabase, user;
  try {
    ({ supabase, user } = await getAuthContext());
  } catch {
    return { data: null, error: "Unauthorized" };
  }
  const { data: existing } = await supabase
    .from("overlay_widget_instances")
    .select("*")
    .eq("overlay_item_id", overlayItemId)
    .eq("user_id", user.id)
    .single();
  if (existing) return { data: existing as OverlayWidgetInstance, error: null };

  const { data, error } = await supabase
    .from("overlay_widget_instances")
    .insert({
      overlay_item_id: overlayItemId,
      widget_id: widgetId,
      user_id: user.id,
      field_values: {},
    })
    .select()
    .single();
  if (error) reportError(error, "actions/widgets");
  return { data: data as unknown as OverlayWidgetInstance | null, error: error?.message ?? null };
}

// --- Library ---

export async function getApprovedLibraryEntries(opts?: {
  search?: string;
  tags?: string[];
}) {
  let supabase;
  try {
    ({ supabase } = await getAuthContext());
  } catch {
    return { data: null, error: "Unauthorized" };
  }
  let query = supabase
    .from("overlay_widget_library_entries")
    .select("*, overlay_widgets(*)")
    .eq("is_approved", true)
    .order("installs", { ascending: false });

  if (opts?.search) {
    query = query.or(`title.ilike.%${opts.search}%,description.ilike.%${opts.search}%`);
  }
  const { data, error } = await query;
  if (error) reportError(error, "actions/widgets");
  return { data, error: error?.message ?? null };
}

export async function publishWidgetToLibrary(
  widgetId: string,
  input: { title: string; description: string; tags: string[] }
) {
  let supabase, user;
  try {
    ({ supabase, user } = await getAuthContext());
  } catch {
    return { error: "Unauthorized" };
  }
  const { error } = await supabase.from("overlay_widget_library_entries").insert({
    widget_id: widgetId,
    user_id: user.id,
    title: input.title,
    description: input.description,
    tags: input.tags,
    is_approved: false,
  });
  if (error) reportError(error, "actions/widgets");
  return { error: error?.message ?? null };
}

export interface WidgetTemplate {
  id: string;
  slug: string;
  name: string;
  description: string;
  tags: string[];
}

/**
 * Widget templates, shown as the library's Starters tab. Source (html/js/css/fields) is deliberately left
 * out — installing copies it server-side, so the client never needs it.
 */
export async function getWidgetTemplates() {
  let supabase;
  try {
    ({ supabase } = await getAuthContext());
  } catch {
    return { data: null, error: "Unauthorized" };
  }

  const { data, error } = await _getWidgetTemplates(supabase);
  if (error) {
    reportError(error, "actions/widgets");
    return { data: null, error: error.message };
  }

  return {
    data: (data ?? []).map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      description: s.description,
      tags: s.tags,
    })) satisfies WidgetTemplate[],
    error: null,
  };
}

/** Copy a widget template into an `overlay_widgets` row the user owns and can edit. */
export async function installWidgetTemplate(templateId: string) {
  let supabase, user;
  try {
    ({ supabase, user } = await getAuthContext());
  } catch {
    return { data: null, error: "Unauthorized" };
  }

  const { data: widgetTemplate, error: templateError } = await getWidgetTemplateById(supabase, templateId);
  if (templateError) {
    reportError(templateError, "actions/widgets");
    return { data: null, error: templateError.message };
  }
  if (!widgetTemplate) return { data: null, error: "Widget template not found" };

  const { data: installed, error: installError } = await supabase
    .from("overlay_widgets")
    .insert({
      user_id: user.id,
      name: widgetTemplate.name,
      description: widgetTemplate.description,
      html: widgetTemplate.html,
      js: widgetTemplate.js,
      extra_css: widgetTemplate.extra_css,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fields: widgetTemplate.fields as any,
      tags: widgetTemplate.tags,
    })
    .select()
    .single();

  if (installError) {
    reportError(installError, "actions/widgets");
    return { data: null, error: installError.message };
  }

  return { data: installed as unknown as Widget, error: null };
}

export async function installWidgetFromLibrary(entryId: string) {
  let supabase, user;
  try {
    ({ supabase, user } = await getAuthContext());
  } catch {
    return { data: null, error: "Unauthorized" };
  }

  const { data: entry, error: entryError } = await supabase
    .from("overlay_widget_library_entries")
    .select("*, overlay_widgets(*)")
    .eq("id", entryId)
    .eq("is_approved", true)
    .single();

  if (entryError || !entry) {
    return { data: null, error: entryError?.message ?? "Entry not found" };
  }

  const source = (entry as unknown as { overlay_widgets: Widget }).overlay_widgets;

  const { data: forked, error: forkError } = await supabase
    .from("overlay_widgets")
    .insert({
      user_id: user.id,
      name: source.name,
      description: source.description,
      html: source.html,
      js: source.js,
      extra_css: source.extra_css,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fields: source.fields as any,
      tags: source.tags,
    })
    .select()
    .single();

  if (forkError) {
    reportError(forkError, "actions/widgets");
    return { data: null, error: forkError.message };
  }

  await supabase.rpc("increment_widget_installs", { entry_id: entryId });

  revalidatePath("/dashboard/widget-library");
  return { data: forked as unknown as Widget, error: null };
}

// --- Admin moderation ---

export async function getPendingLibraryEntries() {
  let adminClient;
  try {
    adminClient = await requireAdminContext();
  } catch {
    return { data: null, error: "Forbidden" };
  }
  const { data, error } = await adminClient
    .from("overlay_widget_library_entries")
    .select("*, overlay_widgets(*)")
    .eq("is_approved", false)
    .order("created_at", { ascending: true });
  if (error) reportError(error, "actions/widgets");
  return { data, error: error?.message ?? null };
}

export async function approveLibraryEntry(entryId: string) {
  let adminClient;
  try {
    adminClient = await requireAdminContext();
  } catch {
    return { error: "Forbidden" };
  }
  const { error } = await adminClient
    .from("overlay_widget_library_entries")
    .update({ is_approved: true })
    .eq("id", entryId);
  revalidatePath("/dashboard/admin/widget-library");
  if (error) reportError(error, "actions/widgets");
  return { error: error?.message ?? null };
}

export async function rejectLibraryEntry(entryId: string) {
  let adminClient;
  try {
    adminClient = await requireAdminContext();
  } catch {
    return { error: "Forbidden" };
  }
  const { error } = await adminClient
    .from("overlay_widget_library_entries")
    .delete()
    .eq("id", entryId);
  revalidatePath("/dashboard/admin/widget-library");
  if (error) reportError(error, "actions/widgets");
  return { error: error?.message ?? null };
}
