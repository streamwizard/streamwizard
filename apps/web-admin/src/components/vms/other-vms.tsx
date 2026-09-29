import { ChevronRight } from "lucide-react";
import { Card } from "@repo/ui";
import { STREAMWIZARD_VM_TAG } from "@repo/alerting/rules";
import type { VmTableRow } from "@/lib/vms";
import type { GuestNetPromise } from "./guest-net-cells";
import { VmTable } from "./vm-table";

/** Guests without the streamwizard tag, folded away at the bottom of /vms and a host's page. No alerts. */
export function OtherVms({ rows, showHost = true, net }: { rows: VmTableRow[]; showHost?: boolean; net?: GuestNetPromise }) {
  if (rows.length === 0) return null;
  return (
    <Card className="py-0">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-6 py-4 [&::-webkit-details-marker]:hidden">
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true" />
          <span className="font-medium">Other VMs</span>
          <span className="text-sm text-muted-foreground">
            {rows.length} without the {STREAMWIZARD_VM_TAG} tag · no alerts
          </span>
        </summary>
        <div className="border-t">
          <VmTable rows={rows} ruleCount={0} showHost={showHost} showAlerts={false} net={net} />
        </div>
      </details>
    </Card>
  );
}
