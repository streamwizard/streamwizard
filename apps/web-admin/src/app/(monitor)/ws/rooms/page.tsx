import { PageHeader } from "@/components/widgets/page-header";
import { WsMonitorProvider } from "@/components/ws-monitor-provider";
import { WsRoomTable } from "@/components/ws-room-table";
import { MonitorUnconfigured } from "@/components/ws/monitor-unconfigured";
import { monitorWsUrl } from "@/lib/monitor-config";

export default function WsRoomsPage() {
  const wsUrl = monitorWsUrl();

  if (!wsUrl) {
    return (
      <div className="space-y-2">
        <PageHeader title="Rooms" />
        <MonitorUnconfigured what="room monitoring" />
      </div>
    );
  }

  return (
    <WsMonitorProvider wsUrl={wsUrl}>
      <WsRoomTable />
    </WsMonitorProvider>
  );
}
