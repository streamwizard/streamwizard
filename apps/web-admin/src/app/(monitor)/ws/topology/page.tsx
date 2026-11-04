import { DesktopOnly } from "@/components/shared/page/desktop-only";
import { WsMonitorProvider } from "@/providers/ws-monitor-provider";
import { WsTopology } from "@/components/topology/ws-topology";
import { MonitorUnconfigured } from "@/components/ws/monitor-unconfigured";
import { monitorWsUrl } from "@/lib/monitor/monitor-config";

export default function WsTopologyPage() {
  const wsUrl = monitorWsUrl();

  if (!wsUrl) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Topology</h1>
        <MonitorUnconfigured what="the topology view" />
      </div>
    );
  }

  return (
    // Phones get the Rooms tab instead; the socket only opens once the tool mounts.
    <DesktopOnly tool="The topology graph" backHref="/ws/rooms" backLabel="Open rooms">
      <WsMonitorProvider wsUrl={wsUrl}>
        <WsTopology />
      </WsMonitorProvider>
    </DesktopOnly>
  );
}
