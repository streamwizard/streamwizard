"use server";

import { CORE_VARIABLES, findUnknownVariables } from "@repo/discord-message";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import {
  createTicketTag,
  deleteTicketTag,
  listTicketTags,
  normaliseTagKeywords,
  reorderTicketTags,
  updateTicketTag,
} from "@repo/supabase/queries/tickets/tags";
import {
  DashboardError,
  listPlaceholders,
  parseId,
  parseInput,
  parseOrder,
  refreshBotCache,
  requireDiscordAdmin,
  toActionError,
  type DiscordActionResult,
} from "@/lib/discord/action";
import { recordChange } from "@/lib/discord/audit";
import { ticketTagSchema, type TicketTagFormInput } from "@/schemas/discord";

// Tags: canned answers for /tag and keyword auto-replies. Same ending as the
// other ticket config actions: audit row, bot cache refresh, revalidate.

const GONE = "That tag doesn't exist anymore. Refresh the page?";
const ALLOWED_VARIABLES = CORE_VARIABLES.map((v) => v.key);

function parse(input: unknown): TicketTagFormInput {
  const tag = parseInput(ticketTagSchema, input);
  const unknown = findUnknownVariables(tag.content, ALLOWED_VARIABLES);
  if (unknown.length > 0) throw new DashboardError(`Unknown placeholder ${listPlaceholders(unknown, "[]")}.`);
  if (tag.autoReply && normaliseTagKeywords(tag.triggerKeywords).length === 0) {
    throw new DashboardError("Auto-reply needs at least one keyword.");
  }
  return tag;
}

const finish = (guildId: string) => refreshBotCache(guildId, "/cache/tickets");

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
    return await finish(guildId);
  } catch (error) {
    return toActionError(error, "create ticket tag", "Couldn't add the tag. Try again?");
  }
}

export async function updateTicketTagAction(id: string, input: TicketTagFormInput): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const tagId = parseId(id, GONE);
    const next = parse(input);
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
    return await finish(guildId);
  } catch (error) {
    return toActionError(error, "update ticket tag", "Couldn't save the tag. Try again?");
  }
}

export async function removeTicketTagAction(id: string): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const tagId = parseId(id, GONE);
    const current = (await listTicketTags(supabaseAdmin, guildId)).find((tag) => tag.id === tagId);
    if (!current) throw new DashboardError(GONE);
    if (!(await deleteTicketTag(supabaseAdmin, guildId, tagId))) throw new DashboardError(GONE);
    await recordChange({ userId, guildId, section: "tickets", action: "delete", before: { tag: current.name }, after: { tag: null } });
    return await finish(guildId);
  } catch (error) {
    return toActionError(error, "remove ticket tag", "Couldn't remove the tag. Try again?");
  }
}

export async function reorderTicketTagsAction(orderedIds: string[]): Promise<DiscordActionResult> {
  try {
    const { guildId } = await requireDiscordAdmin();
    const ids = parseOrder(orderedIds);
    await reorderTicketTags(supabaseAdmin, guildId, ids);
    return await finish(guildId);
  } catch (error) {
    return toActionError(error, "reorder ticket tags", "Couldn't save the new order. Try again?");
  }
}
