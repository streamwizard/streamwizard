import Link from "next/link";
import { Clock, MessageSquareReply, Star, Ticket, TicketCheck } from "lucide-react";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { listTicketCategories } from "@repo/supabase/queries/ticket-config";
import {
  formatDurationShort,
  getTicketStatsByCategory,
  getTicketStatsByDay,
  getTicketStatsSummary,
} from "@repo/supabase/queries/ticket-stats";
import { Button, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";
import { TicketStatsChart } from "@/components/discord/ticket-stats-chart";
import { PageHeader } from "@/components/widgets/page-header";
import { StatCard } from "@/components/widgets/stat-card";
import { requireDiscordContext } from "@/lib/discord/api";
import { cn } from "@/lib/utils";

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
        <div className="flex gap-1" role="group" aria-label="Range">
          {RANGES.map((option) => (
            <Button key={option} size="sm" variant={option === days ? "default" : "outline"} asChild>
              <Link href={`/discord/tickets/stats?days=${option}`} aria-current={option === days ? "page" : undefined}>
                {option}d
              </Link>
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/discord/tickets">All tickets</Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
      </div>

      <TicketStatsChart days={byDay} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">By category</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Opened</TableHead>
                <TableHead className="text-right">Closed</TableHead>
                <TableHead className="text-right">Rating</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byCategory.map((row) => (
                <TableRow key={row.category}>
                  <TableCell className="font-medium">{categoryNames.get(row.category) ?? row.category}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.opened}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.closed}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", row.avgRating === null && "text-muted-foreground")}>
                    {rating(row.avgRating, row.ratingCount)}
                  </TableCell>
                </TableRow>
              ))}
              {byCategory.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="p-8 text-center text-muted-foreground">
                    No tickets in this range.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
