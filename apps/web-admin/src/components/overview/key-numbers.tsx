import Link from "next/link";
import { Cpu, Eye, MonitorPlay, Radio } from "lucide-react";
import { StatCard } from "@/components/widgets/stat-card";
import { StatGrid } from "@/components/widgets/stat-grid";
import type { ObsLoad } from "@/lib/overview-data";

const number = (value: number) => value.toLocaleString("en-US");

function Tile({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none [&>*]:h-full">
      {children}
    </Link>
  );
}

/** Who is live and how loaded Cloud OBS is: the two things worth a glance. A dash means that source didn't load. */
export function KeyNumbers({ live, obs }: { live: { streamers: number; viewers: number } | null; obs: ObsLoad | null }) {
  const gpuTone = obs?.gpuPct == null ? "default" : obs.gpuPct >= 90 ? "danger" : obs.gpuPct >= 75 ? "warning" : "default";

  return (
    <StatGrid cols={4}>
      <Tile href="#live-now">
        <StatCard title="Live streamers" value={live ? number(live.streamers) : "—"} description="Live on Twitch right now" icon={Radio} />
      </Tile>
      <Tile href="#live-now">
        <StatCard title="Viewers" value={live ? number(live.viewers) : "—"} description="Across every live channel" icon={Eye} />
      </Tile>
      <Tile href="/obs">
        <StatCard
          title="OBS instances"
          value={obs ? `${obs.running} / ${obs.capacity}` : "—"}
          description={obs ? `Running, on ${obs.nodes} ${obs.nodes === 1 ? "node" : "nodes"}` : "Couldn't load"}
          icon={MonitorPlay}
        />
      </Tile>
      <Tile href="/obs">
        <StatCard
          title="GPU usage"
          value={obs?.gpuPct != null ? `${Math.round(obs.gpuPct)}%` : "—"}
          tone={gpuTone}
          description={
            obs && obs.vramTotalMb > 0
              ? `VRAM ${(obs.vramUsedMb / 1024).toFixed(1)} of ${(obs.vramTotalMb / 1024).toFixed(0)} GB`
              : obs
                ? "No nodes reporting"
                : "Couldn't load"
          }
          icon={Cpu}
        />
      </Tile>
    </StatGrid>
  );
}
