import { PageHeader } from "@/components/shared/page/page-header";
import { WsMonitorProvider } from "@/providers/ws-monitor-provider";
import { WsRoomTable } from "@/components/ws/ws-room-table";
import { MonitorUnconfigured } from "@/components/ws/monitor-unconfigured";
import { monitorWsUrl } from "@/lib/monitor/monitor-config";

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
