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
import { CmsError, requireCmsAdmin, toCmsActionError, type CmsActionResult } from "@/lib/cms/action";
import { REVIEW_STATES, type ReviewState } from "@/lib/cms/review";

// Notes admins leave each other on a draft, and where that draft stands.
// Every admin can do all of it: there is no editor/author split, so the only
// check is that the caller is an admin at all.

const uuid = z.string().uuid();
const bodySchema = z.string().trim().min(1, "Write something first.").max(4000, "That comment is too long.");
const anchorSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(80);

export interface CommentView {
  id: string;
  body: string;
  anchor: string | null;
  sectionId: string | null;
  parentId: string | null;
  authorId: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface CommentsResult extends CmsActionResult {
  comments: CommentView[];
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
}): CommentView {
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
    if (!uuid.safeParse(contentId).success) throw new CmsError("That post doesn't exist anymore.");
    const { data, error } = await listCmsComments(supabaseAdmin, contentId);
    if (error) throw error;
    return { error: null, comments: (data ?? []).map(view) };
  } catch (error) {
    return { ...toCmsActionError(error, "list comments", "Couldn't load the comments."), comments: [] };
  }
}

export interface AddCommentInput {
  contentId: string;
  body: string;
  /** The heading it is about, if any. */
  anchor?: string | null;
  sectionId?: string | null;
  /** The comment it replies to. Threads are one level deep. */
  parentId?: string | null;
}

export interface AddCommentResult extends CmsActionResult {
  comment: CommentView | null;
}

export async function addContentCommentAction(input: AddCommentInput): Promise<AddCommentResult> {
  try {
    const actor = await requireCmsAdmin();
    if (!uuid.safeParse(input.contentId).success) throw new CmsError("That post doesn't exist anymore.");

    const body = bodySchema.safeParse(input.body);
    if (!body.success) throw new CmsError(body.error.issues[0]?.message ?? "Write something first.");

    const anchor = input.anchor ? anchorSchema.safeParse(input.anchor) : null;
    if (anchor && !anchor.success) throw new CmsError("That heading no longer exists.");

    let parentId: string | null = null;
    if (input.parentId) {
      if (!uuid.safeParse(input.parentId).success) throw new CmsError("That comment is gone.");
      const { data: parent, error } = await selectCmsCommentParent(supabaseAdmin, input.contentId, input.parentId);
      if (error) throw error;
      if (!parent) throw new CmsError("That comment is gone.");
      // A reply hangs off the comment that started the thread, never off a reply.
      parentId = parent.parent_id ?? parent.id;
    }

    const { data, error } = await insertCmsComment(supabaseAdmin, {
      contentId: input.contentId,
      sectionId: input.sectionId ?? null,
      anchor: anchor?.success ? anchor.data : null,
      parentId,
      body: body.data,
      authorId: actor,
    });
    if (error) throw error;
    return { error: null, comment: view(data) };
  } catch (error) {
    return { ...toCmsActionError(error, "add comment", "Couldn't add the comment."), comment: null };
  }
}

export async function resolveContentCommentAction(
  contentId: string,
  commentId: string,
  resolved: boolean,
): Promise<CmsActionResult> {
  try {
    const actor = await requireCmsAdmin();
    if (!uuid.safeParse(contentId).success || !uuid.safeParse(commentId).success) {
      throw new CmsError("That comment is gone.");
    }
    const { data, error } = await setCmsCommentResolved(supabaseAdmin, contentId, commentId, resolved ? actor : null);
    if (error) throw error;
    if (!data) throw new CmsError("That comment is gone.");
    return { error: null };
  } catch (error) {
    return toCmsActionError(error, "resolve comment", "Couldn't update the comment.");
  }
}

/** Only the admin who wrote it can delete it; anyone else resolves it instead. */
export async function deleteContentCommentAction(contentId: string, commentId: string): Promise<CmsActionResult> {
  try {
    const actor = await requireCmsAdmin();
    if (!uuid.safeParse(contentId).success || !uuid.safeParse(commentId).success) {
      throw new CmsError("That comment is gone.");
    }
    const { data, error } = await deleteCmsComment(supabaseAdmin, contentId, commentId, actor);
    if (error) throw error;
    if (!data) throw new CmsError("Only the admin who wrote a comment can delete it.");
    return { error: null };
  } catch (error) {
    return toCmsActionError(error, "delete comment", "Couldn't delete the comment.");
  }
}

export async function setContentReviewStateAction(contentId: string, state: ReviewState): Promise<CmsActionResult> {
  try {
    await requireCmsAdmin();
    if (!uuid.safeParse(contentId).success) throw new CmsError("That post doesn't exist anymore.");
    if (!REVIEW_STATES.includes(state)) throw new CmsError("That isn't a review state.");
    const { data, error } = await setCmsReviewState(supabaseAdmin, contentId, state);
    if (error) throw error;
    if (!data) throw new CmsError("That post doesn't exist anymore.");
    return { error: null };
  } catch (error) {
    return toCmsActionError(error, "set review state", "Couldn't change the review state.");
  }
}
