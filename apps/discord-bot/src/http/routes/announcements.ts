import { Hono } from "hono";
import { z } from "zod";
import { parseAnnouncement } from "@repo/discord-message";
import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { deleteAnnouncement, getAnnouncement, recordAnnouncementPosted } from "@repo/supabase/queries/discord-announcements";
import {
  AnnouncementError,
  checkAnnouncementChannel,
  deleteAnnouncementMessage,
  postAnnouncement,
  withAnnouncementLock,
} from "../../lib/announcements/post";
import { guildVariableValues } from "../../lib/built-message";
import { isMessageChannel } from "../../lib/channel-checks";
import type { AppEnv } from "../types";

export const announcementRoutes = new Hono<AppEnv>();

const BUSY = "It's going out right now. Give it a moment.";

// Posts an announcement from web-admin now, or updates the message an earlier
// post left in the channel. Owns posted, message_id and posted_at, like the
// built-message publish does. web-admin has already checked the draft and
// the channel kind; this checks what only the gateway knows (permissions,
// whether the role can be pinged) and sends.
announcementRoutes.post("/announcements/:id/post", async (c) => {
  const id = z.string().uuid().safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "Invalid body" }, 400);

  const guild = c.get("guild");
  const row = await getAnnouncement(supabase, guild.id, id.data);
  const announcement = parseAnnouncement(row?.draft);
  if (!row || !announcement) return c.json({ error: "There's no saved announcement to post yet" }, 404);
  if (row.status === "posting") return c.json({ error: BUSY }, 409);

  const check = await checkAnnouncementChannel(guild, row.channel_id, announcement);
  if (!check.ok) return c.json({ error: check.error }, 409);

  const result = await withAnnouncementLock(guild.id, row.id, async () => {
    try {
      // A message left in another channel is removed: the announcement lives in one place.
      const sameChannel = row.channel_id === check.channel.id;
      const { messageId, resent } = await postAnnouncement({
        channel: check.channel,
        announcement,
        values: guildVariableValues(guild),
        previousMessageId: sameChannel ? row.message_id : null,
      });
      await recordAnnouncementPosted(supabase, guild.id, row.id, { posted: announcement, channel_id: check.channel.id, message_id: messageId });
      return c.json({ ok: true, messageId, channelId: check.channel.id, resent });
    } catch (error) {
      if (error instanceof AnnouncementError) return c.json({ error: error.message, issues: error.issues }, 422);
      reportError(error, "discord-bot announcements: post", { guildId: guild.id, announcementId: row.id });
      return c.json({ error: "Discord rejected the announcement. Check the bot's permissions in that channel and try again." }, 502);
    }
  });
  return result ?? c.json({ error: BUSY }, 409);
});

// Deleting an announcement in the dashboard takes it out of Discord too. One
// a mod already removed, or a channel that is gone, don't stand in the way.
announcementRoutes.post("/announcements/:id/delete", async (c) => {
  const id = z.string().uuid().safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "Invalid body" }, 400);

  const guild = c.get("guild");
  const row = await getAnnouncement(supabase, guild.id, id.data);
  if (!row) return c.json({ ok: true });
  if (row.status === "posting") return c.json({ error: BUSY }, 409);

  const result = await withAnnouncementLock(guild.id, row.id, async () => {
    if (row.message_id && row.channel_id) {
      const channel = await guild.channels.fetch(row.channel_id).catch(() => null);
      if (isMessageChannel(channel)) {
        try {
          await deleteAnnouncementMessage(channel, row.message_id);
        } catch (error) {
          reportError(error, "discord-bot announcements: delete", { guildId: guild.id, announcementId: row.id });
          return c.json({ error: `The bot couldn't remove the message from #${channel.name}. Check its permissions there.` }, 409);
        }
      }
    }
    await deleteAnnouncement(supabase, guild.id, row.id);
    return c.json({ ok: true });
  });
  return result ?? c.json({ error: BUSY }, 409);
});
