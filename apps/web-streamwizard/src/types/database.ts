import { Database } from "./supabase";


// clips

export type ClipFolderJunction = Database["public"]["Tables"]["clip_folder_junction"]["Row"];
export type ClipFolder = Database["public"]["Tables"]["clip_folders"]["Row"];
export type TwitchClipTable = Database["public"]["Tables"]["clips"]["Row"];


export type clipsWithFolders = Database["public"]["Tables"]["clips"]["Row"] & {
  folders: ClipFolder[];
};


// overlays

export type OverlaySceneRow = Database["public"]["Tables"]["overlay_scenes"]["Row"];
export type OverlayItemRow = Database["public"]["Tables"]["overlay_items"]["Row"];
