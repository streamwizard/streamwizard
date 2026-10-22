import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/supabase";
import { withMetrics } from "../with-metrics";

type DBClient = SupabaseClient<Database>;

export type CmsComment = Database["public"]["Tables"]["cms_comments"]["Row"];

// Editorial notes on a draft. Service role only: the admin actions decide
// who may read and write, the same way the rest of the CMS works.

export const COMMENT_COLUMNS =
  "id, content_id, section_id, anchor, parent_id, body, created_by, created_at, resolved_at, resolved_by";

/** Every comment on a post, oldest first, replies included. */
export const listCmsComments = withMetrics("cms_comments", "select", async (client: DBClient, contentId: string) =>
  client
    .from("cms_comments")
    .select(COMMENT_COLUMNS)
    .eq("content_id", contentId)
    .order("created_at", { ascending: true })
    .limit(500),
);

export interface NewCmsComment {
  contentId: string;
  sectionId?: string | null;
  anchor?: string | null;
  parentId?: string | null;
  body: string;
  authorId: string;
}

export const insertCmsComment = withMetrics("cms_comments", "insert", async (client: DBClient, input: NewCmsComment) =>
  client
    .from("cms_comments")
    .insert({
      content_id: input.contentId,
      section_id: input.sectionId ?? null,
      anchor: input.anchor ?? null,
      parent_id: input.parentId ?? null,
      body: input.body,
      created_by: input.authorId,
    })
    .select(COMMENT_COLUMNS)
    .single(),
);

/** The comment a reply would hang off: it must exist here and not be a reply itself. */
export const selectCmsCommentParent = withMetrics(
  "cms_comments",
  "select",
  async (client: DBClient, contentId: string, commentId: string) =>
    client
      .from("cms_comments")
      .select("id, parent_id")
      .eq("id", commentId)
      .eq("content_id", contentId)
      .maybeSingle(),
);

/** Resolving hides a thread; unresolving brings it back. Replies follow their parent. */
export const setCmsCommentResolved = withMetrics(
  "cms_comments",
  "update",
  async (client: DBClient, contentId: string, commentId: string, resolvedBy: string | null) =>
    client
      .from("cms_comments")
      .update({
        resolved_at: resolvedBy ? new Date().toISOString() : null,
        resolved_by: resolvedBy,
      })
      .eq("id", commentId)
      .eq("content_id", contentId)
      .is("parent_id", null)
      .select("id")
      .maybeSingle(),
);

export const deleteCmsComment = withMetrics(
  "cms_comments",
  "delete",
  async (client: DBClient, contentId: string, commentId: string, authorId: string) =>
    client
      .from("cms_comments")
      .delete()
      .eq("id", commentId)
      .eq("content_id", contentId)
      .eq("created_by", authorId)
      .select("id")
      .maybeSingle(),
);

export const setCmsReviewState = withMetrics(
  "cms_content",
  "update",
  async (client: DBClient, contentId: string, state: string) =>
    client
      .from("cms_content")
      .update({ review_state: state })
      .eq("id", contentId)
      .is("deleted_at", null)
      .select("id, review_state")
      .maybeSingle(),
);
