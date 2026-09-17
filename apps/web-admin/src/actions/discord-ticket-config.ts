"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import {
  createTicketCategory,
  createTicketProduct,
  isActiveCategory,
  isActiveProduct,
  listTicketCategories,
  listTicketProducts,
  removeTicketCategory,
  removeTicketProduct,
  reorderTicketCategories,
  reorderTicketProducts,
  TICKET_ACTIVE_LIMIT,
  TICKET_DESCRIPTION_MAX,
  TICKET_NAME_MAX,
  uniqueTicketSlug,
  updateTicketCategory,
  updateTicketProduct,
} from "@repo/supabase/queries/ticket-config";
import { assertChannel } from "@/lib/discord/api";
import { DashboardError, requireDiscordAdmin, toActionError, type DiscordActionResult } from "@/lib/discord/action";
import { recordChange } from "@/lib/discord/audit";
import { callBot, staleWarning } from "@/lib/discord/bot-bridge";
import { ticketEmojiSchema } from "@/lib/discord/ticket-options";
import { nullableSnowflakeSchema } from "@/schemas/discord";

// Ticket categories and products: what a ticket is filed under and what it is
// about. Every action ends the same way: audit row, bot cache refresh (a
// failed refresh is a warning, the save already landed), revalidate.

const idSchema = z.string().uuid();

const categorySchema = z.object({
  name: z.string().trim().min(1, "Give the category a name.").max(TICKET_NAME_MAX),
  description: z.string().trim().max(TICKET_DESCRIPTION_MAX),
  emoji: ticketEmojiSchema,
  enabled: z.boolean(),
  discordCategoryId: nullableSnowflakeSchema,
});
export type TicketCategoryFormInput = z.infer<typeof categorySchema>;

const productSchema = z.object({
  label: z.string().trim().min(1, "Give the product a name.").max(TICKET_NAME_MAX),
  description: z.string().trim().max(TICKET_DESCRIPTION_MAX),
  emoji: ticketEmojiSchema,
});
export type TicketProductFormInput = z.infer<typeof productSchema>;

const GONE = "That one doesn't exist anymore. Refresh the page?";
const tooMany = (what: string) =>
  `Discord fits ${TICKET_ACTIVE_LIMIT} ${what} in a menu. Archive or remove one first.`;

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new DashboardError(parsed.error.issues[0]?.message ?? "Invalid input");
  return parsed.data;
}

async function finish(guildId: string): Promise<DiscordActionResult> {
  const refreshed = await callBot(guildId, "/cache/tickets");
  revalidatePath("/discord", "layout");
  return { error: null, warning: staleWarning(refreshed) };
}

// Categories ------------------------------------------------------------------

export async function createTicketCategoryAction(input: TicketCategoryFormInput): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const next = parse(categorySchema, input);
    if (next.discordCategoryId) await assertChannel(next.discordCategoryId, ["category"]);

    const existing = await listTicketCategories(supabaseAdmin, guildId);
    if (existing.filter(isActiveCategory).length >= TICKET_ACTIVE_LIMIT) throw new DashboardError(tooMany("categories"));

    const created = await createTicketCategory(supabaseAdmin, guildId, {
      slug: uniqueTicketSlug(
        next.name,
        existing.map((c) => c.slug),
        "category",
      ),
      position: existing.length,
      name: next.name,
      description: next.description,
      emoji: next.emoji,
      enabled: next.enabled,
      discord_category_id: next.discordCategoryId,
    });

    await recordChange({
      userId,
      guildId,
      section: "tickets",
      action: "create",
      after: { category: created.name, slug: created.slug },
    });
    return finish(guildId);
  } catch (error) {
    return toActionError(error, "create ticket category", "Couldn't add the category. Try again?");
  }
}

export async function updateTicketCategoryAction(
  id: string,
  input: TicketCategoryFormInput,
): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const next = parse(categorySchema, input);
    const current = (await listTicketCategories(supabaseAdmin, guildId)).find((c) => c.id === parse(idSchema, id));
    if (!current) throw new DashboardError(GONE);

    // Only a changed id is checked, so a category channel deleted in Discord
    // doesn't block renaming the ticket category that pointed at it.
    if (next.discordCategoryId && next.discordCategoryId !== current.discord_category_id) {
      await assertChannel(next.discordCategoryId, ["category"]);
    }

    const after = {
      name: next.name,
      description: next.description,
      emoji: next.emoji,
      enabled: next.enabled,
      discord_category_id: next.discordCategoryId,
    };
    if (!(await updateTicketCategory(supabaseAdmin, guildId, current.id, after))) throw new DashboardError(GONE);

    await recordChange({
      userId,
      guildId,
      section: "tickets",
      before: {
        name: current.name,
        description: current.description,
        emoji: current.emoji,
        enabled: current.enabled,
        discord_category_id: current.discord_category_id,
      },
      after,
    });
    return finish(guildId);
  } catch (error) {
    return toActionError(error, "update ticket category", "Couldn't save the category. Try again?");
  }
}

export interface RemoveResult extends DiscordActionResult {
  /** "archived" when tickets still use it, so it was hidden instead of deleted. */
  outcome?: "deleted" | "archived";
}

