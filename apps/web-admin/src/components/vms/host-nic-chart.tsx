"use client";

import { useState } from "react";
import { Label, Switch } from "@repo/ui";
import { NodeMetricChart, type NodeMetricPoint } from "@/components/charts/node-metric-chart";

// Per-VM firewall bridges and tap devices, loopback: one pair per guest NIC,
// so they drown out the physical ports and bridges by default.
const VIRTUAL_NICS = "^(fwbr|fwln|fwpr|tap|veth|lo )";

/** Host network per interface, with a switch to include the per-VM devices. */
export function HostNicChart({ apiPath, initialData }: { apiPath: string; initialData: NodeMetricPoint[] }) {
  const [all, setAll] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-2">
        <Switch id="show-all-nics" checked={all} onCheckedChange={setAll} />
        <Label htmlFor="show-all-nics" className="text-xs text-muted-foreground">
          Show VM interfaces
        </Label>
      </div>
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
