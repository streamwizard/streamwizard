import { supabaseAdmin } from "@repo/supabase/next/admin";
import { StatCard } from "@/components/widgets/stat-card";

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
  const [
    clipsCount,
    totalSyncs,
    activeSyncs,
    failedSyncs,
    lastSyncRow,
    pendingClips,
    foldersCount,
    enabledCommands,
    customCommands,
    totalScenes,
    activeScenes,
    overlayItems,
    totalWidgets,
    approvedLibraryWidgets,
    twitchIntegrations,
  ] = await Promise.all([
    supabaseAdmin.from("clips").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("twitch_clip_syncs").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("twitch_clip_syncs").select("*", { count: "exact", head: true }).eq("sync_status", "syncing"),
    supabaseAdmin.from("twitch_clip_syncs").select("*", { count: "exact", head: true }).eq("sync_status", "failed"),
    supabaseAdmin.from("twitch_clip_syncs").select("last_sync").order("last_sync", { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from("pending_clips").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("clip_folders").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("commands").select("*", { count: "exact", head: true }).eq("enabled", true),
    supabaseAdmin.from("custom_commands").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("overlay_scenes").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("overlay_scenes").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabaseAdmin.from("overlay_items").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("widgets").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("widget_library_entries").select("*", { count: "exact", head: true }).eq("is_approved", true),
    supabaseAdmin.from("integrations_twitch").select("*", { count: "exact", head: true }),
  ]);

  const failedSyncCount = failedSyncs.count ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Database</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Platform-wide stats · refreshes on load</p>
      </div>

      {/* Section 1: Clips & Sync */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Clips & Sync</h2>
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            title="Total Clips"
            value={clipsCount.count ?? 0}
            description="All synced clips in DB"
          />
          <StatCard
            title="Total Sync Records"
            value={totalSyncs.count ?? 0}
            description="Users with a sync history"
          />
          <StatCard
            title="Last Sync"
            value={formatDate(lastSyncRow.data?.last_sync ?? null)}
            description="Most recent clip sync across all users"
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            title="Active Syncs"
            value={activeSyncs.count ?? 0}
            description="Currently syncing"
            className={(activeSyncs.count ?? 0) > 0 ? "border-yellow-500/50" : undefined}
          />
          <StatCard
            title="Failed Syncs"
            value={failedSyncCount}
            description={failedSyncCount === 0 ? "All good" : "Users with failed sync"}
            className={failedSyncCount > 0 ? "border-destructive/50" : undefined}
          />
          <StatCard
            title="Pending Clips"
            value={pendingClips.count ?? 0}
            description="Awaiting processing"
          />
        </div>
      </section>

      {/* Section 2: Content */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Content</h2>
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            title="Clip Folders"
            value={foldersCount.count ?? 0}
            description="Folders created across all users"
          />
          <StatCard
            title="Enabled Commands"
            value={enabledCommands.count ?? 0}
            description="Active channel commands"
          />
          <StatCard
            title="Custom Commands"
            value={customCommands.count ?? 0}
            description="User-authored custom commands"
          />
        </div>
      </section>

      {/* Section 3: Overlays & Widgets */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Overlays & Widgets</h2>
        <div className="grid grid-cols-5 gap-4">
          <StatCard
            title="Overlay Scenes"
            value={totalScenes.count ?? 0}
            description="Total scenes created"
          />
          <StatCard
            title="Active Overlays"
            value={activeScenes.count ?? 0}
            description="Currently active scenes"
          />
          <StatCard
            title="Overlay Items"
            value={overlayItems.count ?? 0}
            description="Elements across all scenes"
          />
          <StatCard
            title="Custom Widgets"
            value={totalWidgets.count ?? 0}
            description="User-authored widgets"
          />
          <StatCard
            title="Library Widgets"
            value={approvedLibraryWidgets.count ?? 0}
            description="Approved in widget library"
          />
        </div>
      </section>

      {/* Section 4: Users */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Users</h2>
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            title="Twitch Integrations"
            value={twitchIntegrations.count ?? 0}
            description="Users with Twitch connected"
          />
        </div>
      </section>
    </div>
  );
}
