"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseFootprint, tagsForChange } from "@repo/cms";
import type { Json } from "@repo/supabase/types/supabase";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { logPlatformEvent } from "@repo/supabase/queries/platform-events";
import {
  getCmsContentSummary,
  insertCmsContent,
  restoreCmsRevision,
  saveCmsDraft,
  selectCmsAuthorForUser,
  trashCmsContent,
  untrashCmsContent,
} from "@repo/supabase/queries/cms/content";
import { CmsError, requireCmsAdmin, toCmsActionError, type CmsActionResult } from "@/lib/cms/action";
import { classifyContentError } from "@/lib/cms/content-errors";
import {
  canonicalProblem,
  deriveDraft,
  draftSchema,
  emptyDraft,
  type ContentDraft,
  type ContentType,
} from "@/lib/cms/draft";
import { findTemplate } from "@/lib/cms/templates";
import { revalidateCms } from "@/lib/cms/revalidate";
import { actorIdentity } from "@/lib/platform-events";

// Content section: blog posts and guides, the working copy. Nothing here
// changes the live site except the trash (it takes a live post down).
// Publishing lives in its own actions.

const CONTENT_PATH = "/content";
const GONE = "That post doesn't exist anymore, or it's in the trash.";

const idSchema = z.string().uuid();

function requireId(id: string): string {
  if (!idSchema.safeParse(id).success) throw new CmsError(GONE);
  return id;
}

export interface CreateContentResult extends CmsActionResult {
  id: string | null;
}

/**
 * A fresh draft, optionally from a template. The admin's own author profile
 * is credited when they have one.
 */
export async function createContentAction(type: ContentType, templateId?: string): Promise<CreateContentResult> {
  try {
    const actor = await requireCmsAdmin();
    if (type !== "blog" && type !== "guide") throw new CmsError("Pick blog post or guide.");
    // Unique until the title gives it a real one.
    const slug = `untitled-${randomUUID().slice(0, 8)}`;
    const { data, error } = await insertCmsContent(supabaseAdmin, { type, slug, createdBy: actor });
    if (error) throw error;

    const { data: author } = await selectCmsAuthorForUser(supabaseAdmin, actor);
    const template = findTemplate(type, templateId);
    if (author || template) {
      // Through deriveDraft like any other save, so a template's content is
      // cleaned, counted and anchored the same way typed content is.
      const content = template?.build();
      const derived = content
        ? deriveDraft(type, {
            ...emptyDraft(),
            summary: content.summary,
            body: content.body,
            prerequisites: content.prerequisites,
            sections: content.sections.map((section) => ({
              id: randomUUID(),
              title: section.title,
              anchor: null,
              body: section.body,
            })),
          })
        : null;
      await saveCmsDraft(supabaseAdmin, {
        contentId: data.id,
        actorId: actor,
        expectedLockVersion: 0,
        fields: derived ? (derived.fields as Record<string, Json>) : {},
        sections: derived && type === "guide" ? (derived.sections as unknown as Json) : null,
        authorIds: author ? [author.id] : null,
        categoryIds: null,
        tagIds: null,
        relatedIds: null,
        revision: "none",
      });
    }
    revalidatePath(CONTENT_PATH);
    return { error: null, id: data.id };
  } catch (error) {
    return { ...toCmsActionError(error, "create content", "Couldn't create the draft. Try again?"), id: null };
  }
}

export interface SaveDraftResult extends CmsActionResult {
  /** Someone else saved since this editor loaded it. Nothing was written. */
  conflict: boolean;
  lockVersion: number | null;
  savedAt: string | null;
  /** Blocks or links the cleaner had to drop. */
  removed: number;
}

/**
 * Saves the whole draft in one transaction. `kind`: autosave (a revision at
 * most every 10 minutes) or manual ("Save version", always a revision).
 */
