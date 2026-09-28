import { BackupDashboard } from "@/components/backups/backup-dashboard";
import { getBackupOverview } from "@/lib/backups";

export const dynamic = "force-dynamic";

// Data comes from rest-api's /internal/backups, which serves what its poller
// stored; loading this page never reaches PBS or the PVE hosts.
export default async function BackupsPage() {
  return <BackupDashboard initial={await getBackupOverview()} />;
}
