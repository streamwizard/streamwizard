"use client";

import { Suspense, use } from "react";
import { formatBytes } from "@/lib/format";
import type { GuestNet } from "@/lib/pve";
import { cn } from "@/lib/utils";
import { UsageMeter } from "./usage-meter";
import { AGENT_LABEL, pctOf } from "./vm-format";

/** Guest IPs, agent state and disk use, keyed "<host>:<vmid>". The server
 * reads them from the PVE API after the table renders (lib/pve.ts), so each
 * cell waits on the same promise under its own Suspense boundary. */
export type GuestNetPromise = Promise<Record<string, GuestNet>>;

const Loading = () => <span className="text-muted-foreground">…</span>;
// `why` is written out instead of hiding in a tooltip: a phone has no hover.
const None = ({ why }: { why?: string }) => <span className={why ? "text-xs text-muted-foreground" : "text-muted-foreground"}>{why ?? "—"}</span>;

function Ips({ net, guestKey }: { net: GuestNetPromise; guestKey: string }) {
  const ips = use(net)[guestKey]?.ips ?? [];
  return ips.length > 0 ? ips.map((ip) => <div key={ip}>{ip}</div>) : <None />;
}

function Agent({ net, guestKey }: { net: GuestNetPromise; guestKey: string }) {
  const agent = use(net)[guestKey]?.agent;
  if (!agent) return <None />;
  return <span className={cn(agent === "error" && "text-amber-600 dark:text-amber-400")}>{AGENT_LABEL[agent] ?? agent}</span>;
}

function Disk({ net, guestKey, name }: { net: GuestNetPromise; guestKey: string; name: string }) {
  const disk = use(net)[guestKey]?.disk;
  if (!disk) return <None why="Needs the guest agent" />;
  return <DiskUse used={disk.usedBytes} total={disk.totalBytes} name={name} />;
}

export function DiskUse({ used, total, name }: { used: number; total: number; name: string }) {
  return (
    <>
      {formatBytes(used)} / {formatBytes(total)}
      <UsageMeter pct={pctOf(used, total)} label={`Disk of ${name}`} className="mt-1 ml-auto w-24" />
    </>
  );
}

export function GuestIps({ net, guestKey }: { net?: GuestNetPromise; guestKey: string }) {
  if (!net) return <None />;
  return (
    <Suspense fallback={<Loading />}>
      <Ips net={net} guestKey={guestKey} />
    </Suspense>
  );
}

export function GuestAgent({ net, guestKey }: { net?: GuestNetPromise; guestKey: string }) {
  if (!net) return <None />;
  return (
    <Suspense fallback={<Loading />}>
      <Agent net={net} guestKey={guestKey} />
    </Suspense>
  );
}

export function GuestDisk({ net, guestKey, name }: { net?: GuestNetPromise; guestKey: string; name: string }) {
  if (!net) return <None why="Needs the guest agent" />;
  return (
    <Suspense fallback={<Loading />}>
      <Disk net={net} guestKey={guestKey} name={name} />
    </Suspense>
  );
}
