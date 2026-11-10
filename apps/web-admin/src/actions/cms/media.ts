"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cmsTags } from "@repo/cms";
import { reportError } from "@repo/sentry";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import {
  deleteCmsAssetRow,
  insertPendingCmsAsset,
  listCmsAssets,
  markCmsAssetReady,
  selectCmsAsset,
  selectUnreferencedCmsAssets,
  updateCmsAssetAlt,
} from "@repo/supabase/queries/cms/assets";
import { CmsError, parseCmsInput, requireCmsAdmin, toCmsActionError, type CmsActionResult } from "@/lib/cms/action";
import {
  MAX_ALT_LENGTH,
  MAX_CONTENT_IMAGE_BYTES,
  MAX_DIMENSION,
  cmsAssetKey,
  isCmsImageType,
  validateCmsUpload,
  type CmsUploadRequest,
} from "@/lib/cms/media/media";
import { toMediaItem, type CmsMediaItem } from "@/lib/cms/media/media-items";
import { revalidateCms } from "@/lib/cms/publish/revalidate";
import { requireCmsStorage } from "@/lib/cms/media/storage";
import { cmsIdSchema } from "@/schemas/cms";

// Content section: images for posts, guides and author avatars. Upload is
// presign -> browser PUT to R2 -> confirm. The pending row is inserted before
// the URL is handed out, so the rest-api reconciler can clean up an upload
// that never got confirmed.

const PRESIGN_EXPIRY_SECONDS = 300;
const MEDIA_PATH = "/content/media";
const GONE = "That image doesn't exist anymore.";

const PAGE_SIZE = 24;
const UNREADABLE = "Couldn't read that image. Try another file.";

const idSchema = cmsIdSchema(GONE);

// The shape and outer bounds; validateCmsUpload then gives the per-purpose
// size limit and the alt text rule in the admin's words.
const uploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().max(100),
  size: z
    .number()
    .int()
    .min(1, "That file is empty.")
    .max(MAX_CONTENT_IMAGE_BYTES, `That image is too big. The limit is ${MAX_CONTENT_IMAGE_BYTES / (1024 * 1024)} MB.`),
  width: z.number().int().min(1).max(MAX_DIMENSION),
  height: z.number().int().min(1).max(MAX_DIMENSION),
  alt: z.string().max(MAX_ALT_LENGTH * 2, `Keep alt text under ${MAX_ALT_LENGTH} characters.`),
  decorative: z.boolean(),
  purpose: z.enum(["content", "avatar"]),
}) satisfies z.ZodType<CmsUploadRequest>;

const altSchema = z.object({
  id: idSchema,
  alt: z.string().max(MAX_ALT_LENGTH, `Keep alt text under ${MAX_ALT_LENGTH} characters.`),
  decorative: z.boolean(),
});

const listSchema = z.object({
  page: z.number().int().min(1).max(100_000),
  search: z.string().trim().max(200, "Keep the search under 200 characters.").optional(),
});

function storage() {
  try {
    return requireCmsStorage();
  } catch {
    throw new CmsError("Image uploads aren't set up here.");
  }
}

async function unusedIds(): Promise<Set<string>> {
  const { data, error } = await selectUnreferencedCmsAssets(supabaseAdmin);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.id));
}

interface CreateUploadResult extends CmsActionResult {
  upload: { id: string; url: string } | null;
}

export async function createCmsUploadAction(rawRequest: CmsUploadRequest): Promise<CreateUploadResult> {
  try {
    const actor = await requireCmsAdmin();
    const request = parseCmsInput(uploadSchema, rawRequest, UNREADABLE);
    const problem = validateCmsUpload(request);
    if (problem || !isCmsImageType(request.mimeType)) throw new CmsError(problem ?? "Unsupported image type.");
    const r2 = storage();

    const id = randomUUID();
    const key = cmsAssetKey(id, request.fileName, request.mimeType);
    const { error } = await insertPendingCmsAsset(supabaseAdmin, {
      id,
      key,
      mimeType: request.mimeType,
      sizeBytes: request.size,
      width: request.width,
      height: request.height,
      alt: request.decorative ? "" : request.alt.trim(),
      isDecorative: request.decorative,
      createdBy: actor,
    });
    if (error) throw error;

    const url = await r2.presignPut(key, request.mimeType, request.size, PRESIGN_EXPIRY_SECONDS);
    return { error: null, upload: { id, url } };
  } catch (error) {
    return { ...toCmsActionError(error, "create upload", "Couldn't start the upload. Try again?"), upload: null };
  }
}