export async function saveContentDraftAction(
  id: string,
  type: ContentType,
  lockVersion: number,
  draft: ContentDraft,
  kind: "autosave" | "manual",
): Promise<SaveDraftResult> {
  const failed = (result: CmsActionResult, conflict = false): SaveDraftResult => ({
    ...result,
    conflict,
    lockVersion: null,
    savedAt: null,
    removed: 0,
  });
  try {
    const actor = await requireCmsAdmin();
    requireId(id);
    const parsed = draftSchema.safeParse(draft);
    if (!parsed.success)
      throw new CmsError(parsed.error.issues[0]?.message ?? "Something in the draft doesn't fit. Check the fields.");
    const canonical = canonicalProblem(draft.canonicalUrl);
    if (canonical) throw new CmsError(canonical);

    const derived = deriveDraft(type, parsed.data as ContentDraft);
    const { data, error } = await saveCmsDraft(supabaseAdmin, {
      contentId: id,
      actorId: actor,
      expectedLockVersion: lockVersion,
      fields: derived.fields as Record<string, Json>,
      sections: (derived.sections as unknown as Json) ?? null,
      authorIds: parsed.data.authorIds,
      categoryIds: parsed.data.categoryIds,
      tagIds: parsed.data.tagIds,
      relatedIds: parsed.data.relatedIds,
      revision: kind,
    });
    if (error) {
      const failure = classifyContentError(error);
      if (failure.kind === "conflict")
        return failed({ error: "Someone else saved this post. Reload to get their changes." }, true);
      if (failure.kind === "not_found") throw new CmsError(GONE);
      if (failure.kind === "message") throw new CmsError(failure.message);
      throw error;
    }
    const result = data as { lock_version: number; updated_at: string };
    return {
      error: null,
      conflict: false,
      lockVersion: result.lock_version,
      savedAt: result.updated_at,
      removed: derived.removed.reduce((count, entry) => count + entry.issues.length, 0),
    };
  } catch (error) {
    return failed(toCmsActionError(error, "save draft", "Couldn't save. Your changes are still here, try again?"));
  }
}

export async function restoreRevisionAction(
  id: string,
  lockVersion: number,
  revisionId: string,
): Promise<CmsActionResult> {
  try {
    const actor = await requireCmsAdmin();
    requireId(id);
    if (!idSchema.safeParse(revisionId).success) throw new CmsError("That revision doesn't exist anymore.");
    const { error } = await restoreCmsRevision(supabaseAdmin, id, actor, lockVersion, revisionId);
    if (error) {
      const failure = classifyContentError(error);
      if (failure.kind === "conflict")
        throw new CmsError("The post changed since you opened this page. Reload and try again.");
      if (failure.kind === "not_found") throw new CmsError("That revision doesn't exist anymore.");
      if (failure.kind === "message") throw new CmsError(failure.message);
      throw error;
    }
    revalidatePath(`${CONTENT_PATH}/${id}`, "layout");
    return { error: null };
  } catch (error) {
    return toCmsActionError(error, "restore revision", "Couldn't restore that revision. Try again?");
  }
}

/** Into the trash. A live post comes off the site right away. */
export async function trashContentAction(id: string, lockVersion: number | null): Promise<CmsActionResult> {
  try {
    const actor = await requireCmsAdmin();
    const { data: summary } = await getCmsContentSummary(supabaseAdmin, requireId(id));
    const { data, error } = await trashCmsContent(supabaseAdmin, id, actor, lockVersion);
    if (error) {
      const failure = classifyContentError(error);
      if (failure.kind === "conflict")
        throw new CmsError("The post changed since you opened it. Reload and try again.");
      if (failure.kind === "not_found") return { error: null };
      throw error;
    }
    const before = parseFootprint((data as { before?: unknown } | null)?.before);
    await revalidateCms(tagsForChange(before, null), "immediate");
    if (summary) {
      await logPlatformEvent(
        supabaseAdmin,
        {
          type: "content.trashed",
          actorUserId: actor,
          payload: {
            content_id: id,
            content_type: summary.type === "guide" ? "guide" : "blog",
            title: summary.title,
            slug: summary.slug,
            was_public: before !== null,
            ...(await actorIdentity(actor)),
          },
        },
        "web-admin cms: trash",
      );
    }
    revalidatePath(CONTENT_PATH, "layout");
    return { error: null };
  } catch (error) {
    return toCmsActionError(error, "trash content", "Couldn't move it to the trash. Try again?");
  }
}

/** Back from the trash, as a draft. */
export async function untrashContentAction(id: string): Promise<CmsActionResult> {
  try {
    await requireCmsAdmin();
    const { error } = await untrashCmsContent(supabaseAdmin, requireId(id));
    if (error) {
      const failure = classifyContentError(error);
      if (failure.kind === "message")
        throw new CmsError(`${failure.message} Another post took its slug while it was in the trash.`);
      throw error;
    }
    revalidatePath(CONTENT_PATH, "layout");
    return { error: null };
  } catch (error) {
    return toCmsActionError(error, "untrash content", "Couldn't restore it. Try again?");
  }
}
