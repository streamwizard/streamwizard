import { Suspense } from "react";
import TwitchClipCard from "@/components/cards/clip-card";
import { AdvancedPagination } from "@/components/nav/advanced-pagination";
import TwitchClipSearchForm from "@/components/forms/twitch-clip-filter-form";
import { Button } from "@repo/ui";
import { createClient } from "@repo/supabase/next/server";
import buildClipQuery from "@/lib/utils/build-clip-query";
import { ClipSearchParams } from "@/types/pages";
import { Database } from "@repo/supabase";
import { FolderX } from "lucide-react";
import Loading from "../loading";

type PageProps = {
  params: Promise<{ folder: string }>;
  searchParams: Promise<ClipSearchParams>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const folderSlug = (await params).folder;
  const parsedSearchParams = await searchParams;
  const searchParamsKey = new URLSearchParams(parsedSearchParams as Record<string, string>).toString();

  return (
    <>
      <TwitchClipSearchForm />
      <Suspense key={searchParamsKey} fallback={<Loading />}>
        <FolderClipsGrid folderSlug={folderSlug} searchParams={parsedSearchParams} />
      </Suspense>
    </>
  );
}

async function FolderClipsGrid({ folderSlug, searchParams }: { folderSlug: string; searchParams: ClipSearchParams }) {
  const supabase = await createClient();

  let query = supabase.rpc("get_clips_by_folder", { folder_href: folderSlug }, { count: "exact" });
  query = buildClipQuery(searchParams, query);

  if (searchParams.broadcaster_id) {
    query = query.eq("broadcaster_id", searchParams.broadcaster_id);
  }

  const { data, error, count } = await query;
  if (error) {
    console.error(error);
    return null;
  }

  const pageIndex = searchParams.page ? parseInt(searchParams.page) : 1;
  const maxPage = Math.ceil(count! / 100);

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center mt-32 space-y-4">
        <FolderX className="w-16 h-16 text-muted-foreground" />
        <p className="text-muted-foreground">This folder is empty</p>
        <Button variant="outline">How do I add clips to a folder?</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <AdvancedPagination totalPages={maxPage} initialPage={pageIndex} />
        <p className="text-sm text-muted-foreground">
          Showing {data.length} of {count} clips
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
  );
}
