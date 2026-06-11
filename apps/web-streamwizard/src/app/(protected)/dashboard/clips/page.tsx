import { Suspense } from "react";
import TwitchClipCard from "@/components/cards/clip-card";
import { AdvancedPagination } from "@/components/nav/advanced-pagination";
import TwitchClipSearchForm from "@/components/forms/twitch-clip-filter-form";
import { createClient } from "@repo/supabase/next/server";
import buildClipQuery from "@/lib/utils/build-clip-query";
import { ClipSearchParams } from "@/types/pages";
import { Database } from "@repo/supabase";
import { redirect } from "next/navigation";
import Loading from "./loading";

export default async function ClipsPage({ searchParams }: { searchParams: Promise<ClipSearchParams> }) {
  const parsedSearchParams = await searchParams;
  const searchParamsKey = new URLSearchParams(parsedSearchParams as Record<string, string>).toString();

  return (
    <>
      <TwitchClipSearchForm />
      <Suspense key={searchParamsKey} fallback={<Loading />}>
        <ClipsGrid searchParams={parsedSearchParams} />
      </Suspense>
    </>
  );
}

async function ClipsGrid({ searchParams }: { searchParams: ClipSearchParams }) {
  const supabase = await createClient();

  const { data: user } = await supabase.auth.getUser();
  if (!user?.user?.id || !user?.user) redirect("/login");

  let query = supabase.rpc("get_all_clips_with_folders", undefined, { count: "exact" });
  query = buildClipQuery(searchParams, query);
  query = searchParams.broadcaster_id
    ? query.eq("broadcaster_id", searchParams.broadcaster_id)
    : query.eq("user_id", user.user.id);

  const { data, error, count } = await query;
  if (error) {
    console.error(error);
    return null;
  }

  const pageIndex = searchParams.page ? parseInt(searchParams.page) : 1;
  const maxPage = Math.ceil(count! / 100);

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <AdvancedPagination totalPages={maxPage} initialPage={pageIndex} />
        <p className="text-sm text-muted-foreground">
          Showing {data.length} of {count} clips
        </p>
      </div>
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
    </>
  );
}
