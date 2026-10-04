import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui";
import { AttentionList } from "@/components/overview/attention-list";
import { KeyNumbers } from "@/components/overview/key-numbers";
import { LiveNow } from "@/components/overview/live-now";
import { OverviewRefresh } from "@/components/overview/overview-refresh";
import { Shortcuts } from "@/components/overview/shortcuts";
import { StatusStrip } from "@/components/overview/status-strip";
import { PageHeader } from "@/components/widgets/page-header";
import { SectionHeading } from "@/components/widgets/section-heading";
import { loadOverview } from "@/lib/overview-data";

export const dynamic = "force-dynamic";

// Top to bottom: what needs a person, whether the platform is up, the two
// numbers worth a glance, who is live, and the ways out. Inventory counts live
// on Database › App data; request and connection detail on their own pages.
export default async function OverviewDashboard() {
  const data = await loadOverview();

  return (
    <div className="space-y-6 md:space-y-8">
      <OverviewRefresh />
      <PageHeader title="Dashboard" description={`What needs you, and how ${data.env} is doing. Refreshes every minute.`} />

      {data.failed.length > 0 && (
        <Alert>
          <TriangleAlert aria-hidden />
          <AlertTitle>Some of this page couldn&apos;t load</AlertTitle>
          <AlertDescription>Missing: {data.failed.join(", ")}. The rest is up to date.</AlertDescription>
        </Alert>
      )}

      <section className="space-y-3">
        <SectionHeading>Needs attention</SectionHeading>
        <AttentionList items={data.attention} />
      </section>

      {data.subsystems && (
        <section className="space-y-3">
          <SectionHeading>System status</SectionHeading>
          <StatusStrip subsystems={data.subsystems} />
        </section>
      )}

      <section className="space-y-3">
        <SectionHeading>Right now</SectionHeading>
        <KeyNumbers live={data.live ? { streamers: data.live.rows.length, viewers: data.live.viewers } : null} obs={data.obs} />
      </section>

      {data.live && (
        // scroll-mt clears the sticky header when a tile jumps here.
        <section id="live-now" className="scroll-mt-20 space-y-3">
          <SectionHeading>Live now</SectionHeading>
          <LiveNow rows={data.live.rows} />
        </section>
      )}

      <section className="space-y-3">
        <SectionHeading>Shortcuts</SectionHeading>
        <Shortcuts />
      </section>
    </div>
  );
}
