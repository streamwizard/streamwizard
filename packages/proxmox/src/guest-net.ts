/**
 * Pure parsers for the PVE calls that tell a guest's IPs and guest agent
 * state. No I/O here, so it's all unit tested.
 */

export type AgentState = "ok" | "off" | "error";

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function ipv4Octets(ip: string): number[] | null {
  const m = IPV4.exec(ip);
  if (!m) return null;
  const octets = m.slice(1).map(Number);
  return octets.every((o) => o <= 255) ? octets : null;
}

/** Loopback, link-local and unspecified addresses never identify a guest. */
function isUsableGuestIpv4(ip: string): boolean {
  const o = ipv4Octets(ip);
  if (!o) return false;
  if (o[0] === 127 || o[0] === 0) return false;
  if (o[0] === 169 && o[1] === 254) return false;
  return true;
}

/**
 * Bridges that container runtimes create and remove on their own. Their
 * addresses say nothing about how to reach the guest.
 */
const IGNORED_INTERFACE = /^(docker\d*|br-[0-9a-f]+|veth|cni|flannel|virbr|lxcbr|lxdbr)/;

/** Sorts numerically by octet, so 10.0.0.9 comes before 10.0.0.10. */
function sortIps(ips: Iterable<string>): string[] {
  const key = (ip: string) => ipv4Octets(ip)!.reduce((n, o) => n * 256 + o, 0);
  return [...new Set(ips)].sort((a, b) => key(a) - key(b));
}

/**
 * The agent's network-get-interfaces answer, as PVE wraps it:
 * {result: [{name, "ip-addresses": [{"ip-address", "ip-address-type", prefix}]}]}.
 */
export function parseAgentInterfaces(data: unknown): string[] {
  const result = (data as { result?: unknown } | null)?.result;
  if (!Array.isArray(result)) return [];
  const ips: string[] = [];
  for (const iface of result as { name?: unknown; "ip-addresses"?: unknown }[]) {
    if (typeof iface?.name === "string" && IGNORED_INTERFACE.test(iface.name)) continue;
    const addrs = iface?.["ip-addresses"];
    if (!Array.isArray(addrs)) continue;
    for (const addr of addrs as { "ip-address"?: unknown; "ip-address-type"?: unknown }[]) {
      const ip = addr?.["ip-address"];
      if (addr?.["ip-address-type"] === "ipv4" && typeof ip === "string" && isUsableGuestIpv4(ip)) ips.push(ip);
    }
  }
  return sortIps(ips);
}

/** GET /nodes/{n}/lxc/{vmid}/interfaces: [{name, hwaddr, inet?: "10.0.0.5/24", inet6?}]. */
export function parseLxcInterfaces(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  const ips: string[] = [];
  for (const iface of data as { name?: unknown; inet?: unknown }[]) {
    if (typeof iface?.inet !== "string") continue;
    if (typeof iface.name === "string" && IGNORED_INTERFACE.test(iface.name)) continue;
    const ip = iface.inet.split("/")[0]!;
    if (isUsableGuestIpv4(ip)) ips.push(ip);
  }
  return sortIps(ips);
}

/**
 * The qemu config's `agent` property: "1", "0", or "enabled=1,fstrim_cloned_disks=1".
 * Missing means off.
 */
export function agentEnabledFromConfig(config: { agent?: unknown } | null | undefined): boolean {
  const raw = config?.agent;
  if (raw === undefined || raw === null) return false;
  const first = String(raw).split(",")[0]!.trim();
  const value = first.startsWith("enabled=") ? first.slice("enabled=".length) : first;
  return value === "1";
}

/** Filesystems that never hold guest data worth counting. */
const IGNORED_FS = /^(squashfs|iso9660|udf|tmpfs|devtmpfs|overlay|efivarfs|vfat)$/;

/**
 * The agent's get-fsinfo answer, as PVE wraps it:
 * {result: [{name, mountpoint, type, "used-bytes", "total-bytes"}]}.
 * Sums every real filesystem once (bind mounts repeat the same `name`).
 * Null when the agent reports no sizes.
 */
export function parseAgentFsInfo(data: unknown): { usedBytes: number; totalBytes: number } | null {
  const result = (data as { result?: unknown } | null)?.result;
  if (!Array.isArray(result)) return null;
  const seen = new Set<string>();
  let used = 0;
  let total = 0;
  for (const fs of result as { name?: unknown; type?: unknown; "used-bytes"?: unknown; "total-bytes"?: unknown }[]) {
    const t = fs?.["total-bytes"];
    const u = fs?.["used-bytes"];
    if (typeof t !== "number" || typeof u !== "number" || t <= 0) continue;
    if (typeof fs.type === "string" && IGNORED_FS.test(fs.type)) continue;
    const name = typeof fs.name === "string" ? fs.name : "";
    if (name && seen.has(name)) continue;
    if (name) seen.add(name);
    used += u;
    total += t;
  }
  return total > 0 ? { usedBytes: used, totalBytes: total } : null;
}
