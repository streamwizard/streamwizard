"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { announcementSchema, createAnnouncement, parseAnnouncement, validateAnnouncement, type Announcement } from "@repo/discord-message";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import {
  createAnnouncement as insertAnnouncement,
  deleteAnnouncement,
  getAnnouncement,
  saveAnnouncementDraft,
  scheduleAnnouncement,
  unscheduleAnnouncement,
  type DiscordAnnouncement,
} from "@repo/supabase/queries/discord-announcements";
import { assertChannel, assertRole } from "@/lib/discord/api";
import { DashboardError, requireDiscordAdmin, toActionError, type DiscordActionResult } from "@/lib/discord/action";
import { ANNOUNCEMENT_CHANNEL_KINDS, ANNOUNCEMENT_VALIDATE_OPTIONS, SCHEDULE_GRACE_MS } from "@/lib/discord/announcements";
import { recordChange } from "@/lib/discord/audit";
import { callBot } from "@/lib/discord/bot-bridge";
import { nullableSnowflakeSchema } from "@/schemas/discord";

// The Announcements pages: staff write one, pick a channel, post it now or
// set a time. The draft autosaves here; nothing reaches Discord until
// postAnnouncementNowAction, or the bot's scheduler when a time was set.

const idSchema = z.string().uuid();

const draftSchema = z.object({
  announcement: announcementSchema,
  channelId: nullableSnowflakeSchema,
});

export type AnnouncementDraftInput = z.infer<typeof draftSchema>;

const GONE = "That announcement doesn't exist anymore. Go back to the list.";
const BUSY = "It's going out right now. Give it a moment.";

function requireId(id: string): string {
  if (!idSchema.safeParse(id).success) throw new DashboardError(GONE);
  return id;
}

async function loadRow(guildId: string, id: string): Promise<DiscordAnnouncement & { announcement: Announcement }> {
  const row = await getAnnouncement(supabaseAdmin, guildId, requireId(id));
  const announcement = parseAnnouncement(row?.draft);
  if (!row || !announcement) throw new DashboardError(GONE);
  return { ...row, announcement };
}

/** Everything the bot can't check for us, before it is asked to send. */
async function assertSendable(row: DiscordAnnouncement & { announcement: Announcement }): Promise<string> {
  const [issue] = validateAnnouncement(row.announcement, ANNOUNCEMENT_VALIDATE_OPTIONS);
  if (issue) throw new DashboardError(issue.message);
  if (!row.channel_id) throw new DashboardError("Pick a channel first.");
  await assertChannel(row.channel_id, ANNOUNCEMENT_CHANNEL_KINDS);
  if (row.announcement.mention.kind === "role") await assertRole(row.announcement.mention.roleId);
  return row.channel_id;
}

export interface CreateResult extends DiscordActionResult {
  id?: string;
}

/** A blank draft, then straight into the editor. */
export async function createAnnouncementAction(): Promise<CreateResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const id = await insertAnnouncement(supabaseAdmin, guildId, { draft: createAnnouncement(), created_by: userId });
    await recordChange({ userId, guildId, section: "announcements", action: "create" });
    revalidatePath("/discord/announcements");
    return { error: null, id };
  } catch (error) {
    return toActionError(error, "create announcement", "Couldn't start an announcement. Try again?");
  }
}

/** Autosave. A draft may be half-written, so Discord's limits aren't enforced until it is sent. */
export async function saveAnnouncementDraftAction(id: string, input: AnnouncementDraftInput): Promise<DiscordActionResult> {
  try {
    const { guildId } = await requireDiscordAdmin();
    const parsed = draftSchema.safeParse(input);
    if (!parsed.success) throw new DashboardError("That announcement can't be saved. Reload the page and try again.");

    const saved = await saveAnnouncementDraft(supabaseAdmin, guildId, requireId(id), {
      draft: parsed.data.announcement,
      channel_id: parsed.data.channelId,
    });
    if (!saved) {
      const row = await getAnnouncement(supabaseAdmin, guildId, id);
      throw new DashboardError(row?.status === "posting" ? BUSY : GONE);
    }
    return { error: null };
  } catch (error) {
    return toActionError(error, "save announcement draft", "Couldn't save your changes. Try again?");
  }
}

export interface PostResult extends DiscordActionResult {
  /** The old message was gone, so the bot sent a new one, ping included. */
  resent?: boolean;
}

