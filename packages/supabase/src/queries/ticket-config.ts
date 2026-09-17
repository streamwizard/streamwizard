import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

export type TicketCategory = Database["public"]["Tables"]["discord_ticket_categories"]["Row"];
export type TicketProduct = Database["public"]["Tables"]["discord_ticket_products"]["Row"];

// What a ticket can be filed under (categories) and be about (products). Both
// are edited in web-admin. Tickets store the slug, which never changes once
// created; a row that tickets still point at is archived rather than deleted,
// so old tickets keep their label. Every read and write is scoped to the
// guild, so an id from one server never reaches another's row.

/** Discord fits 25 options in a select menu and 25 buttons on a message. */
export const TICKET_ACTIVE_LIMIT = 25;
export const TICKET_SLUG_MAX = 32;
export const TICKET_NAME_MAX = 45;
export const TICKET_DESCRIPTION_MAX = 100;

/** "Feature request" → "feature_request". Empty when nothing usable is left. */
export function slugifyTicketName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, TICKET_SLUG_MAX)
    .replace(/_+$/, "");
}

/** A slug nothing in `taken` uses yet: "bug", then "bug_2", "bug_3"… */
export function uniqueTicketSlug(name: string, taken: Iterable<string>, fallback: string): string {
  const used = new Set(taken);
  const base = slugifyTicketName(name) || fallback;
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `_${n}`;
    const candidate = `${base.slice(0, TICKET_SLUG_MAX - suffix.length)}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}

/** Shown in the open-a-ticket flow: not archived and, for categories, switched on. */
export const isActiveCategory = (category: TicketCategory) => !category.archived_at && category.enabled;
export const isActiveProduct = (product: TicketProduct) => !product.archived_at;

/** "🐛 Bug" for embeds; the raw slug when the row is gone, "Not set" for none. */
export function ticketOptionLabel(
  option: { emoji: string | null; name?: string; label?: string } | undefined,
  slug: string | null | undefined,
): string {
  if (!option) return slug || "Not set";
  const text = option.name ?? option.label ?? slug ?? "";
  return option.emoji ? `${option.emoji} ${text}` : text;
}

// What a guild starts with. The same rows were backfilled by SQL for guilds
// that had tickets before categories moved into the database (see the
// discord_ticket_config migration); this list is for guilds set up after it.
export const DEFAULT_TICKET_CATEGORIES = [
  { slug: "bug", name: "Bug", description: "Something is broken or not working", emoji: "🐛" },
  { slug: "feature", name: "Feature", description: "Request a new feature or improvement", emoji: "✨" },
  { slug: "support", name: "Support", description: "Get help with using StreamWizard", emoji: "💬" },
  { slug: "other", name: "Other", description: "Anything else", emoji: "📨" },
] as const;

export const DEFAULT_TICKET_PRODUCTS = [
  { slug: "cloud_obs", label: "Cloud OBS", description: "Your OBS in the cloud and the deck", emoji: "☁️" },
  { slug: "overlays", label: "Overlays & widgets", description: "Overlay editor, widgets and alerts", emoji: "🎨" },
  { slug: "clips", label: "Clip management", description: "Clip folders, syncing and search", emoji: "🎬" },
  { slug: "vods", label: "VODs", description: "Past broadcasts and markers", emoji: "📼" },
  { slug: "analytics", label: "Analytics", description: "Stream stats and viewer numbers", emoji: "📊" },
  { slug: "discord_bot", label: "Discord bot", description: "This bot and its commands", emoji: "🤖" },
  { slug: "account", label: "Account & billing", description: "Login, linking and subscriptions", emoji: "👤" },
  { slug: "other", label: "Something else", description: "Not sure, or none of the above", emoji: "❔" },
] as const;

/** All of a guild's categories, archived ones included, in display order. */
export async function listTicketCategories(client: DBClient, guildId: string): Promise<TicketCategory[]> {
  const { data, error } = await client
    .from("discord_ticket_categories")
    .select("*")
    .eq("guild_id", guildId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

/** All of a guild's products, archived ones included, in display order. */
export async function listTicketProducts(client: DBClient, guildId: string): Promise<TicketProduct[]> {
  const { data, error } = await client
    .from("discord_ticket_products")
    .select("*")
    .eq("guild_id", guildId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

export async function getTicketCategory(client: DBClient, guildId: string, id: string): Promise<TicketCategory | null> {
  const { data, error } = await client
    .from("discord_ticket_categories")
    .select("*")
    .eq("guild_id", guildId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export interface TicketCategoryInput {
  name: string;
  description: string;
  emoji: string | null;
  enabled: boolean;
  discord_category_id: string | null;
}

export async function createTicketCategory(
  client: DBClient,
  guildId: string,
  input: TicketCategoryInput & { slug: string; position: number },
): Promise<TicketCategory> {
  const { data, error } = await client
    .from("discord_ticket_categories")
    .insert({ guild_id: guildId, ...input })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Null when the category is gone. The slug is never part of an update. */
export async function updateTicketCategory(
  client: DBClient,
  guildId: string,
  id: string,
  patch: Partial<TicketCategoryInput> & { archived_at?: string | null },
): Promise<TicketCategory | null> {
  const { data, error } = await client
    .from("discord_ticket_categories")
    .update(patch)
    .eq("guild_id", guildId)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

export interface TicketProductInput {
  label: string;
  description: string;
  emoji: string | null;
}

export async function createTicketProduct(
  client: DBClient,
  guildId: string,
  input: TicketProductInput & { slug: string; position: number },
): Promise<TicketProduct> {
  const { data, error } = await client
    .from("discord_ticket_products")
    .insert({ guild_id: guildId, ...input })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTicketProduct(
  client: DBClient,
  guildId: string,
  id: string,
  patch: Partial<TicketProductInput> & { archived_at?: string | null },
): Promise<TicketProduct | null> {
  const { data, error } = await client
    .from("discord_ticket_products")
    .update(patch)
    .eq("guild_id", guildId)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

type ConfigTable = "discord_ticket_categories" | "discord_ticket_products";

// Postgres foreign_key_violation: tickets still point at the row.
const FOREIGN_KEY_VIOLATION = "23503";

/**
 * Deletes a category or product nothing uses, and archives one that tickets
 * still point at, so their label survives. Returns which of the two happened,
 * or null when the row was already gone.
 */
async function removeOrArchive(
  client: DBClient,
  table: ConfigTable,
  guildId: string,
  id: string,
): Promise<"deleted" | "archived" | null> {
  const { data, error } = await client.from(table).delete().eq("guild_id", guildId).eq("id", id).select("id");
  if (!error) return data.length > 0 ? "deleted" : null;
  if (error.code !== FOREIGN_KEY_VIOLATION) throw error;

  const archived = await client
    .from(table)
    .update({ archived_at: new Date().toISOString() })
    .eq("guild_id", guildId)
    .eq("id", id)
    .select("id");
  if (archived.error) throw archived.error;
  return archived.data.length > 0 ? "archived" : null;
}

export const removeTicketCategory = (client: DBClient, guildId: string, id: string) =>
  removeOrArchive(client, "discord_ticket_categories", guildId, id);

export const removeTicketProduct = (client: DBClient, guildId: string, id: string) =>
  removeOrArchive(client, "discord_ticket_products", guildId, id);

/** Writes the display order: position = index in `orderedIds`. Ids from another guild are ignored. */
async function reorder(client: DBClient, table: ConfigTable, guildId: string, orderedIds: string[]): Promise<void> {
  const results = await Promise.all(
    orderedIds.map((id, position) => client.from(table).update({ position }).eq("guild_id", guildId).eq("id", id)),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
}

export const reorderTicketCategories = (client: DBClient, guildId: string, orderedIds: string[]) =>
  reorder(client, "discord_ticket_categories", guildId, orderedIds);

export const reorderTicketProducts = (client: DBClient, guildId: string, orderedIds: string[]) =>
  reorder(client, "discord_ticket_products", guildId, orderedIds);

/**
 * Gives a guild the starting categories and products, once. Guarded by
 * discord_ticket_settings.defaults_seeded_at, so removing every category on
 * purpose doesn't bring them back. Call it from a write path (setup, saving
 * settings), never from a page load. Returns whether anything was seeded.
 */
export async function ensureTicketDefaults(client: DBClient, guildId: string): Promise<boolean> {
  const { data: settings, error } = await client
    .from("discord_ticket_settings")
    .select("defaults_seeded_at")
    .eq("guild_id", guildId)
    .maybeSingle();
  if (error) throw error;
  if (settings?.defaults_seeded_at) return false;

  const categories = await client.from("discord_ticket_categories").upsert(
    DEFAULT_TICKET_CATEGORIES.map((category, position) => ({ guild_id: guildId, position, ...category })),
    { onConflict: "guild_id,slug", ignoreDuplicates: true },
  );
  if (categories.error) throw categories.error;

  const products = await client.from("discord_ticket_products").upsert(
    DEFAULT_TICKET_PRODUCTS.map((product, position) => ({ guild_id: guildId, position, ...product })),
    { onConflict: "guild_id,slug", ignoreDuplicates: true },
  );
  if (products.error) throw products.error;

  const stamped = await client
    .from("discord_ticket_settings")
    .upsert({ guild_id: guildId, defaults_seeded_at: new Date().toISOString() }, { onConflict: "guild_id" });
  if (stamped.error) throw stamped.error;
  return true;
}
