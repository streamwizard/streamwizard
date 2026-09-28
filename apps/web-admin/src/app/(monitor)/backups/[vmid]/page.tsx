import { notFound } from "next/navigation";
import { BackupVmDetail } from "@/components/backups/backup-vm-detail";
import { getBackupVm } from "@/lib/backups";

export const dynamic = "force-dynamic";

export default async function BackupVmPage({ params }: { params: Promise<{ vmid: string }> }) {
  const vmid = Number((await params).vmid);
  if (!Number.isInteger(vmid) || vmid <= 0) notFound();
  return <BackupVmDetail vmid={vmid} initial={await getBackupVm(vmid)} />;
}
