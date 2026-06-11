import { ClipsDisplay } from "@/components/clips/clips-display";
import { ClipsPaginationBar } from "@/components/nav/clips-pagination-bar";
import { Button } from "@repo/ui";
import { createClient } from "@repo/supabase/next/server";
import buildClipQuery from "@/lib/utils/build-clip-query";
import { parseClipPageSize } from "@/lib/utils/clip-pagination";
import { parseClipView } from "@/lib/utils/clip-view";
import { findFolderByUrlSegments, getFolderBreadcrumb, getFolderUrl } from "@/lib/utils/clip-folders";
import { normalizeClipsWithFolders } from "@/types/database";
import { ClipSearchParams } from "@/types/pages";
import { FolderX } from "lucide-react";
import Link from "next/link";

type PageProps = {
  params: Promise<{ folder: string[] }>;
  searchParams: Promise<ClipSearchParams>;
};

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: PageProps) {
  const folderSegments = (await params).folder;
  const parsedSearchParams = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: folders } = auth.user
    ? await supabase.from("clip_folders").select("*").eq("user_id", auth.user.id)
    : { data: null };
  const currentFolder = folders ? findFolderByUrlSegments(folderSegments, folders) : undefined;
  const folderHref = currentFolder?.href;

  if (!folderHref) {
    return (
      <div className="mt-32 flex flex-col items-center justify-center space-y-4 p-6 text-center">
        <FolderX className="h-16 w-16 text-muted-foreground" />
        <p className="text-muted-foreground">Folder not found</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/clips">Back to all clips</Link>
        </Button>
      </div>
    );
  }

  let query = supabase.rpc(
    "get_clips_by_folder",
    {
      folder_href: folderHref,
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

  const breadcrumb = currentFolder && folders ? getFolderBreadcrumb(currentFolder, folders) : [];

  return (
    <>
      {breadcrumb.length > 0 && (
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link href="/dashboard/clips" className="hover:text-foreground">
            Clips
          </Link>
          {breadcrumb.map((folder) => (
            <span key={folder.id} className="flex items-center gap-2">
              <span>/</span>
              <Link href={getFolderUrl(folder.href)} className="hover:text-foreground">
                {folder.name}
              </Link>
            </span>
          ))}
        </nav>
      )}
      {data && data.length > 0 ? (
        <div>
          <ClipsPaginationBar {...paginationProps} placement="top" />
          <ClipsDisplay clips={normalizeClipsWithFolders(data)} view={clipView} />
          <ClipsPaginationBar {...paginationProps} placement="bottom" />
        </div>
      ) : (
        <div className="mt-32 flex flex-col items-center justify-center space-y-4 p-6 text-center">
          <FolderX className="h-16 w-16 text-muted-foreground " />
          <p className="text-muted-foreground">This folder is empty</p>
          <Button variant="outline">How do I add clips to a folder?</Button>
        </div>
      )}
    </>
  );
}
