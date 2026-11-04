import type { Database } from "@repo/supabase";
import type { ClipFolderRow } from "@/lib/clips/clip-folders";

export type ClipWithFolders = Database["public"]["Tables"]["clips"]["Row"] & {
  folders: ClipFolderRow[];
};
