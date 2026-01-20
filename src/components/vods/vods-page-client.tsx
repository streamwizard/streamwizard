"use client";

import { useState, useTransition } from "react";
import { TwitchVideo } from "@/types/twitch";
import { getVideos, deleteVideos } from "@/actions/twitch/vods";
import { VodsTable } from "./vods-table";
import { VodsTableSkeleton } from "./vods-table-skeleton";
import { VideoDetailsDialog } from "./video-details-dialog";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trash2, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

interface VodsPageClientProps {
  initialVideos: TwitchVideo[];
  initialCursor?: string;
}

/**
 * Client component for the VODs page with all state management
 */
export function VodsPageClient({ initialVideos, initialCursor }: VodsPageClientProps) {
  // Video data state
  const [videos, setVideos] = useState<TwitchVideo[]>(initialVideos);
  const [cursor, setCursor] = useState<string | undefined>(initialCursor);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialog state
  const [selectedVideo, setSelectedVideo] = useState<TwitchVideo | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [clipDialogOpen, setClipDialogOpen] = useState(false);
  const [clipVideo, setClipVideo] = useState<TwitchVideo | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Loading states
  const [isPending, startTransition] = useTransition();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get selected videos for delete dialog
  const selectedVideos = videos.filter((v) => selectedIds.has(v.id));

  // Handle video row click
  const handleVideoClick = (video: TwitchVideo) => {
    setSelectedVideo(video);
    setDetailsOpen(true);
  };

  // Handle create clip from details dialog
  const handleCreateClip = (video: TwitchVideo) => {
    setDetailsOpen(false);
    setClipVideo(video);
    setClipDialogOpen(true);
  };

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const result = await getVideos();
      if (result.success && result.videos) {
        setVideos(result.videos);
        setCursor(result.cursor);
        setCursorHistory([]);
        setSelectedIds(new Set());
        toast.success("Videos refreshed");
      } else {
        toast.error(result.error || "Failed to refresh videos");
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle next page
  const handleNextPage = () => {
    if (!cursor) return;

    startTransition(async () => {
      const result = await getVideos(cursor);
      if (result.success && result.videos) {
        setCursorHistory([...cursorHistory, cursor]);
        setVideos(result.videos);
        setCursor(result.cursor);
        setSelectedIds(new Set());
      } else {
        toast.error(result.error || "Failed to load next page");
      }
    });
  };

  // Handle previous page
  const handlePrevPage = () => {
    if (cursorHistory.length === 0) return;

    const newHistory = [...cursorHistory];
    const prevCursor = newHistory.pop();

    startTransition(async () => {
      // For first page, don't pass cursor
      const result = await getVideos(newHistory.length > 0 ? newHistory[newHistory.length - 1] : undefined);
      if (result.success && result.videos) {
        setCursorHistory(newHistory);
        setVideos(result.videos);
        setCursor(result.cursor);
        setSelectedIds(new Set());
      } else {
        toast.error(result.error || "Failed to load previous page");
      }
    });
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    const idsToDelete = Array.from(selectedIds);

    // Twitch API limits to 5 deletions per request
    if (idsToDelete.length > 5) {
      toast.error("Maximum 5 videos can be deleted at once");
      return;
    }

    const result = await deleteVideos(idsToDelete);

    if (result.success) {
      toast.success(`Successfully deleted ${result.deletedIds?.length || 0} video(s)`);
      setDeleteDialogOpen(false);
      setSelectedIds(new Set());
      // Refresh the list
      await handleRefresh();
    } else {
      toast.error(result.error || "Failed to delete videos");
    }
  };

  const hasSelection = selectedIds.size > 0;
  const hasPrevPage = cursorHistory.length > 0;
  const hasNextPage = Boolean(cursor);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {hasSelection && (
            <>
              <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={selectedIds.size > 5}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Selected
              </Button>
              {selectedIds.size > 5 && <span className="text-xs text-destructive">Max 5 at a time</span>}
            </>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Table */}
      {isPending ? (
        <VodsTableSkeleton rows={5} />
      ) : (
        <VodsTable
          videos={videos}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onVideoClick={handleVideoClick}
        />
      )}

      {/* Pagination */}
      {videos.length > 0 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={!hasPrevPage || isPending}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={handleNextPage} disabled={!hasNextPage || isPending}>
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Video Details Dialog */}
      <VideoDetailsDialog
        video={selectedVideo}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onCreateClip={handleCreateClip}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        videos={selectedVideos}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
