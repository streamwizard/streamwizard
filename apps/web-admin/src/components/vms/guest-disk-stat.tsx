import { HardDrive } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { formatPct, pctOf, usageTone } from "@/lib/vms/vm-format";
import { formatBytes } from "@/lib/format";
import { getGuestNet, type GuestRef } from "@/lib/vms/pve";

/** Disk use from the guest agent (qemu) or Proxmox itself (lxc). */
export async function GuestDiskStat({ guest, lxcDisk }: { guest: GuestRef; lxcDisk: { used: number; total: number } | null }) {
  const agentDisk = lxcDisk || !guest.running ? null : (await getGuestNet([guest]))[`${guest.host}:${guest.vmid}`]?.disk;
  const disk = lxcDisk ?? (agentDisk ? { used: agentDisk.usedBytes, total: agentDisk.totalBytes } : null);
  const pct = disk ? pctOf(disk.used, disk.total) : null;
  return (
    <StatCard
      title="Disk"
      value={formatPct(pct)}
      description={disk ? `${formatBytes(disk.used)} of ${formatBytes(disk.total)}, ${formatBytes(disk.total - disk.used)} free` : guest.type === "qemu" ? "Needs the guest agent" : "Not reported"}
      tone={usageTone(pct)}
      icon={HardDrive}
    />
  );
}
