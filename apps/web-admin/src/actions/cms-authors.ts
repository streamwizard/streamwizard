"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cmsTags, isValidSlug, slugify } from "@repo/cms";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { listUsers } from "@repo/supabase/queries/admin-users";
import { insertCmsAuthor, setCmsAuthorDeleted, updateCmsAuthor } from "@repo/supabase/queries/cms/authors";
import { CmsError, isUniqueViolation, requireCmsAdmin, toCmsActionError, type CmsActionResult } from "@/lib/cms/action";
import { MAX_BIO_LENGTH, parseSocialLinks } from "@/lib/cms/authors";
import { revalidateCms } from "@/lib/cms/revalidate";
import { userAvatarUrl, userDisplayName } from "@/lib/users";

// Content section: who wrote what. An author is a public profile, optionally
// linked to a StreamWizard account (the link stays private).

const AUTHORS_PATH = "/content/authors";
const GONE = "That author doesn't exist anymore. Go back to the list.";

const idSchema = z.string().uuid();

function requireId(id: string): string {
  if (!idSchema.safeParse(id).success) throw new CmsError(GONE);
  return id;
}

export interface CreateAuthorResult extends CmsActionResult {
  id: string | null;
}

/** Creates the author with a free slug from the name; details come on its page. */
export async function createAuthorAction(name: string): Promise<CreateAuthorResult> {
  try {
    await requireCmsAdmin();
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 80) throw new CmsError("Give the author a name, up to 80 characters.");
    const base = slugify(trimmed) || "author";

    for (let n = 1; n <= 20; n++) {
      const slug = n === 1 ? base : `${base}-${n}`;
      const { data, error } = await insertCmsAuthor(supabaseAdmin, { name: trimmed, slug });
      if (isUniqueViolation(error)) continue;
      if (error) throw error;
      revalidatePath(AUTHORS_PATH);
      return { error: null, id: data.id };
    }
    throw new CmsError("Couldn't find a free slug for that name. Try a longer name.");
  } catch (error) {
    return { ...toCmsActionError(error, "create author", "Couldn't create the author. Try again?"), id: null };
  }
}

const authorSchema = z.object({
  name: z.string().trim().min(1, "Give the author a name.").max(80, "Keep the name under 80 characters."),
  slug: z.string().trim(),
  roleTitle: z.string().trim().max(80, "Keep the role under 80 characters."),
  bio: z.string().trim().max(MAX_BIO_LENGTH, `Keep the bio under ${MAX_BIO_LENGTH} characters.`),
  avatarAssetId: z.string().uuid().nullable(),
  userId: z.string().uuid().nullable(),
  socialLinks: z.record(z.string(), z.string()),
});

export type AuthorInput = z.input<typeof authorSchema>;

export async function saveAuthorAction(id: string, input: AuthorInput): Promise<CmsActionResult> {
  try {
    await requireCmsAdmin();
    requireId(id);
    const parsed = authorSchema.safeParse(input);
    if (!parsed.success) throw new CmsError(parsed.error.issues[0]?.message ?? "Check the fields.");
    const data = parsed.data;
    if (!isValidSlug(data.slug))
      throw new CmsError("Slugs use lowercase letters, numbers and single dashes, like jochem.");
    const social = parseSocialLinks(data.socialLinks);
    if (social.error) throw new CmsError(social.error);

    const { data: saved, error } = await updateCmsAuthor(supabaseAdmin, id, {
      name: data.name,
      slug: data.slug,
      role_title: data.roleTitle || null,
      bio: data.bio || null,
      avatar_asset_id: data.avatarAssetId,
      user_id: data.userId,
      social_links: social.links,
    });
    if (isUniqueViolation(error)) {
      const detail = typeof error?.message === "string" ? error.message : "";
      throw new CmsError(
        detail.includes("user_id")
          ? "That account is already linked to another author."
          : `Another author already uses the slug "${data.slug}".`,
      );
    }
    if (error) throw error;
    if (!saved) throw new CmsError(GONE);

    await revalidateCms([cmsTags.taxonomy, cmsTags.author(id)]);
    revalidatePath(AUTHORS_PATH, "layout");
    return { error: null };
  } catch (error) {
    return toCmsActionError(error, "save author", "Couldn't save the author. Try again?");
  }
}

/** Soft delete: posts keep the credit, the public author page goes away. */
export async function setAuthorDeletedAction(id: string, deleted: boolean): Promise<CmsActionResult> {
  try {
    await requireCmsAdmin();
    const { data, error } = await setCmsAuthorDeleted(supabaseAdmin, requireId(id), deleted);
    if (isUniqueViolation(error))
      throw new CmsError("Another author took this slug in the meantime. Change theirs or this one first.");
    if (error) throw error;
    if (!data) throw new CmsError(GONE);
    await revalidateCms([cmsTags.taxonomy, cmsTags.author(id)], deleted ? "immediate" : "stale");
    revalidatePath(AUTHORS_PATH, "layout");
    return { error: null };
  } catch (error) {
    return toCmsActionError(error, "delete author", "Couldn't update the author. Try again?");
  }
}

export interface AccountOption {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

/** Accounts to link an author to: name, email, Twitch login or id. */
export async function searchAuthorAccountsAction(
  query: string,
): Promise<{ error: string | null; accounts: AccountOption[] }> {
  try {
    await requireCmsAdmin();
    const search = query.trim();
    if (search.length < 2) return { error: null, accounts: [] };
    const { users } = await listUsers(supabaseAdmin, { search }, 1, 8);
    return {
      error: null,
      accounts: users.map((user) => ({
        id: user.id,
        name: userDisplayName(user),
        email: user.email,
        avatarUrl: userAvatarUrl(user),
      })),
    };
  } catch (error) {
    return { ...toCmsActionError(error, "search accounts", "Couldn't search accounts. Try again?"), accounts: [] };
  }
}
