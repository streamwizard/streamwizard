"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Progress,
} from "@repo/ui";
import type { ObsNode, ObsNodeInstanceOwner } from "@repo/supabase/queries/obs-nodes";
import { createInstanceAction, listNodeInstancesAction, toggleInstanceAdminAction } from "@/actions/nodes";
import { useNodeMetricsStream, type ConnectionStatus, type ContainerMetrics } from "@/hooks/use-node-metrics-stream";
import { HostMetricsCharts } from "@/components/admin/metrics-charts";
import { RemoveInstanceDialog } from "@/components/admin/remove-instance-dialog";
import { DataList, type DataColumn } from "@/components/widgets/data-list";
import { PageHeader } from "@/components/widgets/page-header";
import { formatMb } from "@/lib/format";

const INSTANCES_POLL_INTERVAL_MS = 5000;

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

// The metrics socket is the only thing this page hears from the node, so its
// state doubles as the node's status in the page header.
function statusLabel(status: ConnectionStatus): { text: string; variant: BadgeVariant } {
  switch (status) {
    case "live":
      return { text: "Online", variant: "default" };
    case "connecting":
      return { text: "Connecting…", variant: "secondary" };
    case "unreachable":
      return { text: "Unreachable", variant: "destructive" };
    default:
      return { text: "Not linked", variant: "outline" };
  }
}

function instanceStatusVariant(status: string): BadgeVariant {
  if (status === "running") return "default";
  if (status === "creating") return "secondary";
  if (status === "error") return "destructive";
  return "outline";
}

function UsageBar({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-3 text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      <Progress value={Math.min(100, Math.max(0, pct))} />
    </div>
  );
}

const share = (used: number, total: number) => (total > 0 ? (used / total) * 100 : 0);

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium break-words">{children}</dd>
    </div>
  );
}

interface NodeInstanceListProps {
  nodeId: string;
  /** Without an API URL nothing on the node can be reached, so VNC is off. */
  hasApiUrl: boolean;
  instances: ObsNodeInstanceOwner[];
  /** Live container metrics by instance id; empty while the stream is down. */
  metrics: Record<string, ContainerMetrics>;
  pendingInstanceId: string | null;
  onToggle: (instance: ObsNodeInstanceOwner, action: "start" | "stop") => void;
  onRemove: (instance: ObsNodeInstanceOwner) => void;
  onVnc: (instance: ObsNodeInstanceOwner) => void;
}

/** Instances on one node. Start and Stop stay in view on every row; the rest
 *  sits behind the "more" button. */
