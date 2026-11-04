"use server";

import {
  ClipFolderError,
  addClipToFolder as _addClipToFolder,
  removeClipFromFolder as _removeClipFromFolder,
  createClipFolder as _createClipFolder,
  editClipFolder as _editClipFolder,
  deleteClipFolder as _deleteClipFolder,
} from "@repo/supabase/queries/clips";
import { revalidatePath } from "next/cache";
import { tryAuthContext } from "@/lib/auth";
import { toActionError, zodErrorMessage } from "@/lib/action-error";
import { track } from "@/lib/track";
import { idSchema } from "@/schemas/ids";
import {
  addClipToFolderSchema,
  createClipFolderSchema,
  editClipFolderSchema,
  removeClipFromFolderSchema,
} from "@/schemas/clip-folders";
import type { z } from "zod";

const UNAUTHORIZED = { success: false, message: "Unauthorized" } as const;

/** The first issue's message, for the folder dialog to show next to the field. */
function invalid(error: z.ZodError) {
  return { success: false, message: zodErrorMessage(error, "Invalid input") } as const;
}

/** A ClipFolderError says what to fix; anything else is reported and replaced by the fallback. */
function failed(error: unknown, fallback: string) {
  const message = error instanceof ClipFolderError ? error.message : toActionError(error, "actions/clip-folders", fallback);
  return { success: false, message } as const;
}

export async function addClipToFolder(input: z.input<typeof addClipToFolderSchema>) {
  const ctx = await tryAuthContext();
  if (!ctx) return UNAUTHORIZED;
  const parsed = addClipToFolderSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    const result = await _addClipToFolder(ctx.supabase, { ...parsed.data, userId: ctx.user.id });
    if (result.success) await track("clip_added_to_folder", {}, ctx.user);
    revalidatePath("/dashboard", "layout");
    return result;
  } catch (error) {
    return failed(error, "Couldn't add the clip to that folder. Try again?");
  }
}

export async function removeClipFromFolder(clipId: string, folderId: string) {
  const ctx = await tryAuthContext();
  if (!ctx) return UNAUTHORIZED;
  const parsed = removeClipFromFolderSchema.safeParse({ clipId, folderId });
  if (!parsed.success) return invalid(parsed.error);

  try {
    const result = await _removeClipFromFolder(ctx.supabase, parsed.data.clipId, parsed.data.folderId, ctx.user.id);
    if (result.success) await track("clip_removed_from_folder", {}, ctx.user);
    revalidatePath("/dashboard", "layout");
    return result;
  } catch (error) {
    return failed(error, "Couldn't remove the clip from that folder. Try again?");
  }
}

export async function createClipFolder(folderName: string, parentFolderId?: string) {
  const ctx = await tryAuthContext();
  if (!ctx) return UNAUTHORIZED;
  const parsed = createClipFolderSchema.safeParse({ name: folderName, parentFolderId });
  if (!parsed.success) return invalid(parsed.error);

  try {
    const data = await _createClipFolder(ctx.supabase, parsed.data.name, ctx.user.id, parsed.data.parentFolderId);
    await track("clip_folder_created", { is_subfolder: !!parsed.data.parentFolderId }, ctx.user);
    revalidatePath("/dashboard", "layout");
    return { success: true, message: "Folder created successfully", data };
  } catch (error) {
    return failed(error, "Couldn't create the folder. Try again?");
  }
}

export async function editClipFolder(folderId: string, folderName: string) {
  const ctx = await tryAuthContext();
  if (!ctx) return UNAUTHORIZED;
  const parsed = editClipFolderSchema.safeParse({ folderId, name: folderName });
  if (!parsed.success) return invalid(parsed.error);

  try {
    await _editClipFolder(ctx.supabase, parsed.data.folderId, parsed.data.name, ctx.user.id);
    revalidatePath("/dashboard", "layout");
    return { success: true, message: "Folder edited successfully" };
  } catch (error) {
    return failed(error, "Couldn't rename the folder. Try again?");
  }
}

/** The delete query isn't filtered by owner; the clip_folders RLS policy (auth.uid() = user_id) is what scopes it. */
export async function deleteClipFolder(folderId: string) {
  const ctx = await tryAuthContext();
  if (!ctx) return UNAUTHORIZED;
  const parsed = idSchema.safeParse(folderId);
  if (!parsed.success) return { success: false, message: "Folder not found" };

  try {
    await _deleteClipFolder(ctx.supabase, parsed.data);
    await track("clip_folder_deleted", {}, ctx.user);
    revalidatePath("/dashboard", "layout");
    return { success: true, message: "Folder deleted successfully" };
  } catch (error) {
    return failed(error, "Couldn't delete the folder. Try again?");
  }
}
