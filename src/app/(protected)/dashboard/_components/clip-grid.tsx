import React, { Suspense } from "react";
import { fetchClips } from "../server/fetch-clips";
import { TwitchClipTable } from "@/types/database";
import TwitchClipCard from "@/components/cards/clip-card";
import { AdvancedPagination } from "@/components/nav/advanced-pagination";
import SyncTwitchClipsButton from "@/components/buttons/sync-twitch-clips";

export default async function ClipGrid({ searchParams }: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  const clipsData = await fetchClips(await searchParams);

  if (!clipsData) {
    return <div>Error loading clips</div>;
  }

  const { data, count, pageIndex } = clipsData;
  const maxPage = Math.ceil(count / 100);

  return (
    <>
      {data && data.length > 0 ? (
        <>
          <div className="grid grid-cols-4 gap-4 mb-4">
            {data.map((clip: TwitchClipTable) => (
              <TwitchClipCard key={clip.id} {...clip} />
            ))}
          </div>

          <div className="flex justify-between items-center">
            <AdvancedPagination totalPages={maxPage} initialPage={pageIndex} />
            <p className="text-sm text-muted-foreground">
              Showing {data.length} of {count} clips
            </p>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-[50vh] p-4 space-y-4">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">No clips found</h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Try syncing to find new clips</p>
          </div>
          <div>
            <SyncTwitchClipsButton />
          </div>
        </div>
      )}
    </>
  );
}
