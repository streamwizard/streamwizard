import { AGENT_LABEL } from "@/lib/vm-format";
import { getGuestNet, pveConfigured, type GuestRef } from "@/lib/pve";

/** IPs and agent state from the PVE API, streamed in after the page. */
export async function GuestNetLine({ guest }: { guest: GuestRef }) {
  if (!guest.running) return <p className="text-sm text-muted-foreground">Not running, no IPs.</p>;
  if (!pveConfigured()) return <p className="text-sm text-muted-foreground">IPs need PVE_HOSTS in this environment.</p>;
  const net = (await getGuestNet([guest]))[`${guest.host}:${guest.vmid}`];
  return (
    <p className="font-mono text-sm break-words">
      {net && net.ips.length > 0 ? net.ips.join(", ") : <span className="text-muted-foreground">No IPs known</span>}
      <span className="ml-2 font-sans text-muted-foreground">· {AGENT_LABEL[net?.agent ?? "off"] ?? net?.agent}</span>
    </p>
  );
}
