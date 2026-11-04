import { PageTabs } from "@/components/shared/page-tabs";
import { LiveIndicator } from "@/components/shared/live-indicator";
import { PageHeader } from "@/components/shared/page-header";
import { ObsFleetTab } from "@/components/obs/obs-fleet-tab";
import { ObsManageTab } from "@/components/obs/obs-manage-tab";

export const dynamic = "force-dynamic";

export default async function ObsDashboard({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const { tab } = await searchParams;
  const view = tab === "manage" ? "manage" : "fleet";

  return (
    <div className="space-y-6">
      <PageHeader
        title="OBS nodes"
        description={view === "manage" ? "Register, edit and delete the GPU hosts that run Cloud OBS." : "Health and load of the GPU hosts that run Cloud OBS."}
      >
        {/* Everything on Fleet follows the header's refresh; Manage is read once. */}
        {view === "fleet" && <LiveIndicator />}
      </PageHeader>
      <PageTabs
        label="OBS nodes sections"
        tabs={[
          { href: "/obs", label: "Fleet", active: view === "fleet" },
          { href: "/obs?tab=manage", label: "Manage", active: view === "manage" },
        ]}
      />
      {view === "manage" ? <ObsManageTab /> : <ObsFleetTab />}
    </div>
  );
}
