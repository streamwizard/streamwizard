import { createClient } from "@/lib/supabase/server";
import { getCommandDrilldown, getTopCommands, getTopUsers, getUsageOverTime } from "@/actions/supabase/analytics";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

export default async function CommandAnalyticsPage({ searchParams }: { searchParams?: { trigger?: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [topCommands, logsOverTime, topUsers] = await Promise.all([
    getTopCommands(user.id, 10),
    getUsageOverTime(user.id, 30),
    getTopUsers(user.id, 10),
  ]);

  const selectedTrigger = searchParams?.trigger;
  const drilldown = selectedTrigger ? await getCommandDrilldown(user.id, selectedTrigger) : null;

  const overTime = (() => {
    const byDay = new Map<string, number>();
    for (const row of logsOverTime) {
      const d = new Date(row.used_at as string);
      const key = d.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }
    return Array.from(byDay.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  })();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Command Analytics</h1>

      <section className="space-y-3">
        <h2 className="font-medium">Command Drilldown</h2>
        <form className="flex items-center gap-2" method="GET">
          <select name="trigger" defaultValue={selectedTrigger ?? ""} className="border rounded p-2 text-sm">
            <option value="">Select a command</option>
            {topCommands.map((c) => (
              <option key={c.trigger} value={c.trigger}>!{c.trigger}</option>
            ))}
          </select>
          <button type="submit" className="border rounded px-3 py-2 text-sm">View</button>
        </form>
        {drilldown?.command ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded border p-4">
              <div className="text-sm text-muted-foreground">Total usage</div>
              <div className="text-2xl font-semibold">{drilldown.command.usage_count ?? 0}</div>
              <div className="mt-2 text-sm">Last used: {drilldown.logs.length ? new Date(drilldown.logs[0].used_at as string).toLocaleString() : "—"}</div>
            </div>
            <div className="rounded border p-4">
              <div className="mb-2 font-medium">Recent Uses</div>
              <ChartContainer config={{ count: { label: "Uses", color: "hsl(var(--primary))" } }} className="w-full">
                <LineChart data={drilldown.logs.map((l) => ({ time: new Date(l.used_at as string).toLocaleString(), count: 1 }))}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="time" hide />
                  <YAxis allowDecimals={false} hide />
                  <Line dataKey="count" stroke="var(--color-count)" strokeWidth={2} dot={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                </LineChart>
              </ChartContainer>
            </div>
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="mb-2 font-medium">Top Commands</h2>
        <ChartContainer config={{ count: { label: "Usage", color: "hsl(var(--primary))" } }} className="w-full">
          <BarChart data={topCommands.map((c) => ({ name: `!${c.trigger}`, count: c.usage_count ?? 0 }))}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} />
            <Bar dataKey="count" fill="var(--color-count)" radius={4} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
          </BarChart>
        </ChartContainer>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Usage Over Time</h2>
        <ChartContainer config={{ count: { label: "Uses", color: "hsl(var(--primary))" } }} className="w-full">
          <LineChart data={overTime}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} />
            <Line dataKey="count" stroke="var(--color-count)" strokeWidth={2} dot={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
          </LineChart>
        </ChartContainer>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Top Users</h2>
        <ChartContainer config={{ count: { label: "Uses", color: "hsl(var(--primary))" } }} className="w-full">
          <BarChart data={topUsers.map((u) => ({ name: u.user_name, count: u.count }))}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} />
            <Bar dataKey="count" fill="var(--color-count)" radius={4} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
          </BarChart>
        </ChartContainer>
      </section>
    </div>
  );
}


