import { VodsContent } from "@/components/vods/vods-content";
import { VodsTableSkeleton } from "@/components/vods/vods-table-skeleton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "VODs - Twitch Videos",
  description: "View and manage your Twitch VODs",
};

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
    <div className="mx-auto w-full max-w-7xl">
      <div className="rounded-xl border border-border bg-card/50 p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">VODs</h1>
          <p className="mt-2 text-muted-foreground">View and manage your archived Twitch broadcasts</p>
        </div>

        <Suspense fallback={<VodsTableSkeleton rows={10} />}>
          <VodsContent />
        </Suspense>
      </div>
    </div>
  );
}
