import type { ProxmoxGuestInfo } from "@repo/metrics";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono text-sm break-words">{children}</dd>
    </div>
  );
}

export function GuestFacts({ info }: { info: ProxmoxGuestInfo }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
      <Fact label="PVE status">{info.status ?? "—"}</Fact>
      <Fact label="QEMU status">{info.qmpstatus ?? "—"}</Fact>
      <Fact label="QEMU version">{info.qemuVersion ?? "—"}</Fact>
      <Fact label="Machine">{info.machine ?? "—"}</Fact>
      <Fact label="Lock">{info.lock ?? "none"}</Fact>
      <Fact label="Process">{info.pid != null ? `pid ${info.pid}` : "—"}</Fact>
    </dl>
  );
}
