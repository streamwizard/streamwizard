import TwitchClipCard from "@/components/cards/clip-card";
import { AdvancedPagination } from "@/components/nav/advanced-pagination";
import { createClient } from "@/lib/supabase/server";
import buildClipQuery from "@/lib/utils/build-clip-query";
import { ClipSearchParams } from "@/types/pages";
import { Database } from "@/types/supabase";
import { redirect } from "next/navigation";

export default async function ClipsPage({ searchParams }: { searchParams: Promise<ClipSearchParams> }) {
  const supabase = await createClient();
  const parsedSearchParams = await searchParams;

  const { data: user } = await supabase.auth.getUser();

  if (!user?.user?.id || !user?.user) {
    redirect("/login");
  }

  let query = supabase.rpc("get_all_clips_with_folders", {}, { count: "exact" });

  // create type of query
  

  query = buildClipQuery(parsedSearchParams, query);

  query = parsedSearchParams.broadcaster_id ? query.eq("broadcaster_id", parsedSearchParams.broadcaster_id) : query.eq("user_id", user.user.id);

  const { data, error, count,  } = await query;
  if (error) {
    console.error(error);
    return null;
  }

  const pageIndex = parsedSearchParams.page ? parseInt(parsedSearchParams.page) : 1;

  const maxPage = Math.ceil(count! / 100);


  return (
    <>
      <div className="grid grid-cols-4 gap-4">
        {data &&
          data.map((clip) => (
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
