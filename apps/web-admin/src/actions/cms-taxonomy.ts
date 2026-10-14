"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cmsTags, isValidSlug, slugify } from "@repo/cms";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import {
  addCmsTagToContent,
  deleteCmsCategory,
  deleteCmsTag,
  insertCmsCategory,
  insertCmsTag,
  selectCmsTagContentIds,
  updateCmsCategory,
  updateCmsTag,
} from "@repo/supabase/queries/cms/taxonomy";
import { CmsError, isUniqueViolation, requireCmsAdmin, toCmsActionError, type CmsActionResult } from "@/lib/cms/action";
import { revalidateCms } from "@/lib/cms/revalidate";

// Content section: categories and tags. Both are shared by blog posts and
// guides. Renaming one refreshes every public page that shows its name.

const CATEGORIES_PATH = "/content/categories";
const TAGS_PATH = "/content/tags";
const GONE = "That one doesn't exist anymore. Reload the page.";

const idSchema = z.string().uuid();

function requireId(id: string): string {
  if (!idSchema.safeParse(id).success) throw new CmsError(GONE);
  return id;
}

/** A blank slug is made from the name. */
function resolveSlug(slug: string, name: string): string {
  const resolved = slug.trim() || slugify(name);
  if (!isValidSlug(resolved))
    throw new CmsError("Slugs use lowercase letters, numbers and single dashes, like obs-setup.");
  return resolved;
}

const categorySchema = z.object({
  name: z.string().trim().min(1, "Give it a name.").max(80, "Keep the name under 80 characters."),
  slug: z.string().max(80),
  description: z.string().trim().max(300, "Keep the description under 300 characters."),
  position: z.number().int().min(0).max(10_000),
});

export type CategoryInput = z.input<typeof categorySchema>;

export async function saveCategoryAction(id: string | null, input: CategoryInput): Promise<CmsActionResult> {
  try {
    await requireCmsAdmin();
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) throw new CmsError(parsed.error.issues[0]?.message ?? "Check the fields.");
    const row = {
      name: parsed.data.name,
      slug: resolveSlug(parsed.data.slug, parsed.data.name),
      description: parsed.data.description || null,
      position: parsed.data.position,
    };

    const { data, error } = id
      ? await updateCmsCategory(supabaseAdmin, requireId(id), row)
      : await insertCmsCategory(supabaseAdmin, row);
    if (isUniqueViolation(error)) throw new CmsError(`Another category already uses the slug "${row.slug}".`);
    if (error) throw error;
    if (!data) throw new CmsError(GONE);

    await revalidateCms([cmsTags.taxonomy, cmsTags.category(data.id)]);
    revalidatePath(CATEGORIES_PATH);
    return { error: null };
  } catch (error) {
    return toCmsActionError(error, "save category", "Couldn't save the category. Try again?");
  }
}

export async function deleteCategoryAction(id: string): Promise<CmsActionResult> {
  try {
    await requireCmsAdmin();
    const { error } = await deleteCmsCategory(supabaseAdmin, requireId(id));
    if (error) throw error;
    await revalidateCms([cmsTags.taxonomy, cmsTags.category(id), cmsTags.listAll], "immediate");
    revalidatePath(CATEGORIES_PATH);
    return { error: null };
  } catch (error) {
    return toCmsActionError(error, "delete category", "Couldn't delete the category. Try again?");
  }
}

const tagSchema = z.object({
  name: z.string().trim().min(1, "Give it a name.").max(60, "Keep the name under 60 characters."),
  slug: z.string().max(80),
});

export type TagInput = z.input<typeof tagSchema>;

export async function saveTagAction(id: string | null, input: TagInput): Promise<CmsActionResult> {
  try {
    await requireCmsAdmin();
    const parsed = tagSchema.safeParse(input);
    if (!parsed.success) throw new CmsError(parsed.error.issues[0]?.message ?? "Check the fields.");
    const row = { name: parsed.data.name, slug: resolveSlug(parsed.data.slug, parsed.data.name) };

    const { data, error } = id
      ? await updateCmsTag(supabaseAdmin, requireId(id), row)
      : await insertCmsTag(supabaseAdmin, row);
    if (isUniqueViolation(error)) throw new CmsError(`Another tag already uses the slug "${row.slug}".`);
    if (error) throw error;
    if (!data) throw new CmsError(GONE);

    await revalidateCms([cmsTags.taxonomy, cmsTags.tag(data.id)]);
    revalidatePath(TAGS_PATH);
    return { error: null };
  } catch (error) {
    return toCmsActionError(error, "save tag", "Couldn't save the tag. Try again?");
  }
}

export async function deleteTagAction(id: string): Promise<CmsActionResult> {
  try {
    await requireCmsAdmin();
    const { error } = await deleteCmsTag(supabaseAdmin, requireId(id));
    if (error) throw error;
    await revalidateCms([cmsTags.taxonomy, cmsTags.tag(id), cmsTags.listAll], "immediate");
    revalidatePath(TAGS_PATH);
    return { error: null };
  } catch (error) {
    return toCmsActionError(error, "delete tag", "Couldn't delete the tag. Try again?");
  }
}

/**
 * Folds `sourceId` into `targetId`: every post with the source tag gets the
 * target tag, then the source tag is deleted. Not one transaction, but a
 * failure halfway leaves both tags on those posts, never neither.
 */
export async function mergeTagsAction(sourceId: string, targetId: string): Promise<CmsActionResult> {
  try {
    await requireCmsAdmin();
    requireId(sourceId);
    requireId(targetId);
    if (sourceId === targetId) throw new CmsError("Pick a different tag to merge into.");

    const { data: links, error } = await selectCmsTagContentIds(supabaseAdmin, sourceId);
    if (error) throw error;
    const contentIds = (links ?? []).map((link) => link.content_id);
    if (contentIds.length > 0) {
      const { error: addError } = await addCmsTagToContent(supabaseAdmin, targetId, contentIds);
      if (addError) throw addError;
    }
    const { error: deleteError } = await deleteCmsTag(supabaseAdmin, sourceId);
    if (deleteError) throw deleteError;

    await revalidateCms([
      cmsTags.taxonomy,
      cmsTags.tag(sourceId),
      cmsTags.tag(targetId),
      ...contentIds.map(cmsTags.content),
    ]);
    revalidatePath(TAGS_PATH);
    return { error: null };
  } catch (error) {
    return toCmsActionError(error, "merge tags", "Couldn't merge the tags. Try again?");
  }
}
