import { PageTabs } from "@/components/shared/page-tabs";
import { IngestLiveProvider } from "@/lib/ingest-live-context";
import { monitorWsUrl } from "@/lib/monitor-config";
import { PageHeader } from "@/components/shared/page-header";
import { LiveIndicator } from "@/components/shared/live-indicator";
import { IngestFleetTab } from "@/components/ingest/ingest-fleet-tab";
import { IngestLiveTab } from "@/components/ingest/ingest-live-tab";
import { IngestManageTab } from "@/components/ingest/ingest-manage-tab";

export const dynamic = "force-dynamic";

const DESCRIPTIONS = {
  fleet: "Health and load of the boxes that take in SRT and SRTLA.",
  live: "Streams and bandwidth as the monitor socket reports them.",
  manage: "Register, edit and delete ingest boxes.",
} as const;

export default async function IngestDashboard({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const { tab } = await searchParams;
  const view = tab === "live" || tab === "manage" ? tab : "fleet";

  return (
    <div className="space-y-6">
      <PageHeader title="Ingest servers" description={DESCRIPTIONS[view]}>
        {/* Fleet follows the header's refresh. Live has its own socket status; Manage is read once. */}
        {view === "fleet" && <LiveIndicator />}
      </PageHeader>
      <PageTabs
        label="Ingest servers sections"
        tabs={[
          { href: "/ingest", label: "Fleet", active: view === "fleet" },
          { href: "/ingest?tab=live", label: "Live", active: view === "live" },
          { href: "/ingest?tab=manage", label: "Manage", active: view === "manage" },
        ]}
      />
      {view === "manage" ? (
        <IngestManageTab />
      ) : (
        // One shared monitor WebSocket for every live consumer below: the
        // Live tab, and the Fleet list's network column.
        <IngestLiveProvider wsUrl={monitorWsUrl()}>
          {view === "live" ? <IngestLiveTab /> : <IngestFleetTab />}
        </IngestLiveProvider>
      )}
    </div>
  );
}
