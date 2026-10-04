import { PageTabs } from "@/components/page-tabs";
import { PageHeader } from "@/components/widgets/page-header";

const BASE = "/discord/tickets/settings";

const SECTIONS = [
  { href: BASE, label: "General", exact: true },
  { href: `${BASE}/panel`, label: "Panel" },
  { href: `${BASE}/categories`, label: "Categories" },
  { href: `${BASE}/products`, label: "Products" },
  { href: `${BASE}/messages`, label: "Messages" },
  { href: `${BASE}/automation`, label: "Automation" },
  { href: `${BASE}/tags`, label: "Tags" },
];

export default function DiscordTicketSettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Ticket settings" description="How support tickets work in the StreamWizard server." />
      <PageTabs label="Ticket settings" variant="pills" tabs={SECTIONS} />
      {children}
    </div>
  );
}
