import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getTicketSettings } from "@repo/supabase/queries/tickets";
import { TicketAutomationForm } from "@/components/discord/ticket-automation-form";
import { requireDiscordContext } from "@/lib/discord/api";

export const dynamic = "force-dynamic";

export default async function DiscordTicketAutomationPage() {
  const { guildId } = requireDiscordContext();
  const settings = await getTicketSettings(supabaseAdmin, guildId);
  const initial = {
    staleAfterHours: settings?.stale_after_hours ?? null,
    autoCloseAfterHours: settings?.auto_close_after_hours ?? null,
  };

  return <TicketAutomationForm key={JSON.stringify(initial)} initial={initial} />;
}
