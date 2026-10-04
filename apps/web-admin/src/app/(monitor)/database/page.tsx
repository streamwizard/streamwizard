import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getPlatformStats } from "@repo/supabase/queries/platform-stats";
import { PageHeader } from "@/components/widgets/page-header";
import { SectionHeading } from "@/components/widgets/section-heading";
import { StatCard } from "@/components/widgets/stat-card";
import { StatGrid } from "@/components/widgets/stat-grid";

export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function DatabaseDashboard() {
  const stats = await getPlatformStats(supabaseAdmin);

  return (
    <div className="space-y-8">
      <PageHeader title="App data" description="Row counts across the platform. Read when the page loads." />

      {/* Section 1: Clips & Sync */}
      <section className="space-y-3">
        <SectionHeading>Clips and sync</SectionHeading>
        <StatGrid cols={3}>
          <StatCard title="Total Clips" value={stats.clips} description="All synced clips in DB" />
          <StatCard title="Total Sync Records" value={stats.clipSyncs} description="Users with a sync history" />
          <StatCard
            title="Last Sync"
            value={formatDate(stats.lastClipSyncAt)}
            description="Most recent clip sync across all users"
          />
        </StatGrid>
        <StatGrid cols={3}>
          <StatCard
            title="Active Syncs"
            value={stats.activeClipSyncs}
            description="Currently syncing"
            className={stats.activeClipSyncs > 0 ? "border-yellow-500/50" : undefined}
          />
          <StatCard
            title="Failed Syncs"
            value={stats.failedClipSyncs}
            description={stats.failedClipSyncs === 0 ? "All good" : "Users with failed sync"}
            className={stats.failedClipSyncs > 0 ? "border-destructive/50" : undefined}
          />
          <StatCard title="Pending Clips" value={stats.pendingClips} description="Awaiting processing" />
        </StatGrid>
      </section>

      {/* Section 2: Content */}
      <section className="space-y-3">
        <SectionHeading>Content</SectionHeading>
        <StatGrid cols={3}>
          <StatCard title="Clip Folders" value={stats.clipFolders} description="Folders created across all users" />
          <StatCard title="Enabled Commands" value={stats.enabledCommands} description="Active channel commands" />
          <StatCard
            title="Custom Commands"
            value={stats.customCommands}
            description="User-authored custom commands"
          />
        </StatGrid>
      </section>

      {/* Section 3: Overlays & Widgets */}
      <section className="space-y-3">
        <SectionHeading>Overlays and widgets</SectionHeading>
        <StatGrid cols={5}>
          <StatCard title="Overlay Scenes" value={stats.overlayScenes} description="Total scenes created" />
          <StatCard
            title="Active Overlays"
            value={stats.activeOverlayScenes}
            description="Currently active scenes"
          />
          <StatCard title="Overlay Items" value={stats.overlayItems} description="Elements across all scenes" />
          <StatCard title="Custom Widgets" value={stats.customWidgets} description="User-authored widgets" />
          <StatCard
            title="Library Widgets"
            value={stats.approvedLibraryWidgets}
            description="Approved in widget library"
          />
        </StatGrid>
      </section>

      {/* Section 4: Users */}
      <section className="space-y-3">
        <SectionHeading>Users</SectionHeading>
        <StatGrid cols={3}>
          <StatCard
            title="Twitch Integrations"
            value={stats.twitchIntegrations}
            description="Users with Twitch connected"
          />
        </StatGrid>
      </section>
    </div>
  );
}
