import { BackupCharts } from "@/components/backups/backup-charts";
import { BackupDashboard } from "@/components/backups/backup-dashboard";
import { fetchBackupSeries } from "@/lib/backup-series";
import { getBackupOverview } from "@/lib/backups";

export const dynamic = "force-dynamic";

// Current state comes from rest-api's /internal/backups (what its poller
// stored), history from Influx; loading this page never reaches PBS or the
// PVE hosts.
export default async function BackupsPage() {
  const [overview, series] = await Promise.all([getBackupOverview(), fetchBackupSeries()]);
  return <BackupDashboard initial={overview} charts={<BackupCharts initial={series} />} />;
}
