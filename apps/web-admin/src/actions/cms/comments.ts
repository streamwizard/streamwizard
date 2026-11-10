"use server";

import { z } from "zod";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import {
  deleteCmsComment,
  insertCmsComment,
  listCmsComments,
  selectCmsCommentParent,
  setCmsCommentResolved,
  setCmsReviewState,
} from "@repo/supabase/queries/cms/comments";
import { CmsError, parseCmsInput, requireCmsAdmin, toCmsActionError, type CmsActionResult } from "@/lib/cms/action";
import { REVIEW_STATES, type ReviewState } from "@/lib/cms/review";
import { cmsIdSchema } from "@/schemas/cms";
import type { CmsCommentView } from "@/types/cms";

// Notes admins leave each other on a draft, and where that draft stands.
// Every admin can do all of it: there is no editor/author split, so the only
// check is that the caller is an admin at all.

const POST_GONE = "That post doesn't exist anymore.";
const COMMENT_GONE = "That comment is gone.";

const contentIdSchema = cmsIdSchema(POST_GONE);
const commentIdSchema = cmsIdSchema(COMMENT_GONE);

/** The editor sends "" for "none" in places; treat it like null. */
function blankAsNull<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (value === "" ? null : value), schema);
}

const addCommentSchema = z.object({
  contentId: contentIdSchema,
  body: z.string().trim().min(1, "Write something first.").max(4000, "That comment is too long."),
  /** The heading it is about, if any. */
  anchor: blankAsNull(
    z
      .string()
      .max(80, "That heading no longer exists.")
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "That heading no longer exists.")
      .nullish(),
  ),
  sectionId: blankAsNull(cmsIdSchema("That section no longer exists.").nullish()),
  /** The comment it replies to. Threads are one level deep. */
  parentId: blankAsNull(commentIdSchema.nullish()),
});

type AddCommentInput = z.input<typeof addCommentSchema>;

const commentRefSchema = z.object({ contentId: commentIdSchema, commentId: commentIdSchema });
const resolveSchema = commentRefSchema.extend({ resolved: z.boolean() });
const reviewStateSchema = z.object({
  contentId: contentIdSchema,
  state: z.enum(REVIEW_STATES, "That isn't a review state."),
});

interface CommentsResult extends CmsActionResult {
  comments: CmsCommentView[];
}

interface AddCommentResult extends CmsActionResult {
  comment: CmsCommentView | null;
}

function view(row: {
  id: string;
  body: string;
  anchor: string | null;
  section_id: string | null;
  parent_id: string | null;
  created_by: string | null;
  created_at: string;
  resolved_at: string | null;
}): CmsCommentView {
  return {
    id: row.id,
    body: row.body,
    anchor: row.anchor,
    sectionId: row.section_id,
    parentId: row.parent_id,
    authorId: row.created_by,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export async function listContentCommentsAction(contentId: string): Promise<CommentsResult> {
  try {
    await requireCmsAdmin();
    const id = parseCmsInput(contentIdSchema, contentId);
    const { data, error } = await listCmsComments(supabaseAdmin, id);
    if (error) throw error;
    return { error: null, comments: (data ?? []).map(view) };
  } catch (error) {
    return { ...toCmsActionError(error, "list comments", "Couldn't load the comments."), comments: [] };
  }
}

export async function addContentCommentAction(rawInput: AddCommentInput): Promise<AddCommentResult> {
  try {
    const actor = await requireCmsAdmin();
    const input = parseCmsInput(addCommentSchema, rawInput);

    let parentId: string | null = null;
    if (input.parentId) {
      const { data: parent, error } = await selectCmsCommentParent(supabaseAdmin, input.contentId, input.parentId);
      if (error) throw error;
      if (!parent) throw new CmsError(COMMENT_GONE);
      // A reply hangs off the comment that started the thread, never off a reply.
      parentId = parent.parent_id ?? parent.id;
    }

    const { data, error } = await insertCmsComment(supabaseAdmin, {
      contentId: input.contentId,
      sectionId: input.sectionId ?? null,
      anchor: input.anchor ?? null,
      parentId,
      body: input.body,
      authorId: actor,
    });
    if (error) throw error;
    return { error: null, comment: view(data) };
  } catch (error) {
    return { ...toCmsActionError(error, "add comment", "Couldn't add the comment."), comment: null };
  }
}

export async function resolveContentCommentAction(
  rawContentId: string,
  rawCommentId: string,
  rawResolved: boolean,
): Promise<CmsActionResult> {
  try {
    const actor = await requireCmsAdmin();
    const { contentId, commentId, resolved } = parseCmsInput(resolveSchema, {
      contentId: rawContentId,
      commentId: rawCommentId,
      resolved: rawResolved,
    });
    const { data, error } = await setCmsCommentResolved(supabaseAdmin, contentId, commentId, resolved ? actor : null);
    if (error) throw error;
    if (!data) throw new CmsError(COMMENT_GONE);
    return { error: null };
  } catch (error) {
    return toCmsActionError(error, "resolve comment", "Couldn't update the comment.");
  }
}

/** Only the admin who wrote it can delete it; anyone else resolves it instead. */
export async function deleteContentCommentAction(rawContentId: string, rawCommentId: string): Promise<CmsActionResult> {
  try {
    const actor = await requireCmsAdmin();
    const { contentId, commentId } = parseCmsInput(commentRefSchema, {
      contentId: rawContentId,
      commentId: rawCommentId,
    });
    const { data, error } = await deleteCmsComment(supabaseAdmin, contentId, commentId, actor);
    if (error) throw error;
    if (!data) throw new CmsError("Only the admin who wrote a comment can delete it.");
    return { error: null };
  } catch (error) {
    return toCmsActionError(error, "delete comment", "Couldn't delete the comment.");
  }
}

export async function setContentReviewStateAction(rawContentId: string, rawState: ReviewState): Promise<CmsActionResult> {
  try {
    await requireCmsAdmin();
    const { contentId, state } = parseCmsInput(reviewStateSchema, { contentId: rawContentId, state: rawState });
    const { data, error } = await setCmsReviewState(supabaseAdmin, contentId, state);
    if (error) throw error;
    if (!data) throw new CmsError(POST_GONE);
    return { error: null };
  } catch (error) {
    return toCmsActionError(error, "set review state", "Couldn't change the review state.");
  }
}
