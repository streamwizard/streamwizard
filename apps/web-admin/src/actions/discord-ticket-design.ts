"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  TICKET_OPENING_MAX_EMBEDS,
  TICKET_OPENING_VARIABLES,
  TICKET_PANEL_VARIABLES,
  ticketOpeningSchema,
  ticketPanelSchema,
  validateMessage,
  type BuiltMessage,
  type TicketPanel,
} from "@repo/discord-message";
import type { Json } from "@repo/supabase";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import {
  getTicketCategory,
  listCategoryFormFields,
  saveCategoryForm,
  setCategoryOpeningMessage,
  SINGLE_TICKET_FIELD_KINDS,
  TICKET_FIELD_KINDS,
  TICKET_FIELD_LABEL_MAX,
  TICKET_FIELD_PLACEHOLDER_MAX,
  TICKET_FIELD_TEXT_MAX,
  TICKET_FORM_MAX_FIELDS,
  TICKET_SELECT_MAX_OPTIONS,
  TICKET_SELECT_OPTION_MAX,
} from "@repo/supabase/queries/ticket-config";
import { getTicketSettings, upsertTicketSettings } from "@repo/supabase/queries/tickets";
import { DashboardError, requireDiscordAdmin, toActionError, type DiscordActionResult } from "@/lib/discord/action";
import { recordChange } from "@/lib/discord/audit";
import { callBot, staleWarning } from "@/lib/discord/bot-bridge";
import { ticketEmojiSchema } from "@/lib/discord/ticket-options";

// What a ticket looks like from the member's side: the form a category asks,
// the message its channel opens with, and the panel tickets are opened from.

const idSchema = z.string().uuid();
const GONE = "That category doesn't exist anymore. Refresh the page?";

function parse<T>(schema: z.ZodType<T>, input: unknown, fallback = "Invalid input"): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new DashboardError(parsed.error.issues[0]?.message ?? fallback);
  return parsed.data;
}

// Form ------------------------------------------------------------------------

const optionSchema = z.object({
  label: z.string().trim().min(1, "Every option needs a label.").max(TICKET_SELECT_OPTION_MAX),
  value: z.string().trim().min(1).max(TICKET_SELECT_OPTION_MAX),
  description: z.string().trim().max(TICKET_SELECT_OPTION_MAX).optional(),
  emoji: ticketEmojiSchema.optional(),
});

const fieldSchema = z
  .object({
    id: idSchema.optional(),
    kind: z.enum(TICKET_FIELD_KINDS),
    label: z.string().trim().min(1, "Every question needs a label.").max(TICKET_FIELD_LABEL_MAX),
    placeholder: z.string().trim().max(TICKET_FIELD_PLACEHOLDER_MAX),
    style: z.enum(["short", "paragraph"]),
    required: z.boolean(),
    minLength: z.number().int().min(0).max(TICKET_FIELD_TEXT_MAX).nullable(),
    maxLength: z.number().int().min(1).max(TICKET_FIELD_TEXT_MAX).nullable(),
    options: z.array(optionSchema).max(TICKET_SELECT_MAX_OPTIONS),
  })
  .refine((f) => f.minLength === null || f.maxLength === null || f.minLength <= f.maxLength, {
    message: "A question's shortest answer can't be longer than its longest.",
  })
  .refine((f) => f.kind !== "select" || f.options.length > 0, { message: "A dropdown needs at least one option." })
  .refine((f) => new Set(f.options.map((o) => o.value)).size === f.options.length, {
    message: "Two options of a dropdown are the same.",
  });

const formSchema = z
  .array(fieldSchema)
  .max(TICKET_FORM_MAX_FIELDS, `A Discord form holds ${TICKET_FORM_MAX_FIELDS} questions at most.`)
  .refine((fields) => SINGLE_TICKET_FIELD_KINDS.every((kind) => fields.filter((f) => f.kind === kind).length <= 1), {
    message: "Subject, description and product can each be asked once.",
  });

export type TicketFormFieldDraft = z.input<typeof fieldSchema>;

