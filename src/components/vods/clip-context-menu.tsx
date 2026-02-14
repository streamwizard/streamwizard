import { ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger } from "@/components/ui/context-menu";
import { useClipFolders } from "@/providers/clips-provider";
import { Clip } from "@/types/stream-events";
import { FolderMinus, FolderPlus } from "lucide-react";

export function ClipContextMenu({ clip }: { clip: Clip }) {
  const { getAvailableFolders, getRemovableFolders, AddToFolder, handleRemoveClipFromFolder } = useClipFolders();

  const availableFolders = getAvailableFolders(clip.folder_ids || []);
  const removableFolders = getRemovableFolders(clip.folder_ids || []);

  return (
    <>
      <ContextMenuSeparator />
      <ContextMenuSub>
        <ContextMenuSubTrigger>
          <FolderPlus className="h-4 w-4" />
          Add to Folder
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          {availableFolders.length > 0 ? (
            availableFolders.map((folder) => (
              <ContextMenuItem
                key={folder.id}
                onClick={() =>
                  AddToFolder({
                    folderName: folder.name,
                    folderId: folder.id,
                    clipId: clip.twitch_clip_id ?? clip.id?.toString() ?? "",
                  })
                }
              >
                {folder.name}
              </ContextMenuItem>
            ))
          ) : (
            <ContextMenuItem disabled>No folders to add to</ContextMenuItem>
          )}
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSub>
        <ContextMenuSubTrigger>
          <FolderMinus className="h-4 w-4" />
          Remove from Folder
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          {removableFolders.length > 0 ? (
            removableFolders.map((folder) => (
              <ContextMenuItem key={folder.id} onClick={() => handleRemoveClipFromFolder(folder.id, clip.twitch_clip_id ?? clip.id?.toString() ?? "", folder.name)}>
                {folder.name}
              </ContextMenuItem>
            ))
          ) : (
            <ContextMenuItem disabled>No folders to remove from</ContextMenuItem>
          )}
        </ContextMenuSubContent>
      </ContextMenuSub>
    </>
  );
}
