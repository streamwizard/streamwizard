"use server";

import { revalidatePath } from "next/cache";
import { findUnknownVariables, TICKET_MESSAGE_VARIABLES, ticketMessagesSchema, type TicketMessageKey, type TicketMessages } from "@repo/discord-message";
import type { Json } from "@repo/supabase";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { ensureTicketDefaults } from "@repo/supabase/queries/tickets/config";
import { parseWorkingHours, workingHoursIssues } from "@repo/supabase/queries/tickets/hours";
import { getTicketSettings, upsertTicketSettings } from "@repo/supabase/queries/tickets/tickets";
import { assertChannel, assertRole } from "@/lib/discord/api";
import {
  DashboardError,
  listPlaceholders,
  parseInput,
  refreshBotCache,
  requireDiscordAdmin,
  toActionError,
  type DiscordActionResult,
} from "@/lib/discord/action";
import { recordChange } from "@/lib/discord/audit";
import { callBot, staleWarning } from "@/lib/discord/bot-bridge";
import {
  ticketAutomationSchema,
  ticketSettingsSchema,
  type TicketAutomationInput,
  type TicketSettingsInput,
} from "@/schemas/discord";

type PanelResult = { channelId: string | null; messageId: string | null };

export async function saveTicketSettings(input: TicketSettingsInput): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const next = parseInput(ticketSettingsSchema, input);

    const current = await getTicketSettings(supabaseAdmin, guildId);
    const before = {
      enabled: current?.enabled ?? false,
      staff_role_id: current?.staff_role_id ?? null,
      category_id: current?.category_id ?? null,
      panel_channel_id: current?.panel_channel_id ?? null,
      blocked_role_ids: current?.blocked_role_ids ?? [],
      max_open_per_user: current?.max_open_per_user ?? null,
      claim_hides_from_other_staff: current?.claim_hides_from_other_staff ?? false,
      close_on_member_leave: current?.close_on_member_leave ?? false,
      dm_on_close: current?.dm_on_close ?? true,
      dm_open_enabled: current?.dm_open_enabled ?? false,
    };
    const after = {
      enabled: next.enabled,
      staff_role_id: next.staffRoleId,
      category_id: next.categoryId,
      panel_channel_id: next.panelChannelId,
      blocked_role_ids: next.blockedRoleIds,
      max_open_per_user: next.maxOpenPerUser,
      claim_hides_from_other_staff: next.claimHidesFromOtherStaff,
      close_on_member_leave: next.closeOnMemberLeave,
      dm_on_close: next.dmOnClose,
      dm_open_enabled: next.dmOpenEnabled,
    };
    for (const roleId of after.blocked_role_ids) {
      if (!before.blocked_role_ids.includes(roleId)) await assertRole(roleId);
    }

    // Only validate ids that changed, so a channel deleted in Discord doesn't
    // block saving an unrelated field.
    if (after.staff_role_id && after.staff_role_id !== before.staff_role_id) await assertRole(after.staff_role_id);
    if (after.category_id && after.category_id !== before.category_id)
      await assertChannel(after.category_id, ["category"]);
    if (after.panel_channel_id && after.panel_channel_id !== before.panel_channel_id) {
      await assertChannel(after.panel_channel_id, ["text"]);
    }

    // The bot owns the panel columns: it removes the old panel message (found
    // through the stored location), posts the new one and stores where it
    // went. Writing panel_channel_id here first would lose the old location
    // and leave the old panel behind.
    let warning: string | null = null;
    let panelChannelId = before.panel_channel_id;
    const panelMoved = after.panel_channel_id !== before.panel_channel_id;
    if (panelMoved || (after.panel_channel_id && !current?.panel_message_id)) {
      const panel = await callBot<PanelResult>(guildId, "/ticket-panel", { channelId: after.panel_channel_id });
      if (panel.ok) {
        panelChannelId = after.panel_channel_id;
      } else if (panelMoved) {
        warning = `Saved, but the panel didn't move (${panel.error}). Try again once the bot is back.`;
      } else {
        warning = `Saved, but the ticket panel wasn't posted (${panel.error}). Use "Re-post panel" once the bot is back.`;
      }
    }

    // Tickets can't be on without a panel channel, so if the move failed and
    // there was none before, leave them off.
    const saved = { ...after, panel_channel_id: panelChannelId, enabled: after.enabled && !!panelChannelId };
    await upsertTicketSettings(supabaseAdmin, guildId, {
      enabled: saved.enabled,
      staff_role_id: saved.staff_role_id,
      category_id: saved.category_id,
      blocked_role_ids: saved.blocked_role_ids,
      max_open_per_user: saved.max_open_per_user,
      claim_hides_from_other_staff: saved.claim_hides_from_other_staff,
      close_on_member_leave: saved.close_on_member_leave,
      dm_on_close: saved.dm_on_close,
      dm_open_enabled: saved.dm_open_enabled,
    });
    // A guild's first save: give it the starting categories and products.
    await ensureTicketDefaults(supabaseAdmin, guildId);
    // Always, even after a panel call: that one ran before the write above.
    const refreshed = await callBot(guildId, "/cache/tickets");
    warning ??= staleWarning(refreshed);

    await recordChange({ userId, guildId, section: "tickets", before, after: saved });
    revalidatePath("/discord", "layout");
    return { error: null, warning };
  } catch (error) {
    return toActionError(error, "save tickets", "Couldn't save ticket settings. Try again?");
  }
}