export async function removeTicketCategoryAction(id: string): Promise<RemoveResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const current = (await listTicketCategories(supabaseAdmin, guildId)).find((c) => c.id === parse(idSchema, id));
    if (!current) throw new DashboardError(GONE);

    const outcome = await removeTicketCategory(supabaseAdmin, guildId, current.id);
    if (!outcome) throw new DashboardError(GONE);

    await recordChange({
      userId,
      guildId,
      section: "tickets",
      action: "delete",
      before: { category: current.name, slug: current.slug },
      after: { category: outcome === "archived" ? "archived" : null },
    });
    return { ...(await finish(guildId)), outcome };
  } catch (error) {
    return toActionError(error, "remove ticket category", "Couldn't remove the category. Try again?");
  }
}

export async function restoreTicketCategoryAction(id: string): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const existing = await listTicketCategories(supabaseAdmin, guildId);
    const current = existing.find((c) => c.id === parse(idSchema, id));
    if (!current) throw new DashboardError(GONE);
    if (existing.filter(isActiveCategory).length >= TICKET_ACTIVE_LIMIT) throw new DashboardError(tooMany("categories"));

    await updateTicketCategory(supabaseAdmin, guildId, current.id, { archived_at: null });
    await recordChange({
      userId,
      guildId,
      section: "tickets",
      before: { [`category ${current.name}`]: "archived" },
      after: { [`category ${current.name}`]: "restored" },
    });
    return finish(guildId);
  } catch (error) {
    return toActionError(error, "restore ticket category", "Couldn't restore the category. Try again?");
  }
}

export async function reorderTicketCategoriesAction(orderedIds: string[]): Promise<DiscordActionResult> {
  try {
    const { guildId } = await requireDiscordAdmin();
    await reorderTicketCategories(supabaseAdmin, guildId, parse(z.array(idSchema).max(200), orderedIds));
    return finish(guildId);
  } catch (error) {
    return toActionError(error, "reorder ticket categories", "Couldn't save the new order. Try again?");
  }
}

// Products --------------------------------------------------------------------

export async function createTicketProductAction(input: TicketProductFormInput): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const next = parse(productSchema, input);

    const existing = await listTicketProducts(supabaseAdmin, guildId);
    if (existing.filter(isActiveProduct).length >= TICKET_ACTIVE_LIMIT) throw new DashboardError(tooMany("products"));

    const created = await createTicketProduct(supabaseAdmin, guildId, {
      slug: uniqueTicketSlug(
        next.label,
        existing.map((p) => p.slug),
        "product",
      ),
      position: existing.length,
      ...next,
    });

    await recordChange({
      userId,
      guildId,
      section: "tickets",
      action: "create",
      after: { product: created.label, slug: created.slug },
    });
    return finish(guildId);
  } catch (error) {
    return toActionError(error, "create ticket product", "Couldn't add the product. Try again?");
  }
}

export async function updateTicketProductAction(id: string, input: TicketProductFormInput): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const next = parse(productSchema, input);
    const current = (await listTicketProducts(supabaseAdmin, guildId)).find((p) => p.id === parse(idSchema, id));
    if (!current) throw new DashboardError(GONE);

    if (!(await updateTicketProduct(supabaseAdmin, guildId, current.id, next))) throw new DashboardError(GONE);

    await recordChange({
      userId,
      guildId,
      section: "tickets",
      before: { label: current.label, description: current.description, emoji: current.emoji },
      after: next,
    });
    return finish(guildId);
  } catch (error) {
    return toActionError(error, "update ticket product", "Couldn't save the product. Try again?");
  }
}

export async function removeTicketProductAction(id: string): Promise<RemoveResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const current = (await listTicketProducts(supabaseAdmin, guildId)).find((p) => p.id === parse(idSchema, id));
    if (!current) throw new DashboardError(GONE);

    const outcome = await removeTicketProduct(supabaseAdmin, guildId, current.id);
    if (!outcome) throw new DashboardError(GONE);

    await recordChange({
      userId,
      guildId,
      section: "tickets",
      action: "delete",
      before: { product: current.label, slug: current.slug },
      after: { product: outcome === "archived" ? "archived" : null },
    });
    return { ...(await finish(guildId)), outcome };
  } catch (error) {
    return toActionError(error, "remove ticket product", "Couldn't remove the product. Try again?");
  }
}

export async function restoreTicketProductAction(id: string): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const existing = await listTicketProducts(supabaseAdmin, guildId);
    const current = existing.find((p) => p.id === parse(idSchema, id));
    if (!current) throw new DashboardError(GONE);
    if (existing.filter(isActiveProduct).length >= TICKET_ACTIVE_LIMIT) throw new DashboardError(tooMany("products"));

    await updateTicketProduct(supabaseAdmin, guildId, current.id, { archived_at: null });
    await recordChange({
      userId,
      guildId,
      section: "tickets",
      before: { [`product ${current.label}`]: "archived" },
      after: { [`product ${current.label}`]: "restored" },
    });
    return finish(guildId);
  } catch (error) {
    return toActionError(error, "restore ticket product", "Couldn't restore the product. Try again?");
  }
}

export async function reorderTicketProductsAction(orderedIds: string[]): Promise<DiscordActionResult> {
  try {
    const { guildId } = await requireDiscordAdmin();
    await reorderTicketProducts(supabaseAdmin, guildId, parse(z.array(idSchema).max(200), orderedIds));
    return finish(guildId);
  } catch (error) {
    return toActionError(error, "reorder ticket products", "Couldn't save the new order. Try again?");
  }
}
