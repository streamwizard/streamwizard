import { supabaseAdmin } from "@repo/supabase/next/admin";
import { listCmsAssets, selectUnreferencedCmsAssets } from "@repo/supabase/queries/cms/assets";
import { MediaLibrary } from "@/components/content/media-library";
import { toMediaItem } from "@/lib/cms/media-items";
import { cmsUploadsEnabled } from "@/lib/cms/storage";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

type Params = { q?: string; page?: string };

export default async function MediaPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const search = params.q?.trim() || undefined;

  const [{ data, count, error }, unused] = await Promise.all([
    listCmsAssets(supabaseAdmin, { search }, page, PAGE_SIZE),
    selectUnreferencedCmsAssets(supabaseAdmin),
  ]);
  if (error) throw error;
  if (unused.error) throw unused.error;
  const unusedIds = new Set((unused.data ?? []).map((row) => row.id));

  return (
    <MediaLibrary
      items={(data ?? []).map((row) => toMediaItem(row, unusedIds.has(row.id)))}
      total={count ?? 0}
      page={page}
      pageSize={PAGE_SIZE}
      search={search}
      uploadsEnabled={cmsUploadsEnabled()}
    />
  );
}