export async function repostTicketPanel(): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const panel = await callBot<PanelResult>(guildId, "/ticket-panel");
    if (!panel.ok) throw new DashboardError(panel.error);
    if (!panel.data.channelId) throw new DashboardError("Pick a panel channel and save first.");

    await recordChange({
      userId,
      guildId,
      section: "tickets",
      action: "repost_panel",
      after: { panel_channel_id: panel.data.channelId },
    });
    revalidatePath("/discord", "layout");
    return { error: null };
  } catch (error) {
    return toActionError(error, "repost panel", "Couldn't re-post the panel. Try again?");
  }
}

/** The short texts the bot sends around a ticket. Each is checked against the placeholders it may use. */
export async function saveTicketMessages(input: TicketMessages): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const messages = parseInput(ticketMessagesSchema, input);
    for (const [key, text] of Object.entries(messages)) {
      const allowed = TICKET_MESSAGE_VARIABLES[key as TicketMessageKey].map((v) => v.key);
      const unknown = findUnknownVariables(text, allowed);
      if (unknown.length > 0) throw new DashboardError(`${key}: unknown placeholder ${listPlaceholders(unknown, "[]")}`);
    }

    const current = await getTicketSettings(supabaseAdmin, guildId);
    await upsertTicketSettings(supabaseAdmin, guildId, { messages });
    await recordChange({
      userId,
      guildId,
      section: "tickets",
      before: { messages: current?.messages ?? {} },
      after: { messages },
    });
    return await refreshBotCache(guildId, "/cache/tickets");
  } catch (error) {
    return toActionError(error, "save ticket messages", "Couldn't save the messages. Try again?");
  }
}

/** The stale-ticket timers, who may close a ticket, and the working hours. The bot reads them through its config cache. */
export async function saveTicketAutomation(input: TicketAutomationInput): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const automation = parseInput(ticketAutomationSchema, input);
    const workingHours = parseWorkingHours(automation.workingHours);
    const issue = workingHoursIssues(workingHours)[0];
    if (issue) throw new DashboardError(`Working hours: ${issue}`);

    const current = await getTicketSettings(supabaseAdmin, guildId);
    const before = {
      stale_after_hours: current?.stale_after_hours ?? null,
      auto_close_after_hours: current?.auto_close_after_hours ?? null,
      close_mode: current?.close_mode ?? "staff_only",
      close_request_hours: current?.close_request_hours ?? 24,
      working_hours: parseWorkingHours(current?.working_hours) as unknown as Json,
    };
    const after = {
      stale_after_hours: automation.staleAfterHours,
      auto_close_after_hours: automation.autoCloseAfterHours,
      close_mode: automation.closeMode,
      close_request_hours: automation.closeRequestHours,
      working_hours: workingHours as unknown as Json,
    };
    await upsertTicketSettings(supabaseAdmin, guildId, after);
    await recordChange({ userId, guildId, section: "tickets", before, after });
    return await refreshBotCache(guildId, "/cache/tickets");
  } catch (error) {
    return toActionError(error, "save ticket automation", "Couldn't save the automation settings. Try again?");
  }
}
