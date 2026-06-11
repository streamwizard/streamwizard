import { ClipsDisplay } from "@/components/clips/clips-display";
import { ClipsPaginationBar } from "@/components/nav/clips-pagination-bar";
import { createClient } from "@repo/supabase/next/server";
import buildClipQuery from "@/lib/utils/build-clip-query";
import { parseClipPageSize } from "@/lib/utils/clip-pagination";
import { parseClipView } from "@/lib/utils/clip-view";
import { normalizeClipsWithFolders } from "@/types/database";
import { ClipSearchParams } from "@/types/pages";
import { redirect } from "next/navigation";

export default async function ClipsPage({ searchParams }: { searchParams: Promise<ClipSearchParams> }) {
  const supabase = await createClient();
  const parsedSearchParams = await searchParams;

  const { data: user } = await supabase.auth.getUser();

  if (!user?.user?.id || !user?.user) {
    redirect("/login");
  }

  let query = supabase.rpc("get_all_clips_with_folders", undefined, { count: "exact" });

  query = buildClipQuery(parsedSearchParams, query);

  query = parsedSearchParams.broadcaster_id ? query.eq("broadcaster_id", parsedSearchParams.broadcaster_id) : query.eq("user_id", user.user.id);

  const { data, error, count, } = await query;
  if (error) {
    console.error(error);
    return null;
  }

  const pageIndex = parsedSearchParams.page ? parseInt(parsedSearchParams.page, 10) : 1;
  const pageSize = parseClipPageSize(parsedSearchParams.per_page);
  const clipView = parseClipView(parsedSearchParams.view);
  const totalCount = count ?? 0;
  const maxPage = Math.max(1, Math.ceil(totalCount / pageSize));

  const paginationProps = {
    totalPages: maxPage,
    currentPage: pageIndex,
    pageSize,
    totalCount,
    showingCount: data?.length ?? 0,
  };

  return (
    <>
      {totalCount > 0 && <ClipsPaginationBar {...paginationProps} placement="top" />}
      {data && data.length > 0 ? (
        <ClipsDisplay clips={normalizeClipsWithFolders(data)} view={clipView} />
      ) : null}
      {totalCount > 0 && <ClipsPaginationBar {...paginationProps} placement="bottom" />}
    </>
  );
}
