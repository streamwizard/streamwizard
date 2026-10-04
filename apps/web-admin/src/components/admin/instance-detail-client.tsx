"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";
import type { ObsNode, ObsNodeInstanceDetail } from "@repo/supabase/queries/obs-nodes";
import { useNodeMetricsStream, type ConnectionStatus } from "@/hooks/use-node-metrics-stream";
import { toggleInstanceAdminAction } from "@/actions/nodes";
import { formatMb } from "@/lib/format";
import { ContainerMetricsCharts } from "@/components/admin/metrics-charts";
import { RemoveInstanceDialog } from "@/components/admin/remove-instance-dialog";

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

function statusLabel(status: ConnectionStatus): { text: string; variant: BadgeVariant } {
  switch (status) {
    case "live":
      return { text: "Live", variant: "default" };
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

interface InstanceActionsProps {
  nodeId: string;
  apiUrl: string | null;
  instance: { id: string; container_name: string; status: string };
}

/** The buttons in the instance page header: Start or Stop, VNC and Remove.
 *  They sit above the tabs so they stay in reach on every one of them. */
export function InstanceActions({ nodeId, apiUrl, instance }: InstanceActionsProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [removing, setRemoving] = useState(false);

  // What the node answered, shown until the refreshed server render catches up.
  const [answered, setAnswered] = useState<{ from: string; to: string } | null>(null);
  const status = answered?.from === instance.status ? answered.to : instance.status;

  const isRunning = status === "running";
  const canToggle = status === "running" || status === "stopped" || status === "error";

  const handleToggle = async () => {
    if (!apiUrl) {
      toast.error("This node has no API URL set.");
      return;
    }
    setIsPending(true);
    try {
      const { data: updated, error } = await toggleInstanceAdminAction(nodeId, instance.id, isRunning ? "stop" : "start");
      if (!updated) throw new Error(error ?? "Request failed.");
      setAnswered({ from: instance.status, to: updated.status });
      toast.success(`Container ${isRunning ? "stopped" : "started"}.`);
      // The status lives in the server render (details, Auto switcher tab), so re-read it.
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Couldn't reach "${instance.container_name}"'s node API.`);
    } finally {
      setIsPending(false);
    }
  };

  const openVnc = () => {
    if (!apiUrl) return;
    const params = new URLSearchParams({
      nodeId,
      instanceId: instance.id,
      name: instance.container_name,
    });
    window.open(`/vnc?${params.toString()}`, `vnc-${instance.id}`, "width=1280,height=800");
  };

  return (
    <>
      <Button size="sm" variant="outline" className="h-11 min-w-20 md:h-8" disabled={!canToggle || isPending || !apiUrl} onClick={handleToggle}>
        {isPending ? "Working…" : isRunning ? "Stop" : "Start"}
      </Button>
      {/* VNC needs a desktop: the button is not shown below 768px. */}
      <Button size="sm" variant="outline" className="hidden md:inline-flex" disabled={!isRunning || !apiUrl} onClick={openVnc}>
        VNC
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-11 text-destructive hover:text-destructive md:h-8"
        onClick={() => {
          if (!apiUrl) {
            toast.error("This node has no API URL set.");
            return;
          }
          setRemoving(true);
        }}
      >
        Remove
      </Button>
      <RemoveInstanceDialog
        nodeId={nodeId}
        instance={removing ? instance : null}
        onClose={() => setRemoving(false)}
        onRemoved={() => {
          // The instance is gone, so is this page: back to its node.
          setRemoving(false);
          router.push(`/obs/${nodeId}`);
        }}
      />
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium break-words">{children}</dd>
    </div>
  );
}

export function InstanceDetailClient({ node, instance }: { node: ObsNode; instance: ObsNodeInstanceDetail }) {
  const { status, latest, buffer } = useNodeMetricsStream(node.id, node.status, node.api_url);

  const containerMetrics = latest?.containers[instance.id];
  const { text, variant } = statusLabel(status);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Instance details</CardTitle>
          <CardDescription>Configuration and ownership for this container.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Detail label="Status">
              <Badge variant={instanceStatusVariant(instance.status)}>{instance.status}</Badge>
            </Detail>
            <Detail label="Resolution">{instance.resolution}</Detail>
            <Detail label="VRAM allocated">{instance.vram_allocated_mb} MB</Detail>
            <Detail label="Created">
              {/* Formatted in the viewer's time zone, which the server render cannot know. */}
              <span suppressHydrationWarning>{new Date(instance.created_at).toLocaleString("en-US")}</span>
            </Detail>
            <Detail label="Owner">{instance.owner_name ?? instance.owner_email ?? instance.user_id}</Detail>
            <Detail label="Container ID">
              <span className="font-mono text-xs font-normal break-all">{instance.container_id ?? "—"}</span>
            </Detail>
            <Detail label="RAM limit">{formatMb(instance.memory_mb)}</Detail>
            <Detail label="CPU quota">{instance.cpu_quota}</Detail>
            <Detail label="Shared memory">{instance.shm_size}</Detail>
            <Detail label="Config template">{instance.config_template ?? "—"}</Detail>
            <Detail label="Storage">
              {instance.used_storage_bytes != null ? formatMb(Math.round(instance.used_storage_bytes / (1024 * 1024))) : "—"}
              {" / "}
              {formatMb(instance.storage_quota_mb)}
            </Detail>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center gap-2">
          <CardTitle>Live metrics</CardTitle>
          <Badge variant={variant}>{text}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {node.status !== "linked" ? (
            <p className="text-sm text-muted-foreground">Metrics are available once this instance&apos;s node is linked.</p>
          ) : status !== "live" || !containerMetrics ? (
            <p className="text-sm text-muted-foreground">
              {status === "connecting"
                ? "Connecting to the node's metrics stream…"
                : status === "live"
                  ? "This instance isn't reporting metrics yet. It may not be running."
                  : "Couldn't reach this node's metrics stream."}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3 sm:gap-4">
                <div className="flex items-baseline justify-between gap-3 rounded-lg border p-3 sm:block">
                  <p className="text-xs text-muted-foreground">CPU</p>
                  <p className="font-medium tabular-nums">{containerMetrics.cpu_pct.toFixed(1)}%</p>
                </div>
                <div className="flex items-baseline justify-between gap-3 rounded-lg border p-3 sm:block">
                  <p className="text-xs text-muted-foreground">RAM</p>
                  <p className="font-medium tabular-nums">
                    {containerMetrics.ram_used_mb} / {containerMetrics.ram_limit_mb} MB
                  </p>
                </div>
                <div className="flex items-baseline justify-between gap-3 rounded-lg border p-3 sm:block">
                  <p className="text-xs text-muted-foreground">VRAM</p>
                  <p className="font-medium tabular-nums">{containerMetrics.vram_used_mb} MB</p>
                </div>
              </div>
              <ContainerMetricsCharts samples={buffer} instanceId={instance.id} vramMaxMb={instance.vram_allocated_mb} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
