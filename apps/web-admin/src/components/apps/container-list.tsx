import type { AppContainer } from "@repo/metrics";
import { relative } from "@/components/backups/backup-format";
import { When } from "@/components/backups/hint-popover";
import { DataList, type DataColumn } from "@/components/widgets/data-list";
import { StatusIndicator, type IndicatorStatus } from "@/components/widgets/status-indicator";
import { isFailedExit } from "@/lib/apps-model";

function stateDisplay(c: AppContainer, live: boolean): { indicator: IndicatorStatus; label: string } {
  if (c.state === "running") {
    // Docker removes old tasks without telling anyone: its last word was "running".
    if (!live) return { indicator: "muted", label: "Removed" };
    if (c.health === "unhealthy") return { indicator: "crit", label: "Unhealthy" };
    if (c.health === "starting") return { indicator: "warn", label: "Starting" };
    return { indicator: "ok", label: c.health === "healthy" ? "Healthy" : "Running" };
  }
  if (c.oomKilled) return { indicator: "crit", label: "Out of memory" };
  if (isFailedExit(c)) return { indicator: "crit", label: "Failed" };
  return { indicator: "muted", label: c.state === "exited" ? "Stopped" : c.state || "Unknown" };
}

/** Why a container stopped, in words: the exit code alone means little. */
function exitText(c: AppContainer): string {
  if (c.state === "running" || c.exitCode === null) return "—";
  if (c.oomKilled) return `${c.exitCode}, killed for memory`;
  if (c.exitCode === 0) return "0, clean stop";
  if (c.exitCode === 143) return "143, stopped by Docker (deploy)";
  if (c.exitCode === 137) return "137, killed";
  return String(c.exitCode);
}

/** The containers of one app in the last 24 hours, newest first: this is where a restart shows. */
export function ContainerList({ containers, liveNames }: { containers: AppContainer[]; liveNames: string[] }) {
  const live = new Set(liveNames);
  const columns: DataColumn<AppContainer>[] = [
    {
      key: "name",
      header: "Container",
      mobile: "title",
      cell: (c) => <span className="font-mono text-xs break-all">{c.name}</span>,
    },
    {
      key: "state",
      header: "State",
      mobile: "badge",
      cell: (c) => {
        const state = stateDisplay(c, live.has(c.name));
        return <StatusIndicator status={state.indicator} label={state.label} />;
      },
    },
    { key: "started", header: "Started", className: "whitespace-nowrap", cell: (c) => <When iso={c.startedAt} label={c.startedAt ? relative(c.startedAt) : "—"} /> },
    {
      key: "stopped",
      header: "Stopped",
      className: "whitespace-nowrap",
      cell: (c) => (c.state === "running" || !c.finishedAt ? "—" : <When iso={c.finishedAt} label={relative(c.finishedAt)} />),
    },
    { key: "exit", header: "Exit code", cell: exitText },
  ];

  if (containers.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">No containers seen in the last 24 hours.</p>;
  }
  return <DataList columns={columns} rows={containers} rowKey={(c) => c.name} />;
}
