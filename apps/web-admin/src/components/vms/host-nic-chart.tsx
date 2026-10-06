"use client";

import { useState } from "react";
import { Label, Switch } from "@repo/ui";
import { NodeMetricChart, type NodeMetricPoint } from "@/components/charts/node-metric-chart";
import { cn } from "@/lib/utils";

// Per-VM firewall bridges and tap devices, loopback: one pair per guest NIC,
// so they drown out the physical ports and bridges by default.
const VIRTUAL_NICS = "^(fwbr|fwln|fwpr|tap|veth|lo )";

/** Host network per interface, with a switch to include the per-VM devices. */
export function HostNicChart({ apiPath, initialData, className }: { apiPath: string; initialData: NodeMetricPoint[]; className?: string }) {
  const [all, setAll] = useState(false);
  return (
    <div className={cn("space-y-2", className)}>
      {/* The whole label is the tap target: 44px on a phone, compact from 768px. */}
      <Label htmlFor="show-all-nics" className="ml-auto flex min-h-11 w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground md:min-h-0">
        <Switch id="show-all-nics" checked={all} onCheckedChange={setAll} />
        Show VM interfaces
      </Label>
      <NodeMetricChart
        title="Network per interface"
        apiPath={apiPath}
        dataKey="nics"
        initialData={initialData}
        format="bytesPerSec"
        excludePattern={all ? undefined : VIRTUAL_NICS}
      />
    </div>
  );
}
