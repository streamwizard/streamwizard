import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

interface ClipFolder {
  clipId: string;
  userId: string;
  folderId?: number;
  folderName: string;
}

export async function addClipToFolder(client: DBClient, { clipId, userId, folderId, folderName }: ClipFolder) {
  if (!folderId && folderName) {
    const { data, error } = await client
      .from("clip_folders")
      .insert({ user_id: userId, name: folderName, href: encodeURIComponent(folderName) })
      .select();

    if (error) throw error;
    folderId = data[0].id;
  }

  const { error } = await client.from("clip_folder_junction").insert({
    clip_id: clipId,
    folder_id: folderId,
    user_id: userId,
  });

  if (error) throw error;
  return { success: true, message: `Clip added to ${folderName}` };
}

export async function removeClipFromFolder(client: DBClient, clipId: string, folderId: number, userId: string) {
  const { error } = await client
    .from("clip_folder_junction")
    .delete()
    .eq("clip_id", clipId)
    .eq("folder_id", folderId)
    .eq("user_id", userId);

  if (error) throw error;
  return { success: true, message: "Clip removed from folder" };
}

export async function createClipFolder(client: DBClient, folderName: string, userId: string, parentFolderId?: number) {
  const { data, error } = await client
    .from("clip_folders")
    .insert({ name: folderName, parent_folder_id: parentFolderId, user_id: userId, href: encodeURIComponent(folderName) })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function editClipFolder(client: DBClient, folderId: number, folderName: string, userId: string) {
  const { error } = await client
    .from("clip_folders")
    .update({ name: folderName, href: encodeURIComponent(folderName) })
    .eq("id", folderId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function deleteClipFolder(client: DBClient, folderId: number) {
  const { error } = await client.from("clip_folders").delete().eq("id", folderId);
  if (error) throw error;
}

export async function getClipBroadcasterId(client: DBClient, clipId: string, userId: string): Promise<string | null> {
  const { data: ownedRows } = await client
    .from("clips")
    .select("broadcaster_id")
    .eq("twitch_clip_id", clipId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (ownedRows?.[0]?.broadcaster_id) return ownedRows[0].broadcaster_id;

  const { data: anyRows } = await client
    .from("clips")
    .select("broadcaster_id")
    .eq("twitch_clip_id", clipId)
    .order("created_at", { ascending: false })
    .limit(1);

  return anyRows?.[0]?.broadcaster_id ?? null;
}
