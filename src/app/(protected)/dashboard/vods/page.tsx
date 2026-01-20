import { getVideos } from "@/actions/twitch/vods";
import { VodsPageClient } from "@/components/vods/vods-page-client";
import { VodsTableSkeleton } from "@/components/vods/vods-table-skeleton";
import { Suspense } from "react";

export const metadata = {
  title: "VODs - Twitch Videos",
  description: "View and manage your Twitch VODs",
};

/**
 * Server component that fetches initial videos and renders the client
 */
async function VodsContent() {
  const result = await getVideos();

  if (!result.success) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
        <h2 className="text-lg font-semibold text-destructive">Failed to load videos</h2>
      </div>
    );
  }

  return <VodsPageClient initialVideos={result.videos || []} initialCursor={result.cursor} />;
}

/**
 * VODs page - displays all archived videos for a Twitch user
 *
 * Route: /vods
 *
 * Features:
 * - Table display with thumbnails, titles, duration, views, etc.
 * - Checkbox selection for bulk delete (max 5 at a time)
 * - Click row to view video details in modal
 * - Create clips from the details modal
 * - Pagination support
 */
export default function VodsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">VODs</h1>
          <p className="mt-2 text-muted-foreground">View and manage your archived Twitch broadcasts</p>
        </div>

        {/* Content */}
        <Suspense fallback={<VodsTableSkeleton rows={10} />}>
          <VodsContent />
        </Suspense>
      </div>
    </div>
  );
}
