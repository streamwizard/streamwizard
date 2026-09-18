import { parseTicketMessages } from "@repo/discord-message";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { hasWorkingHours, parseWorkingHours } from "@repo/supabase/queries/ticket-hours";
import { getTicketSettings } from "@repo/supabase/queries/tickets";
import { TicketMessagesForm } from "@/components/discord/ticket-messages-form";
import { requireDiscordContext } from "@/lib/discord/api";

export const dynamic = "force-dynamic";

export default async function DiscordTicketMessagesPage() {
  const { guildId } = requireDiscordContext();
  const settings = await getTicketSettings(supabaseAdmin, guildId);
  const initial = parseTicketMessages(settings?.messages);

  return (
    <TicketMessagesForm
      key={JSON.stringify(initial)}
      initial={initial}
      dmOnClose={settings?.dm_on_close ?? true}
      staleOn={!!settings?.stale_after_hours}
      autoCloseOn={!!settings?.stale_after_hours && !!settings?.auto_close_after_hours}
      closeRequestsOn={settings?.close_mode === "request"}
      workingHoursOn={hasWorkingHours(parseWorkingHours(settings?.working_hours))}
    />
  );
}
