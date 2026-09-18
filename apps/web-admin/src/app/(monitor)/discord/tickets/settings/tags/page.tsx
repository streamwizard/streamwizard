import { supabaseAdmin } from "@repo/supabase/next/admin";
import {
  listTicketTags,
  TICKET_TAG_CONTENT_MAX,
  TICKET_TAG_KEYWORDS_MAX,
  TICKET_TAG_NAME_MAX,
} from "@repo/supabase/queries/ticket-tags";
import { TicketTagsManager } from "@/components/discord/ticket-tags-manager";
import { requireDiscordContext } from "@/lib/discord/api";

export const dynamic = "force-dynamic";

export default async function DiscordTicketTagsPage() {
  const { guildId } = requireDiscordContext();
  const tags = await listTicketTags(supabaseAdmin, guildId);

  return (
    <TicketTagsManager
      items={tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        content: tag.content,
        triggerKeywords: tag.trigger_keywords,
        autoReply: tag.auto_reply,
      }))}
      nameMax={TICKET_TAG_NAME_MAX}
      contentMax={TICKET_TAG_CONTENT_MAX}
      keywordsMax={TICKET_TAG_KEYWORDS_MAX}
    />
  );
}
