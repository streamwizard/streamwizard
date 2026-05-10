import TwitchClipCard from "@/components/cards/clip-card";
import { AdvancedPagination } from "@/components/nav/advanced-pagination";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import buildClipQuery from "@/lib/utils/build-clip-query";
import { ClipSearchParams } from "@/types/pages";
import { Database } from "@/types/supabase";
import { FolderX } from "lucide-react";

type PageProps = {
  params: Promise<{ folder: string }>;
  searchParams: Promise<ClipSearchParams>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const folderSlug = (await params).folder;
  const parsedSearchParams = await searchParams;
  const supabase = await createClient();

  let query = supabase.rpc(
    "get_clips_by_folder",
    {
      folder_href: folderSlug,
    },
    { count: "exact" }
  );

  query = buildClipQuery(parsedSearchParams, query);

  if (parsedSearchParams.broadcaster_id) {
    query = query.eq("broadcaster_id", parsedSearchParams.broadcaster_id);
  }

  const { data, error, count } = await query;
  if (error) {
    console.error(error);
    return null;
  }
  const pageIndex = parsedSearchParams.page ? parseInt(parsedSearchParams.page) : 1;

  const maxPage = Math.ceil(count! / 100);

  return (
    <>
      {data && data.length > 0 ? (
        <div>
          <div className="grid grid-cols-4 gap-4">
            {data.map((clip) => (
              <TwitchClipCard key={clip.id} {...clip} folders={clip.folders as Database["public"]["Tables"]["clip_folders"]["Row"][]} />
            ))}
          </div>
          <div className="flex justify-between items-center mt-10">
            <AdvancedPagination totalPages={maxPage} initialPage={pageIndex} />
            <p className="text-sm text-muted-foreground">
              Showing {data.length} of {count} clips
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-6 text-center mt-32 space-y-4">
          <FolderX className="w-16 h-16 text-muted-foreground " />
          <p className="text-muted-foreground">This folder is empty</p>
          <Button variant="outline">How do I add clips to a folder?</Button>
        </div>
      )}
    </>
  );
}
