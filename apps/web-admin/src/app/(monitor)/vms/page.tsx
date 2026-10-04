import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { STREAMWIZARD_VM_TAG, VM_ALERT_RULES } from "@repo/alerting/rules";
import { PageHeader } from "@/components/widgets/page-header";
import { getGuestNet } from "@/lib/pve";
import { OtherVms } from "@/components/vms/other-vms";
import { HostCard } from "@/components/vms/host-card";
import { VmTable } from "@/components/vms/vm-table";
import { AutoRefresh } from "@/components/vms/auto-refresh";
import { getVmOverview, guestRef, splitVms, toTableRow, type VmOverview } from "@/lib/vms";

export const dynamic = "force-dynamic";

const header = <PageHeader title="VMs" description="Proxmox hosts and guests: state, load, storage and IPs. Live from the metrics Proxmox pushes." />;

function Message({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      {header}
      <Card>
        <CardContent className="space-y-2 py-10 text-center text-sm text-muted-foreground">{children}</CardContent>
      </Card>
    </div>
  );
}

export default async function VmsPage() {
  let overview: VmOverview;
  try {
    overview = await getVmOverview();
  } catch (error) {
    return <Message>{(error as Error).message}</Message>;
  }
  const { hosts, vms } = overview;
  const { ours, others } = splitVms(vms);

  if (hosts.length === 0 && vms.length === 0) {
    return (
      <Message>
        <p className="font-medium text-foreground">No Proxmox hosts yet.</p>
        <p>Point the Proxmox metric server (Datacenter → Metric Server) at the proxmox bucket and they show up here.</p>
      </Message>
    );
  }

  // Not awaited: the table renders now, IPs, agent state and disk stream in.
  const net = getGuestNet(vms.map(guestRef));

  return (
    <div className="space-y-6">
      <AutoRefresh />
      {header}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {hosts.map((host) => {
          const mine = vms.filter((v) => v.guest.nodename === host.name);
          return <HostCard key={host.name} host={host} guests={mine.length} running={mine.filter((v) => v.guest.status === "running" && !v.stale).length} />;
        })}
      </div>

      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-base">StreamWizard VMs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <VmTable rows={ours.map(toTableRow)} ruleCount={VM_ALERT_RULES.length} net={net} emptyText={`No VMs tagged ${STREAMWIZARD_VM_TAG} yet.`} />
        </CardContent>
      </Card>

      <OtherVms rows={others.map(toTableRow)} net={net} />
    </div>
  );
}
