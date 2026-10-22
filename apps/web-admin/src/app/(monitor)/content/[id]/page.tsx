import { notFound } from "next/navigation";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { selectCmsAsset } from "@repo/supabase/queries/cms/assets";
import { listCmsAuthors } from "@repo/supabase/queries/cms/authors";
import { getCmsContentForEditor, listCmsContentOptions } from "@repo/supabase/queries/cms/content";
import { listCmsCategories, listCmsTags } from "@repo/supabase/queries/cms/taxonomy";
import { ContentEditor, type ContentStatus, type EditorImage } from "@/components/content/editor/content-editor";
import { describeScheduleError } from "@/lib/cms/content-errors";
import { contentType, draftFromRow, rowHasFutureBody } from "@/lib/cms/draft-row";
import { publicContentUrl } from "@/lib/cms/publish";
import { cmsAssetUrl } from "@/lib/cms/storage";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadImages(ids: (string | null)[]): Promise<Record<string, EditorImage>> {
  const images: Record<string, EditorImage> = {};
  await Promise.all(
    ids.map(async (id) => {
      if (!id) return;
      const { data } = await selectCmsAsset(supabaseAdmin, id);
      if (data) images[id] = { url: cmsAssetUrl(data.key), alt: data.alt, decorative: data.is_decorative };
    }),
  );
  return images;
}

export default async function ContentEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { data: row, error } = await getCmsContentForEditor(supabaseAdmin, id);
  if (error) throw error;
  if (!row || row.deleted_at) notFound();

  const [authors, categories, tags, related, images] = await Promise.all([
    listCmsAuthors(supabaseAdmin, true),
    listCmsCategories(supabaseAdmin),
    listCmsTags(supabaseAdmin),
    listCmsContentOptions(supabaseAdmin),
    loadImages([row.cover_asset_id, row.og_asset_id]),
  ]);

  return (
    <ContentEditor
      // A restore or someone else's save means a fresh start, not a merge.
      key={row.lock_version}
      id={row.id}
      type={contentType(row)}
      status={row.status as ContentStatus}
      lockVersion={row.lock_version}
      initial={draftFromRow(row)}
      publishedSlug={row.published?.slug ?? null}
      publishAt={row.publish_at}
      liveUrl={row.published ? publicContentUrl(env.CMS_SITE_URL, contentType(row), row.published.slug) : null}
      unpublishedChanges={!!row.published && row.updated_at > row.published.snapshot_at}
      scheduleError={row.schedule_error ? describeScheduleError(row.schedule_error) : null}
      futureBody={rowHasFutureBody(row)}
      updatedAt={row.updated_at}
      images={images}
      options={{
        authors: (authors.data ?? [])
          .filter((author) => !author.deleted_at || row.credits.some((credit) => credit.author_id === author.id))
          .map((author) => ({ id: author.id, label: author.name, hint: author.deleted_at ? "deleted" : undefined })),
        categories: (categories.data ?? []).map((category) => ({ id: category.id, label: category.name })),
        tags: (tags.data ?? []).map((tag) => ({ id: tag.id, label: tag.name })),
        related: (related.data ?? []).map((option) => ({
          id: option.id,
          label: option.title.trim() || "Untitled",
          hint: option.status === "published" ? (option.type === "guide" ? "guide" : "blog") : option.status,
        })),
      }}
    />
  );
}