export function NodeInstanceList({ nodeId, hasApiUrl, instances, metrics, pendingInstanceId, onToggle, onRemove, onVnc }: NodeInstanceListProps) {
  const columns: DataColumn<ObsNodeInstanceOwner>[] = [
    {
      key: "owner",
      header: "Owner",
      mobile: "title",
      // Long names wrap, so the Start/Stop column never slides out of the table.
      className: "max-w-48 whitespace-normal",
      cell: (instance) => <span className="font-medium break-words">{instance.owner_name ?? instance.owner_email ?? instance.user_id}</span>,
    },
    {
      key: "status",
      header: "Status",
      mobile: "badge",
      cell: (instance) => <Badge variant={instanceStatusVariant(instance.status)}>{instance.status}</Badge>,
    },
    {
      key: "container",
      header: "Container",
      className: "max-w-44 whitespace-normal",
      cell: (instance) => <span className="font-mono text-xs break-all">{instance.container_name}</span>,
    },
    {
      key: "cpu",
      header: "CPU",
      className: "tabular-nums",
      cell: (instance) => {
        const m = metrics[instance.id];
        return m ? `${m.cpu_pct.toFixed(1)}%` : "—";
      },
    },
    {
      key: "ram",
      header: "RAM",
      className: "hidden tabular-nums @4xl:table-cell",
      headClassName: "hidden @4xl:table-cell",
      cell: (instance) => {
        const m = metrics[instance.id];
        return m ? `${m.ram_used_mb} / ${m.ram_limit_mb} MB` : "—";
      },
    },
    {
      key: "vram",
      header: "VRAM",
      className: "hidden tabular-nums @4xl:table-cell",
      headClassName: "hidden @4xl:table-cell",
      cell: (instance) => {
        const m = metrics[instance.id];
        return m ? `${m.vram_used_mb} MB` : "—";
      },
    },
  ];

  return (
    <DataList
      rows={instances}
      rowKey={(instance) => instance.id}
      rowHref={(instance) => `/obs/${nodeId}/instances/${instance.id}`}
      columns={columns}
      actions={(instance) => {
        const isPending = pendingInstanceId === instance.id;
        const isRunning = instance.status === "running";
        const canToggle = instance.status === "running" || instance.status === "stopped" || instance.status === "error";
        return (
          <div className="flex items-center gap-2 @2xl:justify-end">
            <Button
              size="sm"
              variant="outline"
              className="h-11 min-w-20 md:h-8"
              disabled={!canToggle || isPending}
              onClick={() => onToggle(instance, isRunning ? "stop" : "start")}
            >
              {isPending ? "Working…" : isRunning ? "Stop" : "Start"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="size-11 md:size-8" aria-label={`More actions for ${instance.container_name}`}>
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* VNC needs a desktop: it is left out of the menu below 768px. */}
                <DropdownMenuItem className="hidden md:flex" disabled={!isRunning || !hasApiUrl} onSelect={() => onVnc(instance)}>
                  {!hasApiUrl ? "Open VNC (no API URL set)" : isRunning ? "Open VNC" : "Open VNC (start it first)"}
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" className="min-h-11 md:min-h-8" onSelect={() => onRemove(instance)}>
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      }}
    />
  );
}

export function NodeDetailClient({ node }: { node: ObsNode }) {
  const { status, latest, buffer } = useNodeMetricsStream(node.id, node.status, node.api_url);
  const [instances, setInstances] = useState<ObsNodeInstanceOwner[]>([]);
  const [pendingInstanceId, setPendingInstanceId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ObsNodeInstanceOwner | null>(null);
  const [isCreatingTestInstance, setIsCreatingTestInstance] = useState(false);
  const [showRecent, setShowRecent] = useState(false);

  useEffect(() => {
    if (node.status !== "linked") return;

    let cancelled = false;
    const poll = async () => {
      const { data } = await listNodeInstancesAction(node.id);
      if (!cancelled && data) setInstances(data);
    };

    poll();
    const interval = setInterval(poll, INSTANCES_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [node.id, node.status]);

  const handleToggleInstance = async (instance: ObsNodeInstanceOwner, action: "start" | "stop") => {
    if (!node.api_url) {
      toast.error("This node has no API URL set.");
      return;
    }
    setPendingInstanceId(instance.id);
    try {
      const { data: updated, error } = await toggleInstanceAdminAction(node.id, instance.id, action);
      if (!updated) throw new Error(error ?? "Request failed.");
      setInstances((prev) => prev.map((i) => (i.id === instance.id ? { ...i, status: updated.status } : i)));
      toast.success(`Container ${action === "start" ? "started" : "stopped"}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Couldn't reach "${instance.container_name}"'s node API.`);
    } finally {
      setPendingInstanceId(null);
    }
  };

  const askRemoveInstance = (instance: ObsNodeInstanceOwner) => {
    if (!node.api_url) {
      toast.error("This node has no API URL set.");
      return;
    }
    setRemoveTarget(instance);
  };

  const handleCreateTestInstance = async () => {
    if (!node.api_url) {
      toast.error("This node has no API URL set.");
      return;
    }
    setIsCreatingTestInstance(true);
    try {
      const { error } = await createInstanceAction(node.id);
      if (error) throw new Error(error);
      toast.success(`Test instance created on "${node.name}".`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create a test instance.");
    } finally {
      setIsCreatingTestInstance(false);
    }
  };

  // Opens the admin VNC viewer page in its own window rather than embedding
  // it inline -- noVNC wants the full viewport.
  const openVnc = (instance: ObsNodeInstanceOwner) => {
    if (!node.api_url) return;
    const params = new URLSearchParams({
      nodeId: node.id,
      instanceId: instance.id,
      name: instance.container_name,
    });
    window.open(`/vnc?${params.toString()}`, `vnc-${instance.id}`, "width=1280,height=800");
  };

  const { text, variant } = statusLabel(status);

  return (
    <div className="space-y-6">
      <PageHeader title={node.name} description={`${node.api_url ?? "No API URL set"} · Tailscale ${node.tailscale_ip ?? "—"}`}>
        <Badge variant={variant}>{text}</Badge>
        {node.maintenance && <Badge variant="secondary">Maintenance</Badge>}
        <Button
          size="sm"
          variant="outline"
          className="h-11 md:h-8"
          disabled={node.status !== "linked" || isCreatingTestInstance}
          onClick={handleCreateTestInstance}
        >
          {isCreatingTestInstance ? "Creating…" : "Create test instance"}
        </Button>
      </PageHeader>

      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle>Instances</CardTitle>
          <CardDescription>Containers provisioned on this node.</CardDescription>
        </CardHeader>
        {/* Phone cards run edge to edge; the table keeps the card's padding. */}
        <CardContent className="px-0 sm:px-6">
          {instances.length === 0 ? (
            <p className="px-4 text-sm text-muted-foreground sm:px-0">No instances on this node.</p>
          ) : (
            <NodeInstanceList
              nodeId={node.id}
              hasApiUrl={!!node.api_url}
              instances={instances}
              metrics={latest?.containers ?? {}}
              pendingInstanceId={pendingInstanceId}
              onToggle={handleToggleInstance}
              onRemove={askRemoveInstance}
              onVnc={openVnc}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live metrics</CardTitle>
          <CardDescription>Pushed by the node every few seconds.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {node.status !== "linked" ? (
            <p className="text-sm text-muted-foreground">Metrics are available once this node is linked.</p>
          ) : status !== "live" || !latest ? (
            <p className="text-sm text-muted-foreground">
              {status === "connecting"
                ? "Connecting to the node's metrics stream…"
                : "Couldn't reach this node's metrics stream. Check that obs-instance-manager is running and reachable at its API URL."}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-3 rounded-lg border p-3">
                  <p className="text-sm font-medium break-words">{latest.host.gpu_name}</p>
                  <UsageBar
                    label="VRAM"
                    value={`${latest.host.vram_used_mb.toLocaleString()} / ${latest.host.vram_total_mb.toLocaleString()} MB`}
                    pct={share(latest.host.vram_used_mb, latest.host.vram_total_mb)}
                  />
                  <UsageBar label="GPU" value={`${latest.host.gpu_util_pct}%`} pct={latest.host.gpu_util_pct} />
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground tabular-nums">
                    <span>GPU temp: {latest.host.gpu_temp_c}°C</span>
                    <span>NVENC fps: {latest.host.nvenc_avg_fps}</span>
                    <span>Mem ctrl: {latest.host.mem_controller_util_pct}%</span>
                  </div>
                </div>
                <div className="space-y-3 rounded-lg border p-3">
                  <p className="text-sm font-medium">Host</p>
                  <UsageBar
                    label="RAM"
                    value={`${latest.host.ram_used_mb.toLocaleString()} / ${latest.host.ram_total_mb.toLocaleString()} MB`}
                    pct={share(latest.host.ram_used_mb, latest.host.ram_total_mb)}
                  />
                  <UsageBar label="CPU" value={`${latest.host.cpu_pct.toFixed(1)}%`} pct={latest.host.cpu_pct} />
                </div>
              </div>

              {/* The same CPU, RAM and GPU numbers as the bars above and the
                  history below, at stream resolution. Folded away, and not
                  mounted until someone asks for it. */}
              <Collapsible open={showRecent} onOpenChange={setShowRecent}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="-ml-2 h-11 md:h-8">
                    <ChevronDown className={showRecent ? "rotate-180 transition-transform" : "transition-transform"} aria-hidden="true" />
                    {showRecent ? "Hide the last 5 minutes" : "Show the last 5 minutes"}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <HostMetricsCharts samples={buffer} />
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Node</CardTitle>
          <CardDescription>Capacity you set, plus the hardware the node reported when it linked.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
            <Fact label="Max instances">{node.max_instances}</Fact>
            <Fact label="Hostname">{node.hostname ?? "Not linked yet"}</Fact>
            <Fact label="GPU model">{node.gpu_model ?? "Not linked yet"}</Fact>
            <Fact label="GPU bus ID">{node.gpu_bus_id ?? "Not linked yet"}</Fact>
            <Fact label="Total VRAM">{formatMb(node.total_vram_mb, "Not linked yet")}</Fact>
            <Fact label="RAM total">{formatMb(node.ram_total_mb, "Not linked yet")}</Fact>
            <Fact label="CPU cores">{node.cpu_cores ?? "Not linked yet"}</Fact>
            <Fact label="Storage total">{formatMb(node.storage_total_mb, "Not linked yet")}</Fact>
          </dl>
        </CardContent>
      </Card>

      <RemoveInstanceDialog
        nodeId={node.id}
        instance={removeTarget}
        onClose={() => setRemoveTarget(null)}
        onRemoved={(instanceId) => {
          setInstances((prev) => prev.filter((i) => i.id !== instanceId));
          setRemoveTarget(null);
        }}
      />
    </div>
  );
}
