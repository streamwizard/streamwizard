import { supabaseAdmin } from "@repo/supabase/next/admin";
import { listCmsAuthors } from "@repo/supabase/queries/cms/authors";
import {
  listCmsContent,
  type CmsContentSort,
  type CmsContentStatus,
  type CmsContentType,
} from "@repo/supabase/queries/cms/content";
import { listCmsCategories } from "@repo/supabase/queries/cms/taxonomy";
import { ContentListView, type ContentListFilters } from "@/components/content/content-list-view";
import { describeScheduleError } from "@/lib/cms/content-errors";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = ["blog", "guide"] as const;
const STATUSES = ["draft", "scheduled", "published", "archived"] as const;
const SORTS = ["updated", "published", "title"] as const;

type Params = {
  q?: string;
  type?: string;
  status?: string;
  author?: string;
  category?: string;
  sort?: string;
  trash?: string;
  page?: string;
};

function pick<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

export default async function ContentPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const filters: ContentListFilters = {
    search: params.q?.trim() || undefined,
    type: pick<CmsContentType>(params.type, TYPES),
    status: pick<CmsContentStatus>(params.status, STATUSES),
    authorId: params.author && UUID.test(params.author) ? params.author : undefined,
    categoryId: params.category && UUID.test(params.category) ? params.category : undefined,
    sort: pick<CmsContentSort>(params.sort, SORTS) ?? "updated",
    trash: params.trash === "1",
  };

  const [{ data, count, error }, authors, categories] = await Promise.all([
    listCmsContent(supabaseAdmin, filters, page, PAGE_SIZE),
    listCmsAuthors(supabaseAdmin),
    listCmsCategories(supabaseAdmin),
  ]);
  if (error) throw error;

  return (
    <ContentListView
      filters={filters}
      page={page}
      pageSize={PAGE_SIZE}
      total={count ?? 0}
      authors={(authors.data ?? []).map((author) => ({ id: author.id, label: author.name }))}
      categories={(categories.data ?? []).map((category) => ({ id: category.id, label: category.name }))}
      rows={(data ?? []).map((row) => ({
        id: row.id,
        type: row.type === "guide" ? "guide" : "blog",
        status: row.status as CmsContentStatus,
        title: row.title,
        slug: row.slug,
        updatedAt: row.updated_at,
        publishAt: row.publish_at,
        scheduleError: row.schedule_error ? describeScheduleError(row.schedule_error) : null,
        unpublishedChanges: !!row.published && row.updated_at > row.published.snapshot_at,
        authors: [...row.credits]
          .sort((a, b) => a.position - b.position)
          .flatMap((credit) => (credit.author ? [credit.author.name] : [])),
      }))}
    />
  );
}