/** Sends it through the bot now, or updates the message already in Discord. Also "Try again" for a failed one. */
export async function postAnnouncementNowAction(id: string): Promise<PostResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const row = await loadRow(guildId, id);
    if (row.status === "posting") throw new DashboardError(BUSY);
    const channelId = await assertSendable(row);

    const posted = await callBot<{ messageId: string; channelId: string; resent: boolean }>(
      guildId,
      `/announcements/${row.id}/post`,
      {},
      { timeoutMs: 15_000 },
    );
    if (!posted.ok) throw new DashboardError(posted.error);

    await recordChange({
      userId,
      guildId,
      section: "announcements",
      action: "publish",
      before: { channel_id: row.channel_id === channelId ? null : row.channel_id },
      after: { announcement: row.announcement.title || "Untitled", channel_id: channelId, ping: row.announcement.mention.kind },
    });
    revalidatePath("/discord", "layout");
    return { error: null, resent: posted.data.resent };
  } catch (error) {
    return toActionError(error, "post announcement", "Couldn't post the announcement. Try again?");
  }
}

/** Puts it in the bot's queue for `scheduledForIso`. The bot checks the channel again when the time comes. */
export async function scheduleAnnouncementAction(id: string, scheduledForIso: string): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const when = new Date(scheduledForIso);
    if (Number.isNaN(when.getTime())) throw new DashboardError("Pick a date and time first.");
    if (when.getTime() < Date.now() - SCHEDULE_GRACE_MS) throw new DashboardError("That time has passed. Pick a later one.");

    const row = await loadRow(guildId, id);
    if (row.status === "posting") throw new DashboardError(BUSY);
    if (row.status === "posted") throw new DashboardError("It's already in Discord. Update it there, or delete it and write a new one.");
    await assertSendable(row);

    const scheduled = await scheduleAnnouncement(supabaseAdmin, guildId, row.id, when);
    if (!scheduled) throw new DashboardError("That announcement changed underneath you. Reload the page and try again.");

    await recordChange({
      userId,
      guildId,
      section: "announcements",
      action: "update",
      before: { status: row.status, scheduled_for: row.scheduled_for },
      after: { announcement: row.announcement.title || "Untitled", status: "scheduled", scheduled_for: when.toISOString() },
    });
    revalidatePath("/discord", "layout");
    return { error: null };
  } catch (error) {
    return toActionError(error, "schedule announcement", "Couldn't schedule the announcement. Try again?");
  }
}

/** Takes it out of the queue. It stays saved as a draft. */
export async function unscheduleAnnouncementAction(id: string): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const row = await loadRow(guildId, id);
    const unscheduled = await unscheduleAnnouncement(supabaseAdmin, guildId, row.id);
    if (!unscheduled) throw new DashboardError(row.status === "scheduled" || row.status === "posting" ? "It just went out. Reload to see it." : "It wasn't scheduled.");

    await recordChange({
      userId,
      guildId,
      section: "announcements",
      action: "update",
      before: { status: "scheduled", scheduled_for: row.scheduled_for },
      after: { announcement: row.announcement.title || "Untitled", status: "draft", scheduled_for: null },
    });
    revalidatePath("/discord", "layout");
    return { error: null };
  } catch (error) {
    return toActionError(error, "unschedule announcement", "Couldn't unschedule the announcement. Try again?");
  }
}

/** Removes it here and, when it was posted, from Discord. */
export async function deleteAnnouncementAction(id: string): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const row = await getAnnouncement(supabaseAdmin, guildId, requireId(id));
    if (!row) return { error: null };
    if (row.status === "posting") throw new DashboardError(BUSY);

    if (row.message_id) {
      // The bot takes it out of the channel, then drops the row itself.
      const removed = await callBot(guildId, `/announcements/${row.id}/delete`, {}, { timeoutMs: 15_000 });
      if (!removed.ok) throw new DashboardError(removed.error);
    } else {
      await deleteAnnouncement(supabaseAdmin, guildId, row.id);
    }

    await recordChange({
      userId,
      guildId,
      section: "announcements",
      action: "delete",
      before: { announcement: parseAnnouncement(row.draft)?.title || "Untitled", channel_id: row.channel_id, status: row.status },
    });
    revalidatePath("/discord", "layout");
    return { error: null };
  } catch (error) {
    return toActionError(error, "delete announcement", "Couldn't delete the announcement. Try again?");
  }
}
