import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../types/supabase";
import { withMetrics } from "../with-metrics";

/**
 * CMS posts and guides: the admin-only working copy, its revisions and the
 * save/restore/trash functions. Service-role client only; the public site
 * reads cms_content_published instead.
 */

type DBClient = SupabaseClient<Database>;
export type CmsContent = Database["public"]["Tables"]["cms_content"]["Row"];
export type CmsContentType = "blog" | "guide";
export type CmsContentStatus = "draft" | "scheduled" | "published" | "archived";

export type CmsContentSort = "updated" | "published" | "title";

export interface CmsContentListFilters {
  type?: CmsContentType;
  status?: CmsContentStatus;
  authorId?: string;
  categoryId?: string;
  search?: string;
  /** Only posts in the trash; otherwise only posts outside it. */
  trash?: boolean;
  sort?: CmsContentSort;
}

/** One row of the admin list. Typed by hand: the filter embeds make the select string dynamic. */
export interface CmsContentListRow {
  id: string;
  type: string;
  status: string;
  title: string;
  slug: string;
  updated_at: string;
  publish_at: string | null;
  first_published_at: string | null;
  deleted_at: string | null;
  schedule_error: string | null;
  published: { snapshot_at: string } | null;
  credits: { position: number; author: { id: string; name: string } | null }[];
}

const LIST_COLUMNS =
  "id, type, status, title, slug, updated_at, publish_at, first_published_at, deleted_at, schedule_error, published:cms_content_published(snapshot_at), credits:cms_content_authors(position, author:cms_authors(id, name))";

export const listCmsContent = withMetrics(
  "cms_content",
  "select",
  async (client: DBClient, filters: CmsContentListFilters, page: number, pageSize: number) => {
    // The filter embeds are separate aliases, so the credits shown stay complete.
    const select = [
      LIST_COLUMNS,
      filters.authorId ? "author_filter:cms_content_authors!inner(author_id)" : null,
      filters.categoryId ? "category_filter:cms_content_categories!inner(category_id)" : null,
    ]
      .filter(Boolean)
      .join(", ");

    let query = client.from("cms_content").select(select, { count: "exact" });
    query = filters.trash ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);
    if (filters.type) query = query.eq("type", filters.type);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.authorId) query = query.eq("author_filter.author_id", filters.authorId);
    if (filters.categoryId) query = query.eq("category_filter.category_id", filters.categoryId);
    const search = filters.search?.replace(/[%_,()]/g, " ").trim();
    if (search) query = query.or(`title.ilike.%${search}%,slug.ilike.%${search}%`);

    switch (filters.sort ?? "updated") {
      case "published":
        query = query.order("first_published_at", { ascending: false, nullsFirst: false });
        break;
      case "title":
        query = query.order("title");
        break;
      default:
        query = query.order("updated_at", { ascending: false });
    }
    return query
      .range((page - 1) * pageSize, page * pageSize - 1)
      .overrideTypes<CmsContentListRow[], { merge: false }>();
  },
);

export const insertCmsContent = withMetrics(
  "cms_content",
  "insert",
  async (client: DBClient, input: { type: CmsContentType; slug: string; createdBy: string }) =>
    client
      .from("cms_content")
      .insert({ type: input.type, slug: input.slug, created_by: input.createdBy, updated_by: input.createdBy })
      .select("id")
      .single(),
);

/** The working copy with everything the editor shows. */
export const getCmsContentForEditor = withMetrics("cms_content", "select", async (client: DBClient, id: string) =>
  client
    .from("cms_content")
    .select(
      "*, sections:cms_guide_sections(id, position, title, anchor, body), credits:cms_content_authors(author_id, position), categories:cms_content_categories(category_id), tags:cms_content_tags(tag_id), related:cms_related_content!cms_related_content_content_id_fkey(related_id, position), published:cms_content_published(snapshot_at, slug)",
    )
    .eq("id", id)
    .order("position", { referencedTable: "cms_guide_sections" })
    .maybeSingle(),
);

/** Just enough to name a post in a log line or a toast. */
export const getCmsContentSummary = withMetrics("cms_content", "select", async (client: DBClient, id: string) =>
  client
    .from("cms_content")
    .select("id, type, status, title, slug, lock_version, deleted_at")
    .eq("id", id)
    .maybeSingle(),
);

export interface SaveCmsDraftInput {
  contentId: string;
  actorId: string;
  expectedLockVersion: number;
  fields: Record<string, Json>;
  sections: Json | null;
  authorIds: string[] | null;
  categoryIds: string[] | null;
  tagIds: string[] | null;
  relatedIds: string[] | null;
  revision: "autosave" | "manual" | "none";
}

