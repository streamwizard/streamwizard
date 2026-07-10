import type { Database, Json } from "@repo/supabase";

// clips

export type ClipFolderJunction = Database["public"]["Tables"]["clip_folder_junction"]["Row"];
export type ClipFolder = Database["public"]["Tables"]["clip_folders"]["Row"];
export type TwitchClipTable = Database["public"]["Tables"]["clips"]["Row"];

export type clipsWithFolders = Database["public"]["Tables"]["clips"]["Row"] & {
  folders: ClipFolder[];
};

type RpcClipWithFolders =
  | Database["public"]["Functions"]["get_all_clips_with_folders"]["Returns"][number]
  | Database["public"]["Functions"]["get_clips_by_folder"]["Returns"][number];

function parseClipFoldersJson(folders: Json): ClipFolder[] {
  return Array.isArray(folders) ? (folders as ClipFolder[]) : [];
}

/** RPC clip rows return `folders` as Json — normalize before passing to UI components. */
export function normalizeClipsWithFolders(clips: RpcClipWithFolders[]): clipsWithFolders[] {
  return clips.map((clip) => ({
    ...clip,
    folders: parseClipFoldersJson(clip.folders),
  })) as clipsWithFolders[];
}


// overlays

export type OverlaySceneRow = Database["public"]["Tables"]["overlay_scenes"]["Row"];
export type OverlayItemRow = Database["public"]["Tables"]["overlay_items"]["Row"];
