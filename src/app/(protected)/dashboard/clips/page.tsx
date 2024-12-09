import TwitchClipCard from "@/components/cards/clip-card";
import { createClient } from "@/lib/supabase/server";
import buildClipQuery from "@/lib/utils/build-clip-query";
import { ClipSearchParams } from "@/types/pages";
import { Database } from "@/types/supabase";

export default async function ClipsPage({ searchParams }: { searchParams: Promise<ClipSearchParams> }) {
  const supabase = await createClient();
  const parsedSearchParams = await searchParams;

  const { data: user } = await supabase.auth.getUser();

  let query = supabase.rpc("get_all_clips_with_folders");

  query = buildClipQuery(parsedSearchParams, query);

  query = parsedSearchParams.broadcaster_id ? query.eq("broadcaster_id", parsedSearchParams.broadcaster_id) : query.eq("user_id", user?.user?.id!);

  const { data, error, count } = await query;
  if (error) {
    console.error(error);
    return null;
  }

  return (
    <div className="grid grid-cols-4 gap-4">
      {data &&
        data.map((clip) => (
          <TwitchClipCard key={clip.id} {...clip} folders={clip.folders as Database["public"]["Tables"]["clip_folders"]["Row"][]} />
        ))}
    </div>
  );
}
