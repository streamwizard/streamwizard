import type { Client } from "discord.js";
import { parseAnnouncement } from "@repo/discord-message";
import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import {
  claimAnnouncement,
  failStalePosting,
  listDueAnnouncements,
  markAnnouncementFailed,
  recordAnnouncementPosted,
  type DiscordAnnouncement,
} from "@repo/supabase/queries/discord-announcements";
import { guildVariableValues } from "../built-message";
import { AnnouncementError, checkAnnouncementChannel, postAnnouncement, withAnnouncementLock } from "./post";

// Announcements staff scheduled in web-admin. Every half minute: rows whose
// time has come are claimed one by one with a conditional UPDATE
// (scheduled -> posting) and sent. A row a previous process claimed and never
// finished is marked failed rather than retried: the message may already be
// in the channel, and a second send would ping everyone twice.

const TICK_MS = 30 * 1000;
/** A send takes seconds; a claim older than this belongs to a process that died. */
const STALE_CLAIM_MS = 5 * 60 * 1000;
const RESTART_ERROR = "The bot restarted while this was going out. Check the channel, then post it again or delete it.";

let stopped = true;
let loop: Promise<void> | null = null;
let wake: (() => void) | undefined;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      wake = undefined;
      resolve();
    }
    wake = done;
  });
}

/** What went wrong, in words the admin sees on the row. */
function describeFailure(error: unknown): string {
  if (error instanceof AnnouncementError) return error.message;
  const code = (error as { code?: unknown } | null)?.code;
  if (code === 50013) return "The bot is missing a permission in that channel. Check its role, then post it again.";
  if (code === 50001) return "The bot can't see that channel anymore. Pick another one, then post it again.";
  return "Discord rejected the message. Post it again, or delete it.";
}

async function sendDue(client: Client<true>, due: DiscordAnnouncement): Promise<boolean> {
  const guild = client.guilds.cache.get(due.guild_id);
  // Not our server (anymore): leave it scheduled for a process that is in it.
  if (!guild) return false;

  const outcome = await withAnnouncementLock(guild.id, due.id, async () => {
    // Claim first: whoever wins this UPDATE posts; everyone else sees null.
    const row = await claimAnnouncement(supabase, due.id);
    if (!row) return false;

    const fail = (message: string) => markAnnouncementFailed(supabase, guild.id, row.id, message);
    const announcement = parseAnnouncement(row.draft);
    if (!announcement) {
      await fail("This announcement is from an older version and can't be sent. Delete it and write a new one.");
      return true;
    }
    const check = await checkAnnouncementChannel(guild, row.channel_id, announcement);
    if (!check.ok) {
      await fail(check.error);
      return true;
    }
    try {
      const { messageId } = await postAnnouncement({
        channel: check.channel,
        announcement,
        values: guildVariableValues(guild),
        previousMessageId: row.channel_id === check.channel.id ? row.message_id : null,
      });
      await recordAnnouncementPosted(supabase, guild.id, row.id, { posted: announcement, channel_id: check.channel.id, message_id: messageId }, "posting");
      console.log(`[announcements] Posted "${announcement.title || "Untitled"}" in #${check.channel.name} (${guild.name})`);
    } catch (error) {
      reportError(error, "discord-bot announcements: scheduled send", { guildId: guild.id, announcementId: row.id });
      await fail(describeFailure(error));
    }
    return true;
  });
  return outcome ?? false;
}

async function tick(client: Client<true>): Promise<void> {
  const stale = await failStalePosting(supabase, new Date(Date.now() - STALE_CLAIM_MS), RESTART_ERROR);
  if (stale) console.warn(`[announcements] ${stale} announcement(s) left mid-send by a previous run marked failed`);

  for (const due of await listDueAnnouncements(supabase)) {
    if (stopped) return;
    try {
      await sendDue(client, due);
    } catch (error) {
      reportError(error, "discord-bot announcements: tick", { announcementId: due.id });
    }
  }
}

export function startAnnouncementScheduler(client: Client<true>): void {
  if (!stopped) return;
  stopped = false;
  loop = (async () => {
    while (!stopped) {
      try {
        await tick(client);
      } catch (error) {
        reportError(error, "discord-bot announcements: scheduler");
      }
      if (stopped) break;
      await sleep(TICK_MS);
    }
  })();
  console.log("[announcements] Scheduler started");
}

/** Stops the loop and waits for a send in progress to finish. */
export async function stopAnnouncementScheduler(): Promise<void> {
  if (stopped) return;
  stopped = true;
  wake?.();
  await loop;
  loop = null;
}
