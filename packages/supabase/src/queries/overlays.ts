import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;
type OverlaySceneInsert = Database["public"]["Tables"]["overlay_scenes"]["Insert"];
type OverlaySceneUpdate = Database["public"]["Tables"]["overlay_scenes"]["Update"];

export async function getOverlayScenes(client: DBClient, userId: string) {
  return client.from("overlay_scenes").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
}

export async function getOverlayScene(client: DBClient, id: string, userId: string) {
  const { data: scene, error: sceneError } = await client
    .from("overlay_scenes")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (sceneError) return { scene: null, items: null, error: sceneError };

  const { data: items, error: itemsError } = await client
    .from("overlay_items")
    .select("*")
    .eq("scene_id", id)
    .order("z_index", { ascending: true });

  if (itemsError) return { scene: null, items: null, error: itemsError };
  return { scene, items: items ?? [], error: null };
}

export async function getOverlaySceneBySlug(client: DBClient, slug: string) {
  const { data: scene, error: sceneError } = await client
    .from("overlay_scenes")
    .select("*")
    .eq("slug", slug)
    .single();

  if (sceneError) return { scene: null, items: null, error: sceneError };

  const { data: items, error: itemsError } = await client
    .from("overlay_items")
    .select("*")
    .eq("scene_id", scene.id)
    .order("z_index", { ascending: true });

  if (itemsError) return { scene: null, items: null, error: itemsError };
  return { scene, items: items ?? [], error: null };
}

export async function createOverlayScene(client: DBClient, payload: OverlaySceneInsert) {
  return client.from("overlay_scenes").insert(payload).select().single();
}

export async function updateOverlayScene(client: DBClient, id: string, userId: string, updates: OverlaySceneUpdate) {
  return client.from("overlay_scenes").update(updates).eq("id", id).eq("user_id", userId).select().single();
}

export async function deleteOverlayScene(client: DBClient, id: string, userId: string) {
  return client.from("overlay_scenes").delete().eq("id", id).eq("user_id", userId);
}

export async function deleteOverlayItem(client: DBClient, id: string) {
  return client.from("overlay_items").delete().eq("id", id);
}

export async function getOverlayItems(client: DBClient, sceneId: string) {
  return client.from("overlay_items").select("id").eq("scene_id", sceneId);
}
