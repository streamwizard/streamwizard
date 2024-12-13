import TwitchClipCard from "@/components/cards/clip-card";
import { createClient } from "@/lib/supabase/server";
import buildClipQuery from "@/lib/utils/build-clip-query";
import { ClipSearchParams } from "@/types/pages";
import { Database } from "@/types/supabase";

type PageProps = {
  params: Promise<{ folder: string }>;
  searchParams: Promise<ClipSearchParams>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const folderSlug = (await params).folder;
  const parsedSearchParams = await searchParams;
  const supabase = await createClient();

  let query = supabase.rpc("get_clips_by_folder", {
    folder_href: folderSlug,
  });

  query = buildClipQuery(parsedSearchParams, query);

  if (parsedSearchParams.broadcaster_id) {
    query = query.eq("broadcaster_id", parsedSearchParams.broadcaster_id);
  }

  let { data, error, count } = await query;
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
