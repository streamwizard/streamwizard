import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getAlertStates } from "@repo/supabase/queries/alerts";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { SilenceMenu } from "@/components/alerts/silence-menu";
import { DataList } from "@/components/widgets/data-list";
import { PageHeader } from "@/components/widgets/page-header";
import { StatCard } from "@/components/widgets/stat-card";
import { StatGrid } from "@/components/widgets/stat-grid";
import { StatusIndicator, type IndicatorStatus } from "@/components/widgets/status-indicator";
import { homeEnv } from "@/lib/home-env";

export const dynamic = "force-dynamic";

function severityStatus(severity: string | null): IndicatorStatus {
  return severity === "crit" ? "crit" : severity === "warn" ? "warn" : "muted";
}

function formatSince(iso: string | null): string {
  if (!iso) return "—";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
  return `${Math.floor(mins / (60 * 24))}d ago`;
}

export default async function AlertsPage() {
  const env = homeEnv();
  const states = await getAlertStates(supabaseAdmin, env);
  const now = Date.now();

  const firing = states
    .filter((s) => s.status === "firing")
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "crit" ? -1 : 1));
  const silencedCount = firing.filter(
    (s) => s.silenced_until && new Date(s.silenced_until).getTime() > now,
  ).length;
  const critCount = firing.filter((s) => s.severity === "crit").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Active alerts" description={`Alert state for ${env} · evaluated every minute`} />

      <StatGrid cols={3}>
        <StatCard
          title="Firing"
          value={firing.length}
          description={firing.length === 0 ? "All quiet" : "Across all rules"}
          className={firing.length > 0 ? "border-destructive/50" : undefined}
        />
        <StatCard title="Critical" value={critCount} description="Firing at crit severity" />
        <StatCard title="Silenced" value={silencedCount} description="Firing but muted" />
      </StatGrid>

      <Card>
        <CardHeader className="px-4 pb-2 sm:px-6">
          <CardTitle className="text-sm font-medium text-muted-foreground">Firing now</CardTitle>
        </CardHeader>
        {/* Phone cards run edge to edge; the table keeps the card's padding. */}
        <CardContent className="px-0 sm:px-6">
          {firing.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nothing is firing. Rule states appear here the moment a breach passes its debounce.
            </p>
          ) : (
            <DataList
              rows={firing}
              rowKey={(s) => s.id}
              columns={[
                {
                  key: "rule",
                  header: "Rule",
                  mobile: "title",
                  className: "font-mono text-xs",
                  cell: (s) => <span className="font-mono text-xs break-all">{s.rule_id}</span>,
                },
                {
                  key: "severity",
                  header: "Severity",
                  mobile: "badge",
                  cell: (s) => <StatusIndicator status={severityStatus(s.severity)} label={s.severity ?? "—"} />,
                },
                {
                  key: "entity",
                  header: "Entity",
                  cell: (s) => <span className="font-mono text-xs break-all">{s.entity_id || "—"}</span>,
                },
                {
                  key: "message",
                  header: "Message",
                  // Wraps instead of truncating: the full text has to be readable without a hover.
                  className: "max-w-sm whitespace-normal text-muted-foreground",
                  cell: (s) => s.message ?? "—",
                },
                { key: "since", header: "Since", className: "whitespace-nowrap", cell: (s) => formatSince(s.first_fired_at) },
                {
                  key: "notified",
                  header: "Last notified",
                  className: "whitespace-nowrap text-muted-foreground",
                  cell: (s) =>
                    s.notify_failed ? (
                      <Badge variant="outline" className="border-red-500/40 text-red-600 dark:text-red-400">
                        notify failed
                      </Badge>
                    ) : (
                      formatSince(s.last_notified_at)
                    ),
                },
              ]}
              actions={(s) => (
                <SilenceMenu stateId={s.id} silenced={!!s.silenced_until && new Date(s.silenced_until).getTime() > now} />
              )}
            />
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Watching {states.length} rule/entity {states.length === 1 ? "pair" : "pairs"} in {env}. Silencing mutes
        notifications only — state and history keep recording.
      </p>
    </div>
  );
}
