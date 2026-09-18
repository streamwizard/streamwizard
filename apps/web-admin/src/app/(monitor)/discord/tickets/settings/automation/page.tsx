import { supabaseAdmin } from "@repo/supabase/next/admin";
import { parseWorkingHours } from "@repo/supabase/queries/ticket-hours";
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
    closeMode: (settings?.close_mode ?? "staff_only") as "staff_only" | "request" | "either",
    closeRequestHours: settings?.close_request_hours ?? 24,
    workingHours: parseWorkingHours(settings?.working_hours),
  };

  return <TicketAutomationForm key={JSON.stringify(initial)} initial={initial} />;
}
