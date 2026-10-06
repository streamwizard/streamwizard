import { notFound } from "next/navigation";
import { BackupVmDetail } from "@/components/backups/backup-vm-detail";
import { getBackupVm } from "@/lib/backups";
import { PageCrumb } from "@/lib/crumbs";

export const dynamic = "force-dynamic";

export default async function BackupVmPage({ params }: { params: Promise<{ vmid: string }> }) {
  const vmid = Number((await params).vmid);
  if (!Number.isInteger(vmid) || vmid <= 0) notFound();
  const initial = await getBackupVm(vmid);
  return (
    <>
      <PageCrumb label={`VM ${vmid}`} href={`/backups/${vmid}`} />
      <BackupVmDetail vmid={vmid} initial={initial} />
    </>
  );
}