/** One transaction behind the lock check: fields, sections and credits. Returns { lock_version, updated_at }. */
export const saveCmsDraft = withMetrics("cms_content", "update", async (client: DBClient, input: SaveCmsDraftInput) =>
  client.rpc("cms_save_draft", {
    p_content_id: input.contentId,
    p_actor: input.actorId,
    p_expected_lock_version: input.expectedLockVersion,
    p_fields: input.fields,
    p_sections: input.sections ?? undefined,
    p_author_ids: input.authorIds ?? undefined,
    p_category_ids: input.categoryIds ?? undefined,
    p_tag_ids: input.tagIds ?? undefined,
    p_related_ids: input.relatedIds ?? undefined,
    p_revision: input.revision,
  }),
);

export const restoreCmsRevision = withMetrics(
  "cms_revisions",
  "update",
  async (client: DBClient, contentId: string, actorId: string, expectedLockVersion: number, revisionId: string) =>
    client.rpc("cms_restore_revision", {
      p_content_id: contentId,
      p_actor: actorId,
      p_expected_lock_version: expectedLockVersion,
      p_revision_id: revisionId,
    }),
);

/**
 * Puts the working copy on the site, or pushes a live post's changes ("Update").
 * Returns { before, after, lock_version, first_publish }; before/after are the
 * public footprints for tagsForChange.
 */
export const publishCmsContent = withMetrics(
  "cms_content",
  "update",
  async (client: DBClient, contentId: string, actorId: string, expectedLockVersion: number, minorEdit: boolean) =>
    client.rpc("cms_publish", {
      p_content_id: contentId,
      p_actor: actorId,
      p_expected_lock_version: expectedLockVersion,
      p_minor_edit: minorEdit,
    }),
);

/** Takes a live post off the site, back to draft or into the archive. Returns { before, lock_version }. */
export const unpublishCmsContent = withMetrics(
  "cms_content",
  "update",
  async (
    client: DBClient,
    contentId: string,
    actorId: string,
    expectedLockVersion: number,
    toStatus: "draft" | "archived",
  ) =>
    client.rpc("cms_unpublish", {
      p_content_id: contentId,
      p_actor: actorId,
      p_expected_lock_version: expectedLockVersion,
      p_to_status: toStatus,
    }),
);

/**
 * Archived back to draft. Archived posts aren't on the site, so this is a
 * plain status change behind the lock check. No row back: it moved meanwhile.
 */
export const unarchiveCmsContent = withMetrics(
  "cms_content",
  "update",
  async (client: DBClient, contentId: string, actorId: string, expectedLockVersion: number) =>
    client
      .from("cms_content")
      .update({ status: "draft", lock_version: expectedLockVersion + 1, updated_by: actorId })
      .eq("id", contentId)
      .eq("status", "archived")
      .eq("lock_version", expectedLockVersion)
      .is("deleted_at", null)
      .select("lock_version")
      .maybeSingle(),
);

/** Takes it off the site (if it was on) and into the trash. Returns { before }. */
export const trashCmsContent = withMetrics(
  "cms_content",
  "update",
  async (client: DBClient, contentId: string, actorId: string, expectedLockVersion: number | null) =>
    client.rpc("cms_trash", {
      p_content_id: contentId,
      p_actor: actorId,
      // null skips the lock check (trash from the list). The generated type
      // says number because the SQL argument has no default.
      p_expected_lock_version: expectedLockVersion as number,
    }),
);

/** Out of the trash, as a draft. Fails with a unique violation when the slug was taken meanwhile. */
export const untrashCmsContent = withMetrics("cms_content", "update", async (client: DBClient, contentId: string) =>
  client
    .from("cms_content")
    .update({ deleted_at: null, status: "draft" })
    .eq("id", contentId)
    .not("deleted_at", "is", null)
    .select("id")
    .maybeSingle(),
);

export const listCmsRevisions = withMetrics("cms_revisions", "select", async (client: DBClient, contentId: string) =>
  client
    .from("cms_revisions")
    .select("id, kind, created_at, created_by, title:snapshot->>title, word_count:snapshot->>word_count")
    .eq("content_id", contentId)
    .order("created_at", { ascending: false })
    .limit(100),
);

/** One revision with its full snapshot, for comparing with the draft. */
export const getCmsRevision = withMetrics(
  "cms_revisions",
  "select",
  async (client: DBClient, contentId: string, revisionId: string) =>
    client
      .from("cms_revisions")
      .select("id, kind, created_at, snapshot")
      .eq("content_id", contentId)
      .eq("id", revisionId)
      .maybeSingle(),
);

/** Posts and guides to pick as related posts. */
export const listCmsContentOptions = withMetrics("cms_content", "select", async (client: DBClient) =>
  client
    .from("cms_content")
    .select("id, type, title, slug, status")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(300),
);

/** The live author linked to an account, if any: the default byline for that admin's new posts. */
export const selectCmsAuthorForUser = withMetrics("cms_authors", "select", async (client: DBClient, userId: string) =>
  client.from("cms_authors").select("id").eq("user_id", userId).is("deleted_at", null).maybeSingle(),
);
