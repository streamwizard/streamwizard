"use server";

import { createClient } from "@repo/supabase/next/server";
import {
  addClipToFolder as _addClipToFolder,
  removeClipFromFolder as _removeClipFromFolder,
  createClipFolder as _createClipFolder,
  editClipFolder as _editClipFolder,
  deleteClipFolder as _deleteClipFolder,
} from "@repo/supabase/queries/clips";
import { revalidatePath } from "next/cache";
import { track } from "@/lib/track";

interface ClipFolder {
  clipId: string;
  userId: string;
  folderId?: string;
  folderName: string;
}

export async function addClipToFolder({ clipId, userId, folderId, folderName }: ClipFolder) {
  const supabase = await createClient();
  try {
    const result = await _addClipToFolder(supabase, { clipId, userId, folderId, folderName });
    // No user passed on purpose: `userId` came from the browser, and the
    // event must be filed under whoever the session says is signed in.
    if (result.success) await track("clip_added_to_folder", {});
    revalidatePath("/dashboard", "layout");
    return result;
  } catch (error) {
    console.error("Error adding clip to Favorites:", error);
    return { success: false, message: error instanceof Error ? error.message : "An unknown error occurred" };
  }
}

export async function removeClipFromFolder(clipId: string, folderId: string, userId: string) {
  const supabase = await createClient();
  try {
    const result = await _removeClipFromFolder(supabase, clipId, folderId, userId);
    if (result.success) await track("clip_removed_from_folder", {});
    revalidatePath("/dashboard", "layout");
    return result;
  } catch (error) {
    console.error("Error removing clip from Favorites:", error);
    return { success: false, message: error instanceof Error ? error.message : "An unknown error occurred" };
  }
}

export async function createClipFolder(folderName: string, user_id: string, parentFolderId?: string) {
  const supabase = await createClient();
  try {
    const data = await _createClipFolder(supabase, folderName, user_id, parentFolderId);
    await track("clip_folder_created", { is_subfolder: !!parentFolderId });
    revalidatePath("/dashboard/clips", "layout");
    return { success: true, message: "Folder created successfully", data };
  } catch (error) {
    console.error("Error creating folder:", error);
    return { success: false, message: error instanceof Error ? error.message : "An unknown error occurred" };
  }
}

export async function editClipFolder(folderId: string, folderName: string, user_id: string) {
  const supabase = await createClient();
  try {
    await _editClipFolder(supabase, folderId, folderName, user_id);
    revalidatePath("/dashboard/clips", "layout");
    return { success: true, message: "Folder edited successfully" };
  } catch (error) {
    console.error("Error editing folder:", error);
    return { success: false, message: error instanceof Error ? error.message : "An unknown error occurred" };
  }
}

export async function deleteClipFolder(folderId: string) {
  const supabase = await createClient();
  try {
    await _deleteClipFolder(supabase, folderId);
    await track("clip_folder_deleted", {});
    revalidatePath("/dashboard/clips", "layout");
    return { success: true, message: "Folder deleted successfully" };
  } catch (error) {
    console.error("Error deleting folder:", error);
    return { success: false, message: error instanceof Error ? error.message : "An unknown error occurred" };
  }
}
