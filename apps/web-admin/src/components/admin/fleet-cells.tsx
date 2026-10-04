import { Badge } from "@repo/ui";
import { StatusIndicator, type IndicatorStatus } from "@/components/widgets/status-indicator";
import type { FleetNode } from "@/lib/node-fleet";

// Cells shared by the OBS and ingest fleet lists, so health and registry state
// read the same on both pages. No hooks: usable from server and client code.

const HEALTH_DISPLAY: Record<FleetNode["health"], { status: IndicatorStatus; label: string }> = {
  healthy: { status: "ok", label: "Healthy" },
  unreachable: { status: "crit", label: "Unreachable" },
  unknown: { status: "muted", label: "No health URL" },
};

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 90) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

/** "12s ago" drifts between the server render and hydration a moment later,
 *  so the mismatch is expected and silenced here. */
export function RelativeTime({ iso }: { iso: string | null | undefined }) {
  return <span suppressHydrationWarning>{relativeTime(iso)}</span>;
}

/** What the probe said: latency when it answered, the failure when it did not. */
export function healthCheckText(node: FleetNode | null): string {
  if (!node || node.health === "unknown") return "—";
  if (node.health === "healthy") return node.healthLatencyMs === null ? "OK" : `${node.healthLatencyMs} ms`;
  return node.healthDetail ?? "No answer";
}

/** Health dot and label. The probe result sits under it in the table (the
 *  list's own width decides, hence the container variant); the card layout
 *  shows it as its own field. `node` is null when the registry
 *  could not be read, so there was nothing to probe. */
export function FleetHealth({ node }: { node: FleetNode | null }) {
  if (!node) return <StatusIndicator status="muted" label="Unknown" />;
  const health = HEALTH_DISPLAY[node.health];
  return (
    <div>
      <StatusIndicator status={health.status} label={health.label} />
      {node.health !== "unknown" && (
        <div className="mt-0.5 hidden max-w-48 text-xs break-words whitespace-normal text-muted-foreground tabular-nums @2xl:block">
          {healthCheckText(node)}
        </div>
      )}
    </div>
  );
}

/** Registry state under the node's name. "linked" is the normal case and
 *  says nothing, so only a node in another state, or in maintenance, gets a
 *  badge. */
export function FleetState({ status, maintenance }: { status: string | null; maintenance: boolean }) {
  const offNormal = status !== null && status !== "linked";
  if (!offNormal && !maintenance) return null;
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1.5 font-normal">
      {offNormal && <Badge variant="secondary">{status}</Badge>}
      {maintenance && <Badge variant="secondary">maintenance</Badge>}
    </span>
  );
}
