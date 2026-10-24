"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, FilePlus2, Newspaper, RotateCcw, Search, SearchX } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Input,
  NativeSelect,
  NativeSelectOption,
} from "@repo/ui";
import { createContentAction, untrashContentAction } from "@/actions/cms-content";
import { TicketFiltersForm } from "@/components/discord/ticket-filters-form";
import { DataList, type DataColumn } from "@/components/widgets/data-list";
import { FilterPanel } from "@/components/widgets/filter-panel";
import { PageHeader } from "@/components/widgets/page-header";
import { formatDateTime, formatRelativeTime } from "@/lib/discord/tickets";
import type { ContentType } from "@/lib/cms/draft";
import { REVIEW_BADGE, REVIEW_FILTER_STATES, REVIEW_LABELS, type ReviewState } from "@/lib/cms/review";
import { templatesFor } from "@/lib/cms/templates";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/widgets/responsive-dialog";
import type { PickerOption } from "./editor/chip-picker";

/** What a new post starts from. Blank is a template like any other. */
function TemplatePicker({
  type,
  onClose,
  onPick,
}: {
  type: ContentType | null;
  onClose: () => void;
  onPick: (templateId: string) => void;
}) {
  return (
    <ResponsiveDialog open={type !== null} onOpenChange={(open) => !open && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{type === "guide" ? "New guide" : "New blog post"}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Start from a shape, or from nothing. Everything in a template can be changed or deleted.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ul className="space-y-2">
          {(type ? templatesFor(type) : []).map((template) => (
            <li key={template.id}>
              <button
                type="button"
                onClick={() => onPick(template.id)}
                className="w-full rounded-lg border p-3 text-left hover:bg-muted"
              >
                <span className="block text-sm font-medium">{template.name}</span>
                <span className="block text-sm text-muted-foreground">{template.description}</span>
              </button>
            </li>
          ))}
        </ul>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export interface ContentListFilters {
  search?: string;
  type?: "blog" | "guide";
  status?: "draft" | "scheduled" | "published" | "archived";
  /** Only the states worth filtering by: every post that isn't in review is 'none'. */
  reviewState?: Exclude<ReviewState, "none">;
  authorId?: string;
  categoryId?: string;
  sort: "updated" | "published" | "title";
  trash: boolean;
}

export interface ContentRow {
  id: string;
  type: ContentType;
  status: "draft" | "scheduled" | "published" | "archived";
  reviewState: ReviewState;
  title: string;
  slug: string;
  updatedAt: string;
  publishAt: string | null;
  scheduleError: string | null;
  unpublishedChanges: boolean;
  authors: string[];
}

const STATUS_LABELS: Record<ContentRow["status"], string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
};

const SORT_LABELS: Record<ContentListFilters["sort"], string> = {
  updated: "Last edited",
  published: "Newest published",
  title: "Title",
};

const SELECT = "h-11 text-base md:h-9 md:text-sm";

function Restore({ row }: { row: ContentRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-11 md:h-8"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await untrashContentAction(row.id);
          if (result.error) return void toast.error(result.error);
          toast.success("Restored as a draft.");
          router.refresh();
        })
      }
    >
      <RotateCcw aria-hidden />
      Restore
    </Button>
  );
}