export async function saveTicketCategoryFormAction(
  categoryId: string,
  fields: TicketFormFieldDraft[],
): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const category = await getTicketCategory(supabaseAdmin, guildId, parse(idSchema, categoryId));
    if (!category) throw new DashboardError(GONE);
    const next = parse(formSchema, fields);

    const current = await listCategoryFormFields(supabaseAdmin, category.id);
    const known = new Map(current.map((field) => [field.id, field]));
    for (const field of next) {
      // An id from another category, or a changed kind, would detach old answers from what they answered.
      const existing = field.id ? known.get(field.id) : undefined;
      if (field.id && !existing) throw new DashboardError("That form changed in another tab. Refresh the page?");
      if (existing && existing.kind !== field.kind) throw new DashboardError("A question can't change type. Add a new one instead.");
    }

    await saveCategoryForm(
      supabaseAdmin,
      category.id,
      next.map((field) => ({
        id: field.id,
        kind: field.kind,
        label: field.label,
        placeholder: field.placeholder,
        // Only free text has a style and lengths; a dropdown has options.
        style: field.kind === "select" || field.kind === "product" ? "short" : field.style,
        required: field.required,
        min_length: field.kind === "select" || field.kind === "product" ? null : field.minLength,
        max_length: field.kind === "select" || field.kind === "product" ? null : field.maxLength,
        options:
          field.kind === "select"
            ? field.options.map((o) => ({ label: o.label, value: o.value, description: o.description, emoji: o.emoji ?? null }))
            : [],
      })),
    );

    const summary = (list: { kind: string; label: string }[]) => list.map((f) => `${f.label} (${f.kind})`);
    await recordChange({
      userId,
      guildId,
      section: "tickets",
      before: { [`${category.name} form`]: summary(current) },
      after: { [`${category.name} form`]: summary(next) },
    });
    const refreshed = await callBot(guildId, "/cache/tickets");
    revalidatePath("/discord", "layout");
    return { error: null, warning: staleWarning(refreshed) };
  } catch (error) {
    return toActionError(error, "save ticket form", "Couldn't save the form. Try again?");
  }
}

// Opening message -------------------------------------------------------------

function assertSendable(message: BuiltMessage, options: Parameters<typeof validateMessage>[1]): void {
  const issue = validateMessage(message, options)[0];
  if (issue) throw new DashboardError(issue.message);
}

/** `null` clears it: the ticket card then opens the channel on its own. */
export async function saveTicketOpeningMessageAction(
  categoryId: string,
  message: BuiltMessage | null,
): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const category = await getTicketCategory(supabaseAdmin, guildId, parse(idSchema, categoryId));
    if (!category) throw new DashboardError(GONE);

    const next = message && message.elements.length > 0 ? parse(ticketOpeningSchema, message) : null;
    if (next) {
      assertSendable(next, {
        maxElements: TICKET_OPENING_MAX_EMBEDS,
        allowedVariables: TICKET_OPENING_VARIABLES.map((v) => v.key),
      });
    }

    if (!(await setCategoryOpeningMessage(supabaseAdmin, guildId, category.id, next as Json))) throw new DashboardError(GONE);

    await recordChange({
      userId,
      guildId,
      section: "tickets",
      before: { [`${category.name} opening message`]: category.opening_message ? "custom" : "none" },
      after: { [`${category.name} opening message`]: next ? `custom, saved ${new Date().toISOString()}` : "none" },
    });
    const refreshed = await callBot(guildId, "/cache/tickets");
    revalidatePath("/discord", "layout");
    return { error: null, warning: staleWarning(refreshed) };
  } catch (error) {
    return toActionError(error, "save ticket opening message", "Couldn't save the opening message. Try again?");
  }
}

// Panel -----------------------------------------------------------------------

const panelInputSchema = ticketPanelSchema.extend({ buttonEmoji: ticketEmojiSchema });

/** Saves the design, then has the bot bring the posted panel in line with it. */
export async function saveTicketPanelAction(panel: TicketPanel): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const next = parse(panelInputSchema, panel);
    assertSendable(next.message, { allowedVariables: TICKET_PANEL_VARIABLES.map((v) => v.key) });

    const current = await getTicketSettings(supabaseAdmin, guildId);
    await upsertTicketSettings(supabaseAdmin, guildId, { panel: next as unknown as Json });

    await recordChange({
      userId,
      guildId,
      section: "tickets",
      before: { panel: current?.panel ? "custom" : "default" },
      after: { panel: `custom, ${next.layout} layout, saved ${new Date().toISOString()}` },
    });

    // The bot re-reads the settings and edits the posted panel in place. With
    // no panel channel yet there is nothing to update; it is posted when one is picked.
    let warning: string | null = null;
    if (current?.panel_channel_id) {
      const posted = await callBot(guildId, "/ticket-panel", {}, { timeoutMs: 60_000 });
      if (!posted.ok) warning = `Saved, but the panel in Discord wasn't updated (${posted.error}).`;
    } else {
      warning = staleWarning(await callBot(guildId, "/cache/tickets"));
    }
    revalidatePath("/discord", "layout");
    return { error: null, warning };
  } catch (error) {
    return toActionError(error, "save ticket panel", "Couldn't save the panel. Try again?");
  }
}
