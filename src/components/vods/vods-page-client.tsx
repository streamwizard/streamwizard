"use client";

import { useState, useTransition } from "react";
import { TwitchVideo } from "@/types/twitch";
import { getVideos } from "@/actions/twitch/vods";
import { toast } from "sonner";
import { Loader2, Video } from "lucide-react";

import { VodTable } from "./vod-table";
import { VodTableSkeleton } from "./vod-table-skeleton";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";

interface VodsPageClientProps {
  initialVideos: TwitchVideo[];
  initialCursor?: string;
}

export function VodsPageClient({ initialVideos, initialCursor }: VodsPageClientProps) {
  const [videos, setVideos] = useState<TwitchVideo[]>(initialVideos);
  const [cursor, setCursor] = useState<string | undefined>(initialCursor);
  const [isPending, startTransition] = useTransition();

  const handleLoadMore = () => {
    if (!cursor) return;

    startTransition(async () => {
      const result = await getVideos({ cursor });

      if (result.success && result.data) {
        setVideos((prev) => [...prev, ...result.data!.videos]);
        setCursor(result.data.cursor);
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleVideosDeleted = (deletedIds: string[]) => {
    setVideos((prev) => prev.filter((v) => !deletedIds.includes(v.id)));
  };

  if (videos.length === 0) {
    return (
      <Empty
        title="No VODs found"
      />
    );
  }

  return (
    <div className="space-y-6">
      <VodTable videos={videos} onVideosDeleted={handleVideosDeleted} />

      {cursor && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}

      <div className="text-center text-sm text-muted-foreground">
        Showing {videos.length} video(s)
      </div>
    </div>
  );
}
