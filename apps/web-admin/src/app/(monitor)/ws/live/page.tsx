import { DesktopOnly } from "@/components/shared/desktop-only";
import { WsMonitorProvider } from "@/providers/ws-monitor-provider";
import { WsLiveFeed } from "@/components/ws/ws-live-feed";
import { MonitorUnconfigured } from "@/components/ws/monitor-unconfigured";
import { monitorWsUrl } from "@/lib/monitor-config";

export default function WsLivePage() {
  const wsUrl = monitorWsUrl();

  if (!wsUrl) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Live feed</h1>
        <MonitorUnconfigured what="the live monitor" />
      </div>
    );
  }

  return (
    // Phones get the Rooms tab instead; the socket only opens once the tool mounts.
    <DesktopOnly tool="The live feed" backHref="/ws/rooms" backLabel="Open rooms">
      <WsMonitorProvider wsUrl={wsUrl}>
        <WsLiveFeed />
      </WsMonitorProvider>
    </DesktopOnly>
  );
}
