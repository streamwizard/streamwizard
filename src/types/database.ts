import { Database } from "./supabase";


// clips

export type ClipFolderJunction = Database["public"]["Tables"]["clip_folder_junction"]["Row"];
export type ClipFolder = Database["public"]["Tables"]["clip_folders"]["Row"];
export type TwitchClipTable = Database["public"]["Tables"]["clips"]["Row"];


export type clipsWithFolders = Database["public"]["Tables"]["clips"]["Row"] & {
  folders: ClipFolder[];
};
