import { supabase } from "@repo/supabase";
import {
  ensureTicketDefaults,
  isActiveCategory,
  isActiveProduct,
  listTicketCategories,
  listTicketFormFields,
  listTicketProducts,
  type TicketCategory,
  type TicketFormField,
  type TicketProduct,
} from "@repo/supabase/queries/ticket-config";
import { getTicketSettings, upsertTicketSettings, type DiscordTicketSettings } from "@repo/supabase/queries/tickets";
import { TtlCache } from "@repo/ttl-cache";

// Everything web-admin configures about tickets, in one cached read. Button
// clicks and modal submits hit this instead of the database; web-admin drops
// it through POST /cache/tickets after a save, so the TTL is only the fallback
// for a save the bot never heard about.

const CONFIG_TTL_MS = 60 * 1000;

export interface TicketConfig {
  settings: DiscordTicketSettings | null;
  /** Every category, archived ones included: old tickets still need their label. */
  categories: TicketCategory[];
  products: TicketProduct[];
  /** Each category's form, by category id, in form order. */
  fields: Map<string, TicketFormField[]>;
}

const cache = new TtlCache<TicketConfig>({ ttlMs: CONFIG_TTL_MS });

export async function getTicketConfig(guildId: string): Promise<TicketConfig> {
  const config = await cache.fetch(guildId, async () => {
    const [settings, categories, products, fields] = await Promise.all([
      getTicketSettings(supabase, guildId),
      listTicketCategories(supabase, guildId),
      listTicketProducts(supabase, guildId),
      listTicketFormFields(supabase, guildId),
    ]);
    return { settings, categories, products, fields };
  });
  return config ?? { settings: null, categories: [], products: [], fields: new Map() };
}

export const categoryFields = (config: TicketConfig, category: TicketCategory): TicketFormField[] =>
  config.fields.get(category.id) ?? [];

export function invalidateTicketConfig(guildId: string): void {
  cache.delete(guildId);
}

/** The bot's own settings writes (setup, the panel location) go through here so the cache never serves the old row. */
export async function saveTicketSettings(
  guildId: string,
  patch: Parameters<typeof upsertTicketSettings>[2],
): Promise<DiscordTicketSettings> {
  const saved = await upsertTicketSettings(supabase, guildId, patch);
  // First settings write for a guild: give it the starting categories and products.
  if (!saved.defaults_seeded_at) await ensureTicketDefaults(supabase, guildId);
  invalidateTicketConfig(guildId);
  return saved;
}

/** Categories a member can open a ticket in, in display order. */
export const activeCategories = (config: TicketConfig) => config.categories.filter(isActiveCategory);
export const activeProducts = (config: TicketConfig) => config.products.filter(isActiveProduct);

export const findCategory = (config: TicketConfig, slug: string | null | undefined) =>
  config.categories.find((category) => category.slug === slug);
export const findProduct = (config: TicketConfig, slug: string | null | undefined) =>
  config.products.find((product) => product.slug === slug);

/** Whether members can open tickets at all: switched on, with a staff role. Where the channel goes is per category. */
export function ticketsReady(settings: DiscordTicketSettings | null): settings is DiscordTicketSettings & {
  staff_role_id: string;
} {
  return Boolean(settings?.enabled && settings.staff_role_id);
}
