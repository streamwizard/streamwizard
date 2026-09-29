import { NodeMetricChart } from "@/components/charts/node-metric-chart";
import { PlatformMetricChart } from "@/components/charts/platform-metric-chart";
import type { BackupSeries } from "@/lib/backup-series";

const ENDPOINT = "/api/metrics/backups";

/** History from Influx: one point per poll (every 6 h, and a minute after each webhook), following the range selector. */
export function BackupCharts({ initial }: { initial: BackupSeries }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <PlatformMetricChart
        title="Datastore used %"
        endpoint={ENDPOINT}
        seriesKey="usedPct"
        initialData={initial.usedPct}
        unit="%"
        color={3}
        yMax={100}
      />
      <NodeMetricChart title="Backup age per VM" apiPath={ENDPOINT} dataKey="vmAgeHours" initialData={initial.vmAgeHours} format="hours" />
      <NodeMetricChart title="Backup size per VM" apiPath={ENDPOINT} dataKey="vmSizeBytes" initialData={initial.vmSizeBytes} format="bytes" />
    </div>
  );
}
