import Link from "next/link";
import { Button } from "@repo/ui";
import { TicketSettingsNav } from "@/components/discord/ticket-settings-nav";
import { PageHeader } from "@/components/widgets/page-header";

export default function DiscordTicketSettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Ticket settings" description="How support tickets work in the StreamWizard server.">
        <Button variant="outline" size="sm" asChild>
          <Link href="/discord/tickets">All tickets</Link>
        </Button>
      </PageHeader>
      <TicketSettingsNav />
      {children}
    </div>
  );
}
