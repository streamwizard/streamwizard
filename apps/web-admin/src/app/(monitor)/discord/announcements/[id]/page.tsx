import { notFound } from "next/navigation";
import { createAnnouncement, parseAnnouncement } from "@repo/discord-message";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getAnnouncement } from "@repo/supabase/queries/discord-announcements";
import { AnnouncementEditor } from "@/components/discord/announcement-editor";
import { ANNOUNCEMENT_CHANNEL_KINDS } from "@/lib/discord/announcements";
import { getBotProfile, getGuildChannels, getGuildRoles, requireDiscordContext } from "@/lib/discord/api";
import { bannerUploadsEnabled } from "@/lib/discord/banner-storage";
import { env } from "@/lib/env";
import { toChannelOptions, toRoleOptions } from "@/lib/discord/options";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DiscordAnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const { guildId } = requireDiscordContext();
  const [row, channels, roles, bot] = await Promise.all([
    getAnnouncement(supabaseAdmin, guildId, id),
    getGuildChannels(),
    getGuildRoles(),
    getBotProfile(),
  ]);
  if (!row) notFound();

  return (
    <AnnouncementEditor
      // A different announcement is a different editor: no draft or autosave state carries over.
      // The status is in the key too, so the form's baseline resets when the bot moves it along.
      key={`${row.id}:${row.status}:${row.posted_at ?? ""}`}
      id={row.id}
      initial={{
        // A stored draft from an older shape falls back to a blank one rather than a broken page.
        announcement: parseAnnouncement(row.draft) ?? createAnnouncement(),
        channelId: row.channel_id,
      }}
      state={{
        status: row.status,
        posted: parseAnnouncement(row.posted),
        postedChannelId: row.message_id ? row.channel_id : null,
        scheduledFor: row.scheduled_for,
        postedAt: row.posted_at,
        lastError: row.last_error,
      }}
      channels={toChannelOptions(channels, ANNOUNCEMENT_CHANNEL_KINDS)}
      roles={toRoleOptions(roles)}
      bot={bot}
      uploadsEnabled={bannerUploadsEnabled()}
      previewImageHosts={[env.NEXT_PUBLIC_CDN_URL, "https://cdn.discordapp.com", "https://media.discordapp.net"].filter((h): h is string => !!h)}
    />
  );
}