interface ConfirmUploadResult extends CmsActionResult {
  asset: CmsMediaItem | null;
}

export async function confirmCmsUploadAction(rawId: string): Promise<ConfirmUploadResult> {
  try {
    await requireCmsAdmin();
    const id = parseCmsInput(idSchema, rawId);
    const { data: row, error } = await selectCmsAsset(supabaseAdmin, id);
    if (error) throw error;
    if (!row) throw new CmsError(GONE);
    if (row.status === "ready") return { error: null, asset: toMediaItem(row, true) };

    const r2 = storage();
    const head = await r2.headObject(row.key);
    if (!head) throw new CmsError("The upload didn't arrive. Try again.");
    // The presigned URL signs type and length, so this only trips on a
    // tampered request. Throw the object away rather than keep a surprise.
    if (head.size !== row.size_bytes || head.contentType !== row.mime_type) {
      await r2.deleteObject(row.key).catch((cleanup: unknown) => reportError(cleanup, "cms.discard-upload"));
      await deleteCmsAssetRow(supabaseAdmin, row.id);
      throw new CmsError("The uploaded file didn't match what was announced. Try again.");
    }

    const { data: ready, error: readyError } = await markCmsAssetReady(supabaseAdmin, row.id, head.size);
    if (readyError) throw readyError;
    if (!ready) throw new CmsError(GONE);
    revalidatePath(MEDIA_PATH);
    return { error: null, asset: toMediaItem(ready, true) };
  } catch (error) {
    return { ...toCmsActionError(error, "confirm upload", "Couldn't finish the upload. Try again?"), asset: null };
  }
}

export async function updateCmsAssetAction(
  rawId: string,
  input: { alt: string; decorative: boolean },
): Promise<CmsActionResult> {
  try {
    await requireCmsAdmin();
    const { id, ...parsed } = parseCmsInput(altSchema, { ...input, id: rawId }, "Check the alt text.");
    const alt = parsed.decorative ? "" : parsed.alt.trim();
    if (!parsed.decorative && !alt) throw new CmsError("Add alt text, or mark the image as decorative.");

    const { data, error } = await updateCmsAssetAlt(supabaseAdmin, id, alt, parsed.decorative);
    if (error) throw error;
    if (!data) throw new CmsError(GONE);
    // Avatars are read live. Images inside posts carry the alt text they had
    // when the post was last published, until its next Update.
    await revalidateCms([cmsTags.taxonomy]);
    revalidatePath(MEDIA_PATH);
    return { error: null };
  } catch (error) {
    return toCmsActionError(error, "update asset", "Couldn't save the alt text. Try again?");
  }
}

export async function deleteCmsAssetAction(rawId: string): Promise<CmsActionResult> {
  try {
    await requireCmsAdmin();
    const id = parseCmsInput(idSchema, rawId);
    const { data: row, error } = await selectCmsAsset(supabaseAdmin, id);
    if (error) throw error;
    if (!row) return { error: null };
    if (row.status === "ready" && !(await unusedIds()).has(row.id)) {
      throw new CmsError("This image is still used by a post, an author or an old revision.");
    }

    // Row first, then the object: a failed object delete leaves an orphan
    // the reconciler removes, never a row pointing at nothing.
    const { error: deleteError } = await deleteCmsAssetRow(supabaseAdmin, row.id);
    if (deleteError) throw deleteError;
    await storage()
      .deleteObject(row.key)
      .catch((cleanup: unknown) => reportError(cleanup, "cms.delete-object"));
    revalidatePath(MEDIA_PATH);
    return { error: null };
  } catch (error) {
    return toCmsActionError(error, "delete asset", "Couldn't delete the image. Try again?");
  }
}

interface MediaPageResult extends CmsActionResult {
  items: CmsMediaItem[];
  total: number;
}

/** One page of the library, for the image picker. */
export async function listCmsMediaAction(rawPage: number, rawSearch?: string): Promise<MediaPageResult> {
  try {
    await requireCmsAdmin();
    const { page, search } = parseCmsInput(listSchema, { page: rawPage, search: rawSearch });
    const [{ data, count, error }, unused] = await Promise.all([
      listCmsAssets(supabaseAdmin, { search }, page, PAGE_SIZE),
      unusedIds(),
    ]);
    if (error) throw error;
    return { error: null, items: (data ?? []).map((row) => toMediaItem(row, unused.has(row.id))), total: count ?? 0 };
  } catch (error) {
    return { ...toCmsActionError(error, "list media", "Couldn't load the images. Try again?"), items: [], total: 0 };
  }
}
