import React, { Suspense } from "react";
import { fetchClips } from "../server/fetch-clips";
import { TwitchClipTable } from "@/types/database";
import TwitchClipCard from "@/components/cards/clip-card";
import { AdvancedPagination } from "@/components/nav/advanced-pagination";
import SyncTwitchClipsButton from "@/components/buttons/sync-twitch-clips";
import { createClient } from "@/lib/supabase/server";
import Loading from "../loading";

export default async function ClipGrid({ searchParams }: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  const params = await searchParams;

  const { broadcaster_id } = params;

  const clipsData = await fetchClips(params);
  const supabase = await createClient();

  const { data: user } = await supabase.auth.getUser();

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
            {!broadcaster_id || broadcaster_id === user?.user?.user_metadata.sub ? (
              // User owns the channel
              <p className="mt-2 text-gray-600 dark:text-gray-400">Try syncing your clips to make sure everything is up to date.</p>
            ) : (
              // User does not own the channel
              <p className="mt-2 text-gray-600 dark:text-gray-400">You can only sync clips from your own account.</p>
            )}
          </div>

          {(!broadcaster_id || broadcaster_id === user?.user?.user_metadata.sub) && (
            <div className="w-fit">
              {/* Sync button is only displayed if the user owns the channel */}
              <SyncTwitchClipsButton />
            </div>
          )}
        </div>
      )}
    </>
  );
}
