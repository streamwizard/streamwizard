import { supabaseAdmin } from "@repo/supabase/next/admin";
import { listUserTickets } from "@repo/supabase/queries/admin-users";
import { listTicketCategories, listTicketProducts } from "@repo/supabase/queries/ticket-config";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@repo/ui";
import { TicketList } from "@/components/discord/ticket-list";
import { getDiscordContext } from "@/lib/discord/api";
import { resolveDiscordProfiles } from "@/lib/discord/users";
import { loadAdminUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function UserTicketsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await loadAdminUser(id);
  // Which tickets are theirs (newest 100) comes from the shared query. It reads
  // a short column list, so the full rows the list needs for its state badges
  // are read by id here.
  const found = await listUserTickets(supabaseAdmin, user.id, user.discord?.userId ?? null);

  if (!found.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>No tickets</EmptyTitle>
          <EmptyDescription>
            {user.discord
              ? "Nothing opened from this account or its Discord."
              : "Nothing opened from this account. Tickets opened in Discord before linking only show once Discord is linked."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const guildId = getDiscordContext()?.guildId;
  const [rows, categories, products] = await Promise.all([
    supabaseAdmin
      .from("discord_tickets")
      .select("*")
      .in(
        "id",
        found.map((ticket) => ticket.id),
      )
      .order("created_at", { ascending: false }),
    // Without the Discord env there is nothing to label with; the list falls back to the slugs.
    guildId ? listTicketCategories(supabaseAdmin, guildId) : [],
    guildId ? listTicketProducts(supabaseAdmin, guildId) : [],
  ]);
  if (rows.error) throw rows.error;
  const tickets = rows.data;

  const profiles = await resolveDiscordProfiles(
    tickets.flatMap((t) => [
      t.claimed_by_name ? null : t.claimed_by_discord_user_id,
      t.closed_by_name ? null : t.closed_by_discord_user_id,
    ]),
  );

  return (
    <TicketList
      tickets={tickets}
      categoryNames={new Map(categories.map((c) => [c.slug, c.name]))}
      productLabels={new Map(products.map((p) => [p.slug, p.label]))}
      profiles={Object.fromEntries(profiles)}
      hideOpener
    />
  );
}
