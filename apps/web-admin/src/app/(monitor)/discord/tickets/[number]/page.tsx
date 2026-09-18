import { notFound } from "next/navigation";
import { getDiscordUserIdForUser, getLinkedStreamWizardAccount } from "@repo/supabase/queries/discord";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getTicketByNumber } from "@repo/supabase/queries/tickets";
import {
  isActiveCategory,
  listTicketAnswers,
  listTicketCategories,
  listTicketProducts,
} from "@repo/supabase/queries/ticket-config";
import { listTicketTags } from "@repo/supabase/queries/ticket-tags";
import { TicketPage } from "@/components/discord/ticket-page/ticket-page";
import { assertAdmin } from "@/lib/assert-admin";
import { requireDiscordContext } from "@/lib/discord/api";
import { buildTicketSnapshot } from "@/lib/discord/ticket-snapshot";

export const dynamic = "force-dynamic";

// Reads once, then hands off: the client page follows the ticket's rows over
// Supabase Realtime, so nothing here runs again while it's open.
export default async function DiscordTicketPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const ticketNumber = Number.parseInt(number, 10);
  if (!Number.isInteger(ticketNumber)) notFound();

  const { guildId } = requireDiscordContext();
  const ticket = await getTicketByNumber(supabaseAdmin, guildId, ticketNumber);
  if (!ticket) notFound();

  const adminUserId = await assertAdmin();
  const [snapshot, linkedAccount, adminDiscordId, categories, products, answers, tags] = await Promise.all([
    buildTicketSnapshot(ticket),
    getLinkedStreamWizardAccount(supabaseAdmin, ticket.opener_discord_user_id, ticket.opener_user_id),
    getDiscordUserIdForUser(supabaseAdmin, adminUserId),
    listTicketCategories(supabaseAdmin, guildId),
    listTicketProducts(supabaseAdmin, guildId),
    listTicketAnswers(supabaseAdmin, ticket.id),
    ticket.status === "open" ? listTicketTags(supabaseAdmin, guildId) : Promise.resolve([]),
  ]);

  return (
    <TicketPage
      snapshot={snapshot}
      config={{
        guildId,
        categories: categories.map((c) => ({
          slug: c.slug,
          name: c.name,
          active: isActiveCategory(c),
          claimingEnabled: c.claiming_enabled !== false,
        })),
        products: products.map((p) => ({ slug: p.slug, label: p.label })),
        answers: answers.map((a) => ({ id: a.id, label: a.label, value: a.value })),
        tags: tags.map((tag) => ({ name: tag.name, content: tag.content })),
        linkedAccount,
        linked: !!adminDiscordId,
      }}
    />
  );
}
