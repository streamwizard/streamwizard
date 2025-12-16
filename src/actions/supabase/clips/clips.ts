"use server";

import { createClient } from "@/lib/supabase/server";
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
    if (!folderId && folderName) {
      const { data, error } = await supabase
        .from("clip_folders")
        .insert({
          user_id: userId,
          name: folderName,
          href: encodeURIComponent(folderName),
        })
        .select();

      if (error) throw error;

      folderId = data[0].id;
    }

    // Add clip to the folder
    const { error } = await supabase.from("clip_folder_junction").insert({
      clip_id: clipId,
      folder_id: folderId,
      user_id: userId,
    });

    if (error) throw error;
    revalidatePath("/dashboard/clips", "layout");
    return { success: true, message: `Clip added to ${folderName}` };
  } catch (error) {
    console.error("Error adding clip to Favorites:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
}

export async function removeClipFromFolder(clipId: string, folderId: number, userId: string) {
  const supabase = await createClient();
  try {
    const { error } = await supabase.from("clip_folder_junction").delete().eq("clip_id", clipId).eq("folder_id", folderId).eq("user_id", userId);
    if (error) throw error;
    revalidatePath("/dashboard/clips", "layout");
    return { success: true, message: "Clip removed from folder" };
  } catch (error) {
    console.error("Error removing clip from Favorites:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
}

// create a new folder for clips
export async function createClipFolder(folderName: string, user_id: string, parentFolderId?: number) {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("clip_folders")
      .insert({
        name: folderName,
        parent_folder_id: parentFolderId,
        user_id: user_id,
        href: encodeURIComponent(folderName),
      })
      .select()
      .single();

    if (error) throw error;
    revalidatePath("/dashboard/clips", "layout");
    return data;
  } catch (error) {
    console.error("Error creating folder:", error);
    return null;
  }
}

// edit a folder for clips
export async function editClipFolder(folderId: number, folderName: string, user_id: string) {
  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from("clip_folders")
      .update({ name: folderName, href: encodeURIComponent(folderName) })
      .eq("id", folderId)
      .eq("user_id", user_id)
      .select();
    if (error) throw error;

    revalidatePath("/dashboard/clips", "layout");

    return {
      success: true,
      message: "Folder edited successfully",
    };
  } catch (error) {
    console.error("Error editing folder:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
}

// delete a folder for clips
export async function deleteClipFolder(folderId: number) {
  const supabase = await createClient();
  try {
    const { error } = await supabase.from("clip_folders").delete().eq("id", folderId);
    if (error) throw error;
    revalidatePath("/dashboard/clips", "layout");
    return {
      success: true,
      message: "Folder deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting folder:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
}
