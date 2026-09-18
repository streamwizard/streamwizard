import { supabaseAdmin } from "@repo/supabase/next/admin";
import {
  listTicketProducts,
  TICKET_ACTIVE_LIMIT,
  TICKET_DESCRIPTION_MAX,
  TICKET_NAME_MAX,
} from "@repo/supabase/queries/ticket-config";
import { TicketProductsManager } from "@/components/discord/ticket-products-manager";
import { requireDiscordContext } from "@/lib/discord/api";

export const dynamic = "force-dynamic";

export default async function DiscordTicketProductsPage() {
  const { guildId } = requireDiscordContext();
  const products = await listTicketProducts(supabaseAdmin, guildId);

  return (
    <TicketProductsManager
      items={products.map((product) => ({
        id: product.id,
        slug: product.slug,
        name: product.label,
        description: product.description,
        emoji: product.emoji,
        archived: product.archived_at !== null,
      }))}
      limit={TICKET_ACTIVE_LIMIT}
      nameMax={TICKET_NAME_MAX}
      descriptionMax={TICKET_DESCRIPTION_MAX}
    />
  );
}
