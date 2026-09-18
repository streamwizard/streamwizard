"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CORE_VARIABLES, findUnknownVariables } from "@repo/discord-message";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import {
  createTicketTag,
  deleteTicketTag,
  listTicketTags,
  normaliseTagKeywords,
  reorderTicketTags,
  TICKET_TAG_CONTENT_MAX,
  TICKET_TAG_KEYWORD_MAX,
  TICKET_TAG_KEYWORDS_MAX,
  TICKET_TAG_NAME_PATTERN,
  updateTicketTag,
} from "@repo/supabase/queries/ticket-tags";
import { DashboardError, requireDiscordAdmin, toActionError, type DiscordActionResult } from "@/lib/discord/action";
import { recordChange } from "@/lib/discord/audit";
import { callBot, staleWarning } from "@/lib/discord/bot-bridge";

// Tags: canned answers for /tag and keyword auto-replies. Same ending as the
// other ticket config actions: audit row, bot cache refresh, revalidate.

const idSchema = z.string().uuid();

const tagSchema = z.object({
  name: z
    .string()
    .trim()
    .toLowerCase()
    .regex(TICKET_TAG_NAME_PATTERN, "Names are lowercase letters, digits, dashes and underscores, up to 32 characters."),
  content: z.string().trim().min(1, "Write the answer first.").max(TICKET_TAG_CONTENT_MAX),
  triggerKeywords: z.array(z.string().trim().max(TICKET_TAG_KEYWORD_MAX)).max(TICKET_TAG_KEYWORDS_MAX, `At most ${TICKET_TAG_KEYWORDS_MAX} keywords.`),
  autoReply: z.boolean(),
});
export type TicketTagFormInput = z.infer<typeof tagSchema>;

const GONE = "That tag doesn't exist anymore. Refresh the page?";
const ALLOWED_VARIABLES = CORE_VARIABLES.map((v) => v.key);

function parse(input: unknown): TicketTagFormInput {
  const parsed = tagSchema.safeParse(input);
  if (!parsed.success) throw new DashboardError(parsed.error.issues[0]?.message ?? "Invalid input");
  const unknown = findUnknownVariables(parsed.data.content, ALLOWED_VARIABLES);
  if (unknown.length > 0) throw new DashboardError(`Unknown placeholder ${unknown.map((u) => `[${u}]`).join(", ")}.`);
  if (parsed.data.autoReply && normaliseTagKeywords(parsed.data.triggerKeywords).length === 0) {
    throw new DashboardError("Auto-reply needs at least one keyword.");
  }
  return parsed.data;
}

async function finish(guildId: string): Promise<DiscordActionResult> {
  revalidatePath("/discord", "layout");
  return { error: null, warning: staleWarning(await callBot(guildId, "/cache/tickets")) };
}

const toRow = (input: TicketTagFormInput) => ({
  name: input.name,
  content: input.content,
  trigger_keywords: input.triggerKeywords,
  auto_reply: input.autoReply,
});

export async function createTicketTagAction(input: TicketTagFormInput): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const next = parse(input);
    const existing = await listTicketTags(supabaseAdmin, guildId);
    if (existing.some((tag) => tag.name === next.name)) throw new DashboardError(`There's already a tag called ${next.name}.`);

    const created = await createTicketTag(supabaseAdmin, guildId, { ...toRow(next), position: existing.length });
    await recordChange({ userId, guildId, section: "tickets", action: "create", after: { tag: created.name } });
    return finish(guildId);
  } catch (error) {
    return toActionError(error, "create ticket tag", "Couldn't add the tag. Try again?");
  }
}

export async function updateTicketTagAction(id: string, input: TicketTagFormInput): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const next = parse(input);
    const tagId = idSchema.parse(id);
    const existing = await listTicketTags(supabaseAdmin, guildId);
    const current = existing.find((tag) => tag.id === tagId);
    if (!current) throw new DashboardError(GONE);
    if (existing.some((tag) => tag.id !== tagId && tag.name === next.name)) throw new DashboardError(`There's already a tag called ${next.name}.`);

    if (!(await updateTicketTag(supabaseAdmin, guildId, tagId, toRow(next)))) throw new DashboardError(GONE);
    await recordChange({
      userId,
      guildId,
      section: "tickets",
      before: { name: current.name, content: current.content, trigger_keywords: current.trigger_keywords, auto_reply: current.auto_reply },
      after: toRow(next),
    });
    return finish(guildId);
  } catch (error) {
    return toActionError(error, "update ticket tag", "Couldn't save the tag. Try again?");
  }
}

export async function removeTicketTagAction(id: string): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const tagId = idSchema.parse(id);
    const current = (await listTicketTags(supabaseAdmin, guildId)).find((tag) => tag.id === tagId);
    if (!current) throw new DashboardError(GONE);
    if (!(await deleteTicketTag(supabaseAdmin, guildId, tagId))) throw new DashboardError(GONE);
    await recordChange({ userId, guildId, section: "tickets", action: "delete", before: { tag: current.name }, after: { tag: null } });
    return finish(guildId);
  } catch (error) {
    return toActionError(error, "remove ticket tag", "Couldn't remove the tag. Try again?");
  }
}

export async function reorderTicketTagsAction(orderedIds: string[]): Promise<DiscordActionResult> {
  try {
    const { guildId } = await requireDiscordAdmin();
    await reorderTicketTags(supabaseAdmin, guildId, z.array(idSchema).max(200).parse(orderedIds));
    return finish(guildId);
  } catch (error) {
    return toActionError(error, "reorder ticket tags", "Couldn't save the new order. Try again?");
  }
}
