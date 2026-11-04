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
import {
  CmsError,
  isUniqueViolation,
  parseCmsInput,
  requireCmsAdmin,
  toCmsActionError,
  type CmsActionResult,
} from "@/lib/cms/action";
import { revalidateCms } from "@/lib/cms/publish/revalidate";
import { cmsIdSchema } from "@/schemas/cms";

// Content section: categories and tags. Both are shared by blog posts and
// guides. Renaming one refreshes every public page that shows its name.

const CATEGORIES_PATH = "/content/categories";
const TAGS_PATH = "/content/tags";
const GONE = "That one doesn't exist anymore. Reload the page.";

const idSchema = cmsIdSchema(GONE);

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

type CategoryInput = z.input<typeof categorySchema>;

export async function saveCategoryAction(rawId: string | null, input: CategoryInput): Promise<CmsActionResult> {
  try {
    await requireCmsAdmin();
    const id = parseCmsInput(idSchema.nullable(), rawId);
    const parsed = parseCmsInput(categorySchema, input, "Check the fields.");
    const row = {
      name: parsed.name,
      slug: resolveSlug(parsed.slug, parsed.name),
      description: parsed.description || null,
      position: parsed.position,
    };

    const { data, error } = id
      ? await updateCmsCategory(supabaseAdmin, id, row)
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

export async function deleteCategoryAction(rawId: string): Promise<CmsActionResult> {
  try {
    await requireCmsAdmin();
    const id = parseCmsInput(idSchema, rawId);
    const { error } = await deleteCmsCategory(supabaseAdmin, id);
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

type TagInput = z.input<typeof tagSchema>;

const mergeSchema = z
  .object({ sourceId: idSchema, targetId: idSchema })
  .refine(({ sourceId, targetId }) => sourceId !== targetId, "Pick a different tag to merge into.");

export async function saveTagAction(rawId: string | null, input: TagInput): Promise<CmsActionResult> {
  try {
    await requireCmsAdmin();
    const id = parseCmsInput(idSchema.nullable(), rawId);
    const parsed = parseCmsInput(tagSchema, input, "Check the fields.");
    const row = { name: parsed.name, slug: resolveSlug(parsed.slug, parsed.name) };

    const { data, error } = id
      ? await updateCmsTag(supabaseAdmin, id, row)
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

interface CreateTagResult extends CmsActionResult {
  tag: { id: string; name: string } | null;
}

/** From the post editor's tag picker: a new tag by name, slug made from it. */
export async function createTagAction(name: string): Promise<CreateTagResult> {
  try {
    await requireCmsAdmin();
    const parsed = parseCmsInput(tagSchema, { name, slug: "" }, "Check the name.");
    const row = { name: parsed.name, slug: resolveSlug("", parsed.name) };
    const { data, error } = await insertCmsTag(supabaseAdmin, row);
    if (isUniqueViolation(error))
      throw new CmsError(`A tag with the slug "${row.slug}" already exists. Pick it from the list.`);
    if (error) throw error;
    revalidatePath(TAGS_PATH);
    return { error: null, tag: { id: data.id, name: row.name } };
  } catch (error) {
    return { ...toCmsActionError(error, "create tag", "Couldn't add the tag. Try again?"), tag: null };
  }
}

export async function deleteTagAction(rawId: string): Promise<CmsActionResult> {
  try {
    await requireCmsAdmin();
    const id = parseCmsInput(idSchema, rawId);
    const { error } = await deleteCmsTag(supabaseAdmin, id);
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
export async function mergeTagsAction(rawSourceId: string, rawTargetId: string): Promise<CmsActionResult> {
  try {
    await requireCmsAdmin();
    const { sourceId, targetId } = parseCmsInput(mergeSchema, { sourceId: rawSourceId, targetId: rawTargetId });

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
