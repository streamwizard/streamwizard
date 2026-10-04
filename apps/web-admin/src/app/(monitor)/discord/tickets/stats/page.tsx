import { Clock, MessageSquareReply, Star, Ticket, TicketCheck } from "lucide-react";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { listTicketCategories } from "@repo/supabase/queries/ticket-config";
import {
  formatDurationShort,
  getTicketStatsByCategory,
  getTicketStatsByDay,
  getTicketStatsSummary,
} from "@repo/supabase/queries/ticket-stats";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { TicketStatsChart } from "@/components/discord/ticket-stats-chart";
import { PageTabs } from "@/components/page-tabs";
import { DataList } from "@/components/widgets/data-list";
import { PageHeader } from "@/components/widgets/page-header";
import { StatCard } from "@/components/widgets/stat-card";
import { StatGrid } from "@/components/widgets/stat-grid";
import { requireDiscordContext } from "@/lib/discord/api";

export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90] as const;
type RangeDays = (typeof RANGES)[number];

const parseRange = (value: string | undefined): RangeDays => {
  const days = Number.parseInt(value ?? "", 10);
  return (RANGES as readonly number[]).includes(days) ? (days as RangeDays) : 30;
};

const rating = (value: number | null, count: number) => (value === null ? "No ratings" : `${value.toFixed(1)} / 5 · ${count}`);

export default async function DiscordTicketStatsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { guildId } = requireDiscordContext();
  const days = parseRange((await searchParams).days);
  // Whole days, so today counts in full and the chart's last point is today.
  const to = new Date();
  to.setUTCHours(24, 0, 0, 0);
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  const range = { from, to };

  const [summary, byDay, byCategory, categories] = await Promise.all([
    getTicketStatsSummary(supabaseAdmin, guildId, range),
    getTicketStatsByDay(supabaseAdmin, guildId, range),
    getTicketStatsByCategory(supabaseAdmin, guildId, range),
    listTicketCategories(supabaseAdmin, guildId),
  ]);
  const categoryNames = new Map(categories.map((c) => [c.slug, c.name]));

  return (
    <div className="space-y-6">
      <PageHeader title="Ticket stats" description={`The last ${days} days: how many tickets, how fast, and how it felt.`}>
        {/* Taller pills on a phone: the range is the one thing to tap on this page. */}
        <PageTabs
          label="Range"
          variant="pills"
          className="[&_a]:h-10 [&_a]:px-4 md:[&_a]:h-8 md:[&_a]:px-3"
          tabs={RANGES.map((option) => ({
            href: `/discord/tickets/stats?days=${option}`,
            label: `${option} days`,
            active: option === days,
          }))}
        />
      </PageHeader>

      <StatGrid cols={5}>
        <StatCard title="Opened" value={summary.opened} icon={Ticket} />
        <StatCard title="Closed" value={summary.closed} icon={TicketCheck} />
        <StatCard
          title="First reply"
          value={formatDurationShort(summary.avgFirstResponseSeconds) ?? "–"}
          description="Average, opening to the first staff message"
          icon={MessageSquareReply}
        />
        <StatCard
          title="Time to close"
          value={formatDurationShort(summary.avgResolutionSeconds) ?? "–"}
          description="Average, opening to close"
          icon={Clock}
        />
        <StatCard
          title="Rating"
          value={summary.avgRating === null ? "–" : summary.avgRating.toFixed(1)}
          description={summary.ratingCount === 0 ? "No ratings yet" : `From ${summary.ratingCount} rating${summary.ratingCount === 1 ? "" : "s"}`}
          icon={Star}
          tone={summary.avgRating === null ? "default" : summary.avgRating >= 4 ? "positive" : summary.avgRating >= 3 ? "warning" : "danger"}
        />
      </StatGrid>

      <TicketStatsChart days={byDay} />

      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-base">By category</CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {byCategory.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground sm:px-0">No tickets in this range.</p>
          ) : (
            <DataList
              rows={byCategory}
              rowKey={(row) => row.category}
              columns={[
                {
                  key: "category",
                  header: "Category",
                  mobile: "title",
                  className: "font-medium",
                  cell: (row) => categoryNames.get(row.category) ?? row.category,
                },
                {
                  key: "opened",
                  header: "Opened",
                  className: "text-right tabular-nums",
                  headClassName: "text-right",
                  cell: (row) => row.opened,
                },
                {
                  key: "closed",
                  header: "Closed",
                  className: "text-right tabular-nums",
                  headClassName: "text-right",
                  cell: (row) => row.closed,
                },
                {
                  key: "rating",
                  header: "Rating",
                  className: "text-right tabular-nums",
                  headClassName: "text-right",
                  cell: (row) => (
                    <span className={row.avgRating === null ? "text-muted-foreground" : undefined}>{rating(row.avgRating, row.ratingCount)}</span>
                  ),
                },
              ]}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
