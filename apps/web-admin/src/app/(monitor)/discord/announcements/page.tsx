import { Megaphone } from "lucide-react";
import { parseAnnouncement } from "@repo/discord-message";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getUserNames, listAnnouncements } from "@repo/supabase/queries/discord-announcements";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@repo/ui";
import { AnnouncementList, type AnnouncementListItem } from "@/components/discord/announcement-list";
import { NewAnnouncementButton } from "@/components/discord/announcement-new";
import { PageHeader } from "@/components/widgets/page-header";
import { announcementStatus } from "@/lib/discord/announcements";
import { getGuildChannels, requireDiscordContext } from "@/lib/discord/api";

export const dynamic = "force-dynamic";

export default async function DiscordAnnouncementsPage() {
  const { guildId } = requireDiscordContext();
  const [rows, channels] = await Promise.all([listAnnouncements(supabaseAdmin, guildId), getGuildChannels()]);
  const names = new Map(channels.map((c) => [c.id, c.name]));
  const authors = await getUserNames(
    supabaseAdmin,
    rows.map((row) => row.created_by).filter((id): id is string => !!id),
  );

  const announcements: AnnouncementListItem[] = rows.map((row) => {
    const draft = parseAnnouncement(row.draft);
    const status = announcementStatus({ status: row.status, draft, posted: parseAnnouncement(row.posted) });
    const channel = row.channel_id ? names.get(row.channel_id) : null;
    return {
      id: row.id,
      title: draft?.title.trim() || "Untitled",
      channel: channel ? `#${channel}` : row.channel_id ? "Deleted channel" : "No channel yet",
      status,
      error: row.last_error,
      when: status === "scheduled" || status === "posting" ? row.scheduled_for : row.posted_at,
      by: (row.created_by && authors.get(row.created_by)) || "Unknown admin",
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        description="Tell the server something: a release, an event, a heads-up. Pick a channel, write it, post it now or later."
      >
        {announcements.length > 0 && <NewAnnouncementButton />}
      </PageHeader>

      {announcements.length > 0 ? (
        <AnnouncementList announcements={announcements} />
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Megaphone />
            </EmptyMedia>
            <EmptyTitle>Nothing announced yet</EmptyTitle>
            <EmptyDescription>Write one, check the preview, post it. Or set a time and the bot posts it for you.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <NewAnnouncementButton />
          </EmptyContent>
        </Empty>
      )}
    </div>
  );
}