export function ContentListView({
  rows,
  total,
  page,
  pageSize,
  filters,
  authors,
  categories,
}: {
  rows: ContentRow[];
  total: number;
  page: number;
  pageSize: number;
  filters: ContentListFilters;
  authors: PickerOption[];
  categories: PickerOption[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState<ContentType | null>(null);
  /** Which kind of post the template picker is open for. */
  const [templateFor, setTemplateFor] = useState<ContentType | null>(null);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const activeFilters =
    [filters.type, filters.status, filters.reviewState, filters.authorId, filters.categoryId].filter(Boolean)
      .length +
    (filters.sort !== "updated" ? 1 : 0);
  const filtered = !!(filters.search || activeFilters);

  const query = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const values: Record<string, string | undefined> = {
      q: filters.search,
      type: filters.type,
      status: filters.status,
      review: filters.reviewState,
      author: filters.authorId,
      category: filters.categoryId,
      sort: filters.sort !== "updated" ? filters.sort : undefined,
      trash: filters.trash ? "1" : undefined,
      ...overrides,
    };
    for (const [key, value] of Object.entries(values)) if (value) next.set(key, value);
    const search = next.toString();
    return search ? `/content?${search}` : "/content";
  };

  const create = async (type: ContentType, templateId?: string) => {
    setCreating(type);
    setTemplateFor(null);
    const result = await createContentAction(type, templateId);
    if (result.error || !result.id) {
      setCreating(null);
      return void toast.error(result.error ?? "Couldn't create the draft.");
    }
    router.push(`/content/${result.id}`);
  };

  const columns: DataColumn<ContentRow>[] = [
    {
      key: "title",
      header: "Title",
      mobile: "title",
      className: "max-w-96",
      cell: (row) => (
        <span className="min-w-0">
          <span className="block truncate">
            {row.title.trim() || <em className="text-muted-foreground">Untitled</em>}
          </span>
          <span className="block truncate text-xs font-normal text-muted-foreground">
            /{row.type === "guide" ? "guides" : "blog"}/{row.slug}
          </span>
        </span>
      ),
    },
    {
      key: "type",
      header: "Type",
      mobile: "badge",
      cell: (row) => (
        <Badge variant="outline" className="text-xs">
          {row.type === "guide" ? "Guide" : "Blog"}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      mobile: "badge",
      cell: (row) => (
        <span className="flex flex-wrap gap-1">
          <Badge variant={row.status === "published" ? "default" : "secondary"} className="text-xs">
            {STATUS_LABELS[row.status]}
          </Badge>
          {row.status === "scheduled" && row.publishAt && (
            <time dateTime={row.publishAt} className="text-xs text-muted-foreground">
              {formatDateTime(row.publishAt)}
            </time>
          )}
          {row.reviewState !== "none" && (
            <Badge variant={REVIEW_BADGE[row.reviewState]} className="text-xs">
              {REVIEW_LABELS[row.reviewState]}
            </Badge>
          )}
          {row.unpublishedChanges && (
            <Badge variant="outline" className="text-xs">
              Unpublished changes
            </Badge>
          )}
          {row.scheduleError && (
            <Badge variant="destructive" className="text-xs" title={row.scheduleError}>
              Schedule failed
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: "authors",
      header: "Authors",
      className: "max-w-48 truncate text-muted-foreground",
      cell: (row) => (row.authors.length ? row.authors.join(", ") : "–"),
    },
    {
      key: "updated",
      header: "Edited",
      headClassName: "text-right",
      className: "text-right text-muted-foreground",
      cell: (row) => (
        <time dateTime={row.updatedAt} title={formatDateTime(row.updatedAt)} className="whitespace-nowrap tabular-nums">
          {formatRelativeTime(row.updatedAt)}
        </time>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={filters.trash ? "Trash" : "Posts"}
        description={
          filters.trash
            ? "Posts and guides you moved to the trash. Restore one to bring it back as a draft."
            : "Blog posts and guides for streamwizard.org."
        }
      >
        <Button variant="ghost" className="h-11 md:h-9" asChild>
          <Link href={filters.trash ? "/content" : "/content?trash=1"}>
            {filters.trash ? "Back to posts" : "Trash"}
          </Link>
        </Button>
        {!filters.trash && (
          <>
            <Button
              variant="outline"
              className="h-11 md:h-9"
              disabled={creating !== null}
              onClick={() => setTemplateFor("guide")}
            >
              <BookOpen aria-hidden />
              {creating === "guide" ? "Creating…" : "New guide"}
            </Button>
            <Button className="h-11 md:h-9" disabled={creating !== null} onClick={() => setTemplateFor("blog")}>
              <Newspaper aria-hidden />
              {creating === "blog" ? "Creating…" : "New blog post"}
            </Button>
          </>
        )}
      </PageHeader>

      <TemplatePicker
        type={templateFor}
        onClose={() => setTemplateFor(null)}
        onPick={(templateId) => templateFor && void create(templateFor, templateId)}
      />

      <TicketFiltersForm
        action="/content"
        className="flex flex-wrap items-center gap-2 [&_[data-slot=native-select-wrapper]]:w-full sm:[&_[data-slot=native-select-wrapper]]:w-auto"
      >
        {filters.trash && <input type="hidden" name="trash" value="1" />}
        <Input
          name="q"
          defaultValue={filters.search}
          placeholder="Title or slug"
          aria-label="Search posts"
          className="h-11 basis-full md:h-9 lg:basis-64 lg:flex-1"
        />
        <Button type="submit" variant="secondary" className="h-11 md:h-9">
          <Search aria-hidden />
          Search
        </Button>
        <FilterPanel activeCount={activeFilters}>
          <NativeSelect
            name="type"
            defaultValue={filters.type ?? ""}
            aria-label="Type"
            className={`${SELECT} w-full sm:w-36`}
          >
            <NativeSelectOption value="">All types</NativeSelectOption>
            <NativeSelectOption value="blog">Blog posts</NativeSelectOption>
            <NativeSelectOption value="guide">Guides</NativeSelectOption>
          </NativeSelect>
          <NativeSelect
            name="status"
            defaultValue={filters.status ?? ""}
            aria-label="Status"
            className={`${SELECT} w-full sm:w-36`}
          >
            <NativeSelectOption value="">Any status</NativeSelectOption>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <NativeSelectOption key={value} value={value}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect
            name="review"
            defaultValue={filters.reviewState ?? ""}
            aria-label="Review"
            className={`${SELECT} w-full sm:w-44`}
          >
            <NativeSelectOption value="">Any review state</NativeSelectOption>
            {REVIEW_FILTER_STATES.map((state) => (
              <NativeSelectOption key={state} value={state}>
                {REVIEW_LABELS[state]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect
            name="author"
            defaultValue={filters.authorId ?? ""}
            aria-label="Author"
            className={`${SELECT} w-full sm:w-40`}
          >
            <NativeSelectOption value="">Any author</NativeSelectOption>
            {authors.map((author) => (
              <NativeSelectOption key={author.id} value={author.id}>
                {author.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect
            name="category"
            defaultValue={filters.categoryId ?? ""}
            aria-label="Category"
            className={`${SELECT} w-full sm:w-40`}
          >
            <NativeSelectOption value="">Any category</NativeSelectOption>
            {categories.map((category) => (
              <NativeSelectOption key={category.id} value={category.id}>
                {category.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect
            name="sort"
            defaultValue={filters.sort === "updated" ? "" : filters.sort}
            aria-label="Sort"
            className={`${SELECT} w-full sm:w-44`}
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <NativeSelectOption key={value} value={value === "updated" ? "" : value}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FilterPanel>
        {filtered && (
          <Button variant="ghost" className="h-11 md:h-9" asChild>
            <Link href={filters.trash ? "/content?trash=1" : "/content"}>Clear</Link>
          </Button>
        )}
      </TicketFiltersForm>

      {rows.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">{filtered ? <SearchX /> : <FilePlus2 />}</EmptyMedia>
            <EmptyTitle>
              {filtered ? "Nothing matches" : filters.trash ? "The trash is empty" : "No posts yet"}
            </EmptyTitle>
            <EmptyDescription>
              {filtered
                ? "Try a shorter search or another filter."
                : filters.trash
                  ? "Posts you move to the trash show up here."
                  : "Start with a guide that answers a question streamers ask you a lot."}
            </EmptyDescription>
          </EmptyHeader>
          {filtered && (
            <EmptyContent>
              <Button variant="outline" className="h-11 md:h-8" asChild>
                <Link href={filters.trash ? "/content?trash=1" : "/content"}>Clear filters</Link>
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <Card className="py-0">
          <CardContent className="px-0 sm:px-2">
            <DataList
              rows={rows}
              rowKey={(row) => row.id}
              rowHref={filters.trash ? undefined : (row) => `/content/${row.id}`}
              columns={columns}
              actions={filters.trash ? (row) => <Restore row={row} /> : undefined}
            />
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && pages > 1 && (
        <nav className="flex flex-wrap items-center justify-between gap-2 text-sm" aria-label="Pagination">
          <span className="text-muted-foreground tabular-nums">
            {total} post{total === 1 ? "" : "s"} · page {page} of {pages}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-11 md:h-8" asChild={page > 1} disabled={page <= 1}>
              {page > 1 ? <Link href={query({ page: String(page - 1) })}>Previous</Link> : <span>Previous</span>}
            </Button>
            <Button variant="outline" size="sm" className="h-11 md:h-8" asChild={page < pages} disabled={page >= pages}>
              {page < pages ? <Link href={query({ page: String(page + 1) })}>Next</Link> : <span>Next</span>}
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
