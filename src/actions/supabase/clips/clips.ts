"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

interface ClipFolder {
  clipId: number;
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
    const { data, error } = await supabase.from("clip_folder_junction").insert({
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


export async function removeClipFromFolder(clipId: number, folderId: number, userId: string) {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase.from("clip_folder_junction").delete().eq("clip_id", clipId).eq("folder_id", folderId).eq("user_id", userId);
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
    return data;
  } catch (error) {
    console.error("Error creating folder:", error);
    return null;
  }
}
