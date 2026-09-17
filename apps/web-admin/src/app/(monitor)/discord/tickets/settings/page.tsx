import { Ticket, TicketCheck } from "lucide-react";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { countOpenTickets, getTicketSettings } from "@repo/supabase/queries/tickets";
import { TicketsForm } from "@/components/discord/tickets-form";
import { StatCard } from "@/components/widgets/stat-card";
import { getGuildChannels, getGuildRoles, requireDiscordContext } from "@/lib/discord/api";
import { toChannelOptions, toRoleOptions } from "@/lib/discord/options";

export const dynamic = "force-dynamic";

export default async function DiscordTicketSettingsPage() {
  const { guildId } = requireDiscordContext();
  const [settings, openTickets, channels, roles] = await Promise.all([
    getTicketSettings(supabaseAdmin, guildId),
    countOpenTickets(supabaseAdmin, guildId),
    getGuildChannels(),
    getGuildRoles(),
  ]);

  const initial = {
    enabled: settings?.enabled ?? false,
    staffRoleId: settings?.staff_role_id ?? null,
    categoryId: settings?.category_id ?? null,
    panelChannelId: settings?.panel_channel_id ?? null,
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard title="Open tickets" value={openTickets} icon={Ticket} />
        <StatCard title="Tickets opened all time" value={settings?.ticket_counter ?? 0} icon={TicketCheck} />
      </div>
      <TicketsForm
        key={JSON.stringify(settings)}
        initial={initial}
        textChannels={toChannelOptions(channels, ["text"])}
        categories={toChannelOptions(channels, ["category"])}
        roles={toRoleOptions(roles)}
        hasPanel={!!settings?.panel_message_id}
      />
    </div>
  );
}
