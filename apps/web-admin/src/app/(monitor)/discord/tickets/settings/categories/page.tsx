import { supabaseAdmin } from "@repo/supabase/next/admin";
import {
  listTicketCategories,
  TICKET_ACTIVE_LIMIT,
  TICKET_DESCRIPTION_MAX,
  TICKET_NAME_MAX,
} from "@repo/supabase/queries/ticket-config";
import { TicketCategoriesManager } from "@/components/discord/ticket-categories-manager";
import { getGuildChannels, requireDiscordContext } from "@/lib/discord/api";
import { toChannelOptions } from "@/lib/discord/options";

export const dynamic = "force-dynamic";

export default async function DiscordTicketCategoriesPage() {
  const { guildId } = requireDiscordContext();
  const [categories, channels] = await Promise.all([listTicketCategories(supabaseAdmin, guildId), getGuildChannels()]);

  return (
    <TicketCategoriesManager
      items={categories.map((category) => ({
        id: category.id,
        slug: category.slug,
        name: category.name,
        description: category.description,
        emoji: category.emoji,
        archived: category.archived_at !== null,
        enabled: category.enabled,
        discordCategoryId: category.discord_category_id,
      }))}
      discordCategories={toChannelOptions(channels, ["category"])}
      limit={TICKET_ACTIVE_LIMIT}
      nameMax={TICKET_NAME_MAX}
      descriptionMax={TICKET_DESCRIPTION_MAX}
    />
  );
}
