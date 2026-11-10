import type { Database, Json } from "@repo/supabase";
import type { ClipFolderRow } from "@/lib/clips/clip-folders";
import type { ClipWithFolders } from "@/types/database";

type RpcClipWithFolders =
  | Database["public"]["Functions"]["get_all_clips_with_folders"]["Returns"][number]
  | Database["public"]["Functions"]["get_clips_by_folder"]["Returns"][number];

function parseClipFoldersJson(folders: Json): ClipFolderRow[] {
  return Array.isArray(folders) ? (folders as ClipFolderRow[]) : [];
}

/** RPC clip rows return `folders` as Json — normalize before passing to UI components. */
export function normalizeClipsWithFolders(clips: RpcClipWithFolders[]): ClipWithFolders[] {
  return clips.map((clip) => ({
    ...clip,
    folders: parseClipFoldersJson(clip.folders),
  })) as ClipWithFolders[];
}
