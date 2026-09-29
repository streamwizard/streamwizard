import { describe, expect, it } from "bun:test";
import { backedUpDiskBytes, parseDiskSize, parseGuestDisks } from "./pve-config";

const G = 1024 ** 3;

describe("parseDiskSize", () => {
  it("reads PVE disk-size values, base 1024", () => {
    expect(parseDiskSize("250G")).toBe(250 * G);
    expect(parseDiskSize("528K")).toBe(528 * 1024);
    expect(parseDiskSize("4M")).toBe(4 * 1024 ** 2);
    expect(parseDiskSize("1.5T")).toBe(1.5 * 1024 ** 4);
    expect(parseDiskSize("32GiB")).toBe(32 * G);
    expect(parseDiskSize("1024")).toBe(1024);
    expect(parseDiskSize("big")).toBeNull();
    expect(parseDiskSize(undefined)).toBeNull();
  });
});

describe("parseGuestDisks (qemu)", () => {
  it("includes disks by default, skips cdroms, honours backup=0", () => {
    const disks = parseGuestDisks(
      {
        name: "dokploy",
        scsi0: "local-lvm:vm-108-disk-0,iothread=1,size=250G",
        scsi1: "local-lvm:vm-108-disk-1,backup=0,size=100G",
        ide2: "local:iso/debian.iso,media=cdrom,size=600M",
        ide3: "none,media=cdrom",
        net0: "virtio=AA:BB,bridge=vmbr0",
        unused0: "local-lvm:vm-108-disk-9",
      },
      "qemu",
    );
    expect(disks).toEqual([
      { key: "scsi0", sizeBytes: 250 * G, backedUp: true },
      { key: "scsi1", sizeBytes: 100 * G, backedUp: false },
    ]);
    expect(backedUpDiskBytes(disks)).toBe(250 * G);
  });

  it("backs up the EFI disk only with OVMF, and tpmstate always", () => {
    const base = { efidisk0: "local-lvm:vm-1-disk-1,efitype=4m,size=4M", tpmstate0: "local-lvm:vm-1-disk-2,size=4M,version=v2.0" };
    expect(parseGuestDisks({ ...base, bios: "ovmf" }, "qemu").every((d) => d.backedUp)).toBe(true);
    expect(parseGuestDisks(base, "qemu")).toEqual([
      { key: "efidisk0", sizeBytes: 4 * 1024 ** 2, backedUp: false },
      { key: "tpmstate0", sizeBytes: 4 * 1024 ** 2, backedUp: true },
    ]);
  });

  it("sorts numerically", () => {
    const keys = parseGuestDisks({ scsi10: "a:b,size=1G", scsi2: "a:c,size=1G" }, "qemu").map((d) => d.key);
    expect(keys).toEqual(["scsi2", "scsi10"]);
  });
});

describe("parseGuestDisks (lxc)", () => {
  it("always backs up rootfs, mount points only with backup=1, never bind mounts", () => {
    const disks = parseGuestDisks(
      {
        rootfs: "local-lvm:vm-200-disk-0,size=8G",
        mp0: "local-lvm:vm-200-disk-1,mp=/data,size=20G",
        mp1: "local-lvm:vm-200-disk-2,mp=/srv,backup=1,size=10G",
        mp2: "/mnt/host,mp=/host,backup=1",
      },
      "lxc",
    );
    expect(disks).toEqual([
      { key: "mp0", sizeBytes: 20 * G, backedUp: false },
      { key: "mp1", sizeBytes: 10 * G, backedUp: true },
      { key: "mp2", sizeBytes: null, backedUp: false },
      { key: "rootfs", sizeBytes: 8 * G, backedUp: true },
    ]);
    expect(backedUpDiskBytes(disks)).toBe(18 * G);
  });
});
