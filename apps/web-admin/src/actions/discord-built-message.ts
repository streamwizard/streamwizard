"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MESSAGE_TEMPLATES, builtMessageSchema, parseBuiltMessage, validateMessage, type BuiltMessage } from "@repo/discord-message";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import {
  createBuiltMessage,
  deleteBuiltMessage,
  getBuiltMessage,
  saveBuiltMessageDraft,
} from "@repo/supabase/queries/discord-built-messages";
import { assertChannel } from "@/lib/discord/api";
import { DashboardError, requireDiscordAdmin, toActionError, type DiscordActionResult } from "@/lib/discord/action";
import { recordChange } from "@/lib/discord/audit";
import { isBannerUploadUrl } from "@/lib/discord/banner-storage";
import { callBot } from "@/lib/discord/bot-bridge";
import { MESSAGE_CHANNEL_KINDS, MESSAGE_NAME_MAX, MESSAGE_VALIDATE_OPTIONS, channelNameFor } from "@/lib/discord/built-messages";
import { nullableSnowflakeSchema } from "@/schemas/discord";

// The Messages pages: a server's built messages, each posted in a channel of
// its choice. The draft autosaves here; nothing reaches Discord until
// publishBuiltMessageAction.

const nameSchema = z.string().trim().min(1).max(MESSAGE_NAME_MAX);
const idSchema = z.string().uuid();

const draftSchema = z.object({
  name: nameSchema,
  message: builtMessageSchema,
  channelId: nullableSnowflakeSchema,
  /** "Create a channel for me" is picked instead of an existing channel. */
  createChannel: z.boolean(),
});

export type BuiltMessageDraftInput = z.infer<typeof draftSchema>;

const GONE = "That message doesn't exist anymore. Go back to the list.";

function requireId(id: string): string {
  if (!idSchema.safeParse(id).success) throw new DashboardError(GONE);
  return id;
}

function assertOwnUploads(message: BuiltMessage) {
  for (const element of message.elements) {
    if (element.type === "banner" && element.image && !isBannerUploadUrl(element.image.url)) {
      throw new DashboardError("One of the banner images isn't an upload from here. Upload it again.");
    }
  }
}

export interface CreateResult extends DiscordActionResult {
  id?: string;
}

/** A new message from a template. It stays a draft until someone publishes it. */
export async function createBuiltMessageAction(input: { name: string; templateId: string }): Promise<CreateResult> {
  try {
    const { guildId } = await requireDiscordAdmin();
    const name = nameSchema.safeParse(input.name);
    if (!name.success) throw new DashboardError(`Give the message a name, up to ${MESSAGE_NAME_MAX} characters.`);
    const template = MESSAGE_TEMPLATES.find((t) => t.id === input.templateId) ?? MESSAGE_TEMPLATES[0]!;

    const id = await createBuiltMessage(supabaseAdmin, guildId, { name: name.data, draft: template.create() });
    revalidatePath("/discord/messages");
    return { error: null, id };
  } catch (error) {
    return toActionError(error, "create built message", "Couldn't create the message. Try again?");
  }
}

/** Autosave. Drafts may be half-finished, so Discord's limits aren't enforced until publish. */
export async function saveBuiltMessageDraftAction(id: string, input: BuiltMessageDraftInput): Promise<DiscordActionResult> {
  try {
    const { guildId } = await requireDiscordAdmin();
    const parsed = draftSchema.safeParse(input);
    if (!parsed.success) {
      const nameIssue = parsed.error.issues.some((issue) => issue.path[0] === "name");
      throw new DashboardError(
        nameIssue ? `Give the message a name, up to ${MESSAGE_NAME_MAX} characters.` : "That message can't be saved. Reload the page and try again.",
      );
    }
    assertOwnUploads(parsed.data.message);

    const saved = await saveBuiltMessageDraft(supabaseAdmin, guildId, requireId(id), {
      name: parsed.data.name,
      draft: parsed.data.message,
      draft_channel_id: parsed.data.createChannel ? null : parsed.data.channelId,
      draft_create_channel: parsed.data.createChannel,
    });
    if (!saved) throw new DashboardError(GONE);
    return { error: null };
  } catch (error) {
    return toActionError(error, "save built message draft", "Couldn't save your changes. Try again?");
  }
}

export interface PublishResult extends DiscordActionResult {
  /** Set when the error belongs next to the channel picker. */
  channelError?: string | null;
  channelId?: string;
}

/** Sends the saved draft to Discord through the bot, creating the channel first when asked to. */
export async function publishBuiltMessageAction(id: string): Promise<PublishResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();

    const row = await getBuiltMessage(supabaseAdmin, guildId, requireId(id));
    const message = parseBuiltMessage(row?.draft);
    if (!row || !message) throw new DashboardError("There's nothing saved to publish yet.");

    const [issue] = validateMessage(message, MESSAGE_VALIDATE_OPTIONS);
    if (issue) throw new DashboardError(issue.message);

    let channelId = row.draft_channel_id;
    if (row.draft_create_channel) {
      const created = await callBot<{ channelId: string }>(guildId, "/channels", { name: channelNameFor(row.name) }, { timeoutMs: 15_000 });
      if (!created.ok) return { error: null, channelError: created.error };
      channelId = created.data.channelId;
      // From here on it's an existing channel: a retry must not create a second one.
      await saveBuiltMessageDraft(supabaseAdmin, guildId, row.id, {
        draft: message,
        draft_channel_id: channelId,
        draft_create_channel: false,
      });
    }
    if (!channelId) return { error: null, channelError: "Pick a channel first." };
    if (channelId !== row.channel_id && !row.draft_create_channel) await assertChannel(channelId, MESSAGE_CHANNEL_KINDS);

    // Banners upload as attachments, so this takes longer than a cache refresh.
    const published = await callBot<{ channelId: string; messageIds: string[] }>(
      guildId,
      `/built-messages/${row.id}/publish`,
      { channelId },
      { timeoutMs: 60_000 },
    );
    if (!published.ok) throw new DashboardError(published.error);

    await recordChange({
      userId,
      guildId,
      section: "messages",
      action: "publish",
      // Only changed keys are kept, so the name goes on one side to always show.
      before: { channel_id: row.channel_id },
      after: { message: row.name, channel_id: channelId },
    });
    revalidatePath("/discord", "layout");
    return { error: null, channelId };
  } catch (error) {
    return toActionError(error, "publish built message", "Couldn't publish the message. Try again?");
  }
}

/** Removes the message here and, when it was published, from Discord. */
export async function deleteBuiltMessageAction(id: string): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const row = await getBuiltMessage(supabaseAdmin, guildId, requireId(id));
    if (!row) return { error: null };

    if (row.message_ids.length > 0) {
      // The bot takes it out of the channel, then drops the row itself.
      const removed = await callBot(guildId, `/built-messages/${row.id}/delete`, {}, { timeoutMs: 30_000 });
      if (!removed.ok) throw new DashboardError(removed.error);
    } else {
      await deleteBuiltMessage(supabaseAdmin, guildId, row.id);
    }

    await recordChange({
      userId,
      guildId,
      section: "messages",
      action: "delete",
      before: { message: row.name, channel_id: row.channel_id },
    });
    revalidatePath("/discord", "layout");
    return { error: null };
  } catch (error) {
    return toActionError(error, "delete built message", "Couldn't delete the message. Try again?");
  }
}
