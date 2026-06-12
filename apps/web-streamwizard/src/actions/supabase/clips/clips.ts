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

interface ClipFolder {
  clipId: string;
  userId: string;
  folderId?: number;
  folderName: string;
}

export async function addClipToFolder({ clipId, userId, folderId, folderName }: ClipFolder) {
  const supabase = await createClient();
  try {
    const result = await _addClipToFolder(supabase, { clipId, userId, folderId, folderName });
    revalidatePath("/dashboard/clips", "layout");
    return result;
  } catch (error) {
    console.error("Error adding clip to Favorites:", error);
    return { success: false, message: error instanceof Error ? error.message : "An unknown error occurred" };
  }
}

export async function removeClipFromFolder(clipId: string, folderId: number, userId: string) {
  const supabase = await createClient();
  try {
    const result = await _removeClipFromFolder(supabase, clipId, folderId, userId);
    revalidatePath("/dashboard/clips", "layout");
    return result;
  } catch (error) {
    console.error("Error removing clip from Favorites:", error);
    return { success: false, message: error instanceof Error ? error.message : "An unknown error occurred" };
  }
}

export async function createClipFolder(folderName: string, user_id: string, parentFolderId?: number) {
  const supabase = await createClient();
  try {
    const data = await _createClipFolder(supabase, folderName, user_id, parentFolderId);
    revalidatePath("/dashboard/clips", "layout");
    return { success: true, message: "Folder created successfully", data };
  } catch (error) {
    console.error("Error creating folder:", error);
    return { success: false, message: error instanceof Error ? error.message : "An unknown error occurred" };
  }
}

export async function editClipFolder(folderId: number, folderName: string, user_id: string) {
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

export async function deleteClipFolder(folderId: number) {
  const supabase = await createClient();
  try {
    await _deleteClipFolder(supabase, folderId);
    revalidatePath("/dashboard/clips", "layout");
    return { success: true, message: "Folder deleted successfully" };
  } catch (error) {
    console.error("Error deleting folder:", error);
    return { success: false, message: error instanceof Error ? error.message : "An unknown error occurred" };
  }
}
