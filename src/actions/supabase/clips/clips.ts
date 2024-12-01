"use server";

import { createClient } from "@/lib/supabase/server";

interface ClipFolder {
  clipId: number;
  user_id: string;
}

export async function addClipToFavoritesFolder({ clipId, user_id }: ClipFolder) {
  const supabase = await createClient();

  try {
    // First, find or create the Favorites folder
    const { data: favoritesFolder, error: folderError } = await supabase
      .from("clip_folders")
      .select("id")
      .eq("name", "Favorites")
      .eq("user_id", user_id)
      .single();

    let folderId: number;

    if (folderError || !favoritesFolder) {
      // Create Favorites folder if it doesn't exist
      const { data: newFolder, error: createError } = await supabase
        .from("clip_folders")
        .insert({
          name: "Favorites",
          user_id: user_id,
        })
        .select()
        .single();

      if (createError) throw createError;
      folderId = newFolder.id;
    } else {
      folderId = favoritesFolder.id;
    }

    // Add clip to the Favorites folder
    const { data, error } = await supabase.from("clip_folder_junction").insert({
      clip_id: clipId,
      folder_id: folderId,
      user_id: user_id,
    });

    if (error) throw error;

    return { success: true, message: "Clip added to Favorites" };
  } catch (error) {
    console.error("Error adding clip to Favorites:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
}


// Fetch all user's folders
export async function fetchFolders() {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from('clip_folders')
      .select(`
        id,
        name,
        parent_folder_id,
        created_at
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching folders:', error);
    return [];
  }
}

// Fetch clips inside a specific folder
export async function fetchClipsInFolder(folderId: number) {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from('clip_folder_junction')
      .select(`
        clips:clip_id (
          id,
          title,
          content,
          created_at
        )
      `)
      .eq('folder_id', folderId);

    if (error) throw error;

    // Transform the result to extract just the clips
    return data?.map(junction => junction.clips) || [];
  } catch (error) {
    console.error('Error fetching clips in folder:', error);
    return [];
  }
}

// Fetch folders with their clip count
export async function fetchFoldersWithClipCount() {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from('clip_folders')
      .select(`
        id,
        name,
        created_at,
        clips_count:clip_folder_junction(count)
      `);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching folders with clip count:', error);
    return [];
  }
}

// Fetch a folder with all its clips in one query
export async function fetchFolderWithClips(folderId: number) {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from('clip_folders')
      .select(`
        id,
        name,
        created_at,
        clips:clip_folder_junction(
          clips:clip_id (
            id,
            title,
            content,
            created_at
          )
        )
      `)
      .eq('id', folderId)
      .single();

    if (error) throw error;

    // Transform the result to extract just the clips
    return {
      ...data,
      clips: data.clips.map(junction => junction.clips)
    };
  } catch (error) {
    console.error('Error fetching folder with clips:', error);
    return null;
  }
}