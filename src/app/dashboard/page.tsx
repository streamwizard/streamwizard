import SyncTwitchClipsButton from "@/components/buttons/sync-twitch-clips";
import TwitchClipCard from "@/components/cards/clip-card";
import TwitchClipSearchForm from "@/components/forms/twitch-clip-filter-form";
import { AdvancedPagination } from "@/components/nav/advanced-pagination";
import { createClient } from "@/lib/supabase/server";
import { TwitchClipTable } from "@/types/database";

import React from "react";

export default async function ClipsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  const supabase = await createClient();

  const { data: user } = await supabase.auth.getUser();

  // Destructure and parse filter values from searchParams
  const { game_id, creator_id, is_featured, end_date, start_date, search_query, page, broadcaster_id } = await searchParams;

  // Build the Supabase query with filters
  let query = supabase.from("clips").select("*", { count: "exact" }).limit(100).order("created_at_twitch", { ascending: false });

  if (game_id) query = query.eq("game_id", game_id);
  if (creator_id) query = query.eq("creator_id", creator_id);
  if (is_featured !== undefined) query = query.eq("is_featured", is_featured);
  if (start_date) query = query.gte("created_at_twitch", start_date);
  if (end_date) query = query.lte("created_at_twitch", end_date);
  if (search_query) query = query.ilike("title", `%${search_query}%`);

  // if there is a broadcaster_id, add it to the query otherwise use the broadcaster_id from the user
  query = broadcaster_id ? query.eq("broadcaster_id", broadcaster_id) : query.eq("user_id", user?.user?.id!) 

  // Set pagination parameters
  const pageIndex = page ? parseInt(page) : 1;
  const pageSize = 100; // Fixed page size
  const from = (pageIndex - 1) * pageSize; // Calculate starting index
  const to = from + pageSize - 1; // Calculate ending index

  // Add the range to the query
  query = query.range(from, to);

  const res = await query;

  const { data, error } = res;
  let count = res.count;

  if (error) {
    console.error(error);
    return null;
  }

  if (!count) {
    count = 0;
  }

  const maxPage = Math.ceil(count! / pageSize);

  return (
    <>
      <TwitchClipSearchForm />
      {data && data.length > 0 ? (
        <>
          <div className="grid grid-cols-4 gap-4 mb-4">
            {data.map((clip: TwitchClipTable) => (
              <TwitchClipCard key={clip.id} {...clip} />
            ))}
          </div>

          <AdvancedPagination totalPages={maxPage} initialPage={pageIndex} />
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
