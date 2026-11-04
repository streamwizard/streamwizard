import { DesktopOnly } from "@/components/shared/desktop-only";
import { WsMonitorProvider } from "@/providers/ws-monitor-provider";
import { WsRoomTopology } from "@/components/topology/ws-room-topology";
import { MonitorUnconfigured } from "@/components/ws/monitor-unconfigured";
import { PageCrumb } from "@/lib/crumbs";
import { monitorWsUrl } from "@/lib/monitor-config";

export default async function WsRoomTopologyPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const wsUrl = monitorWsUrl();

  if (!wsUrl) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Room topology</h1>
        <MonitorUnconfigured what="the topology view" />
      </div>
    );
  }

  return (
    <>
      <PageCrumb label={decodeURIComponent(roomId)} href={`/ws/topology/${roomId}`} />
      <DesktopOnly tool="The room graph" backHref="/ws/rooms" backLabel="Open rooms">
        <WsMonitorProvider wsUrl={wsUrl}>
          <WsRoomTopology roomId={decodeURIComponent(roomId)} />
        </WsMonitorProvider>
      </DesktopOnly>
    </>
  );
}
