import { cookies } from "next/headers";
import { EventsubDashboard, type ShardGridView } from "@/components/charts/eventsub-dashboard";
import { LiveIndicator } from "@/components/widgets/live-indicator";
import { PageHeader } from "@/components/widgets/page-header";
import { DASHBOARD_COOKIE } from "@/lib/dashboard-prefs";
import { fetchEventsubMetrics } from "@/lib/eventsub-metrics";
import { homeEnv } from "@/lib/home-env";

export const dynamic = "force-dynamic";

export default async function EventSubDashboardPage() {
  const cookieStore = await cookies();
  const savedView = cookieStore.get(DASHBOARD_COOKIE.eventsubShardView)?.value;
  const initialView: ShardGridView = savedView === "heatmap" ? "heatmap" : "grid";
  // Never throws: every source falls back to empty and flags its own error.
  const initialData = await fetchEventsubMetrics("24h", "15m");

  return (
    <div className="space-y-8">
      <PageHeader
        title="EventSub"
        description={`Conduit shards, subscriptions and event flow for ${homeEnv()} · Helix cached 30 s, inventory 5 min`}
      >
        <LiveIndicator />
      </PageHeader>
      <EventsubDashboard initialData={initialData} initialView={initialView} />
    </div>
  );
}
