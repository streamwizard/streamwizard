"use client";

import type { LucideIcon } from "lucide-react";
import { Activity, CircleDollarSign, Clock, Database, GitCompare, HeartPulse, Layers, RefreshCw, Server, ShieldOff, Zap } from "lucide-react";
import { Badge, Card, CardContent } from "@repo/ui";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/widgets/stat-card";
import { StatusIndicator } from "@/components/widgets/status-indicator";
import type { EventsubCheck, EventsubCheckId, EventsubKpis } from "@/lib/eventsub-health";
import { summarize } from "@/lib/eventsub-health";
import { BANNER_BORDER, TILE_TONE } from "./health-kit";

const CHECK_ICON: Record<EventsubCheckId, LucideIcon> = {
  shards: Layers,
  heartbeat: HeartPulse,
  conduit: Server,
  mismatch: GitCompare,
  unrun: Layers,
  cost: CircleDollarSign,
  revocations: ShieldOff,
  silence: Clock,
  sources: Database,
};

/** "Is EventSub OK?" in one line: the worst check wins and failing checks are named. */
export function EventsubHealthBanner({ checks, generatedAt }: { checks: EventsubCheck[]; generatedAt: string }) {
  const { status, label, failing } = summarize(checks);
  const passing = checks.length - failing.length;

  return (
    <Card className={cn("border", BANNER_BORDER[status])} role="status" aria-live="polite">
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <StatusIndicator status={status} label={label} className="text-lg font-semibold" />
          <p className="text-sm text-muted-foreground">
            {status === "muted"
              ? "No shard heartbeats, Helix data or events for this environment yet."
              : failing.length === 0
                ? `All ${checks.length} checks passing.`
                : `${failing.length} of ${checks.length} checks need attention; ${passing} passing.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {failing.map((c) => {
            const Icon = CHECK_ICON[c.id];
            return (
              <Badge
                key={c.id}
                variant="outline"
                className={cn("gap-1.5 font-normal", c.status === "crit" ? "border-red-500/60" : "border-amber-500/50")}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {c.problem}
              </Badge>
            );
          })}
          <time dateTime={generatedAt} className="text-xs text-muted-foreground tabular-nums" suppressHydrationWarning>
            updated {new Date(generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </time>
        </div>
      </CardContent>
    </Card>
  );
}

/** The six headline numbers. Shard and cost tiles take their colour from the matching check. */
export function EventsubKpiTiles({ kpis, checks }: { kpis: EventsubKpis; checks: EventsubCheck[] }) {
  const tone = (id: EventsubCheckId) => TILE_TONE[checks.find((c) => c.id === id)?.status ?? "muted"];
  const tiles: { title: string; value: string; icon: LucideIcon; description: string; tone: (typeof TILE_TONE)[keyof typeof TILE_TONE] }[] = [
    { title: "Shards up", value: kpis.shardsUp, icon: Layers, description: "connected and bound", tone: tone("shards") },
    {
      title: "Events / min",
      value: kpis.eventsPerMin === null ? "—" : kpis.eventsPerMin.toLocaleString("en-US"),
      icon: Zap,
      description: "conduit, last heartbeat",
      tone: "default",
    },
    {
      title: "Subscriptions",
      value: kpis.subscriptionsEnabled === null ? "—" : kpis.subscriptionsEnabled.toLocaleString("en-US"),
      icon: Activity,
      description: kpis.subscriptionsTotal === null ? "enabled" : `enabled, of ${kpis.subscriptionsTotal.toLocaleString("en-US")} total`,
      tone: "default",
    },
    {
      title: "Cost",
      value: kpis.costPct === null ? "—" : `${kpis.costPct.toFixed(kpis.costPct < 1 ? 2 : 0)}%`,
      icon: CircleDollarSign,
      description: kpis.costPct === null ? "of max" : `${kpis.cost} max`,
      tone: tone("cost"),
    },
    {
      title: "Reconnects (24h)",
      value: kpis.reconnects24h.toLocaleString("en-US"),
      icon: RefreshCw,
      description: "outages, all shards",
      tone: kpis.reconnects24h > 0 ? "warning" : "default",
    },
    {
      title: "Revocations (24h)",
      value: kpis.revocations24h.toLocaleString("en-US"),
      icon: ShieldOff,
      description: "should stay 0",
      tone: tone("revocations"),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      {tiles.map((t) => (
        <StatCard key={t.title} title={t.title} value={t.value} icon={t.icon} description={t.description} tone={t.tone} />
      ))}
    </div>
  );
}
