// Disk sizes from a PVE guest config (GET /nodes/{node}/qemu/{vmid}/config or
// .../lxc/{vmid}/config), and which disks vzdump backs up. Rules follow
// qemu-server QemuConfig::get_backup_volumes and pve-container
// mountpoint_backup_enabled.

export interface GuestDisk {
  /** Config key: "scsi0", "efidisk0", "rootfs", "mp1". */
  key: string;
  sizeBytes: number | null;
  /** False when vzdump skips it (backup=0, an LXC mount point without backup=1, ...). */
  backedUp: boolean;
}

const QEMU_DISK_RE = /^(?:scsi|virtio|sata|ide)\d+$|^efidisk0$|^tpmstate0$/;
const LXC_DISK_RE = /^rootfs$|^mp\d+$/;
const UNITS: Record<string, number> = { K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4 };

/** PVE disk-size format: a number with an optional K/M/G/T (or KiB...) suffix, base 1024. */
export function parseDiskSize(text: string | undefined): number | null {
  const m = text?.trim().match(/^(\d+(?:\.\d+)?)(?:([KMGT])(?:iB)?)?$/i);
  if (!m) return null;
  return Math.round(Number(m[1]) * (m[2] ? UNITS[m[2].toUpperCase()]! : 1));
}

/** "local-lvm:vm-101-disk-0,size=32G,backup=0" → volume + options. */
function parseDiskValue(value: string): { volume: string; options: Record<string, string> } {
  const [first = "", ...rest] = value.split(",");
  const options: Record<string, string> = {};
  let volume = first;
  // The volume may itself be written as file=... among the options.
  if (first.includes("=")) {
    const [k, v = ""] = first.split("=");
    options[k!] = v;
    volume = options.file ?? options.volume ?? "";
  }
  for (const part of rest) {
    const i = part.indexOf("=");
    if (i > 0) options[part.slice(0, i)] = part.slice(i + 1);
  }
  return { volume, options };
}

const isOn = (v: string | undefined) => v === "1" || v === "yes" || v === "on" || v === "true";
const isOff = (v: string | undefined) => v === "0" || v === "no" || v === "off" || v === "false";

export function parseGuestDisks(config: Record<string, unknown>, type: "qemu" | "lxc"): GuestDisk[] {
  const disks: GuestDisk[] = [];
  for (const [key, raw] of Object.entries(config)) {
    if (typeof raw !== "string") continue;
    if (type === "qemu" ? !QEMU_DISK_RE.test(key) : !LXC_DISK_RE.test(key)) continue;
    const { volume, options } = parseDiskValue(raw);
    const sizeBytes = parseDiskSize(options.size);

    let backedUp: boolean;
    if (type === "qemu") {
      if (options.media === "cdrom" || volume === "none" || volume === "cdrom") continue;
      // The EFI vars disk only exists for vzdump when the VM boots with OVMF.
      if (key === "efidisk0" && config.bios !== "ovmf") backedUp = false;
      else backedUp = !isOff(options.backup);
    } else if (key === "rootfs") {
      backedUp = true;
    } else {
      // Bind mounts and device mounts (a host path) are never backed up.
      backedUp = !volume.startsWith("/") && isOn(options.backup);
    }
    disks.push({ key, sizeBytes, backedUp });
  }
  return disks.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
}

/** Sum of the disks vzdump backs up, or null when a size is missing. */
export function backedUpDiskBytes(disks: GuestDisk[]): number | null {
  const included = disks.filter((d) => d.backedUp);
  if (included.length === 0 || included.some((d) => d.sizeBytes === null)) return null;
  return included.reduce((sum, d) => sum + d.sizeBytes!, 0);
}
