"use client";

import { useClipFolders } from "@/providers/clips-provider";
import {
  buildClipFolderTree,
  getFolderBreadcrumb,
  type ClipFolderNode,
} from "@/lib/utils/clip-folders";
import { clipsWithFolders } from "@/types/database";
import { cn } from "@/lib/utils";
import { Button, Popover, PopoverContent, PopoverTrigger, ScrollArea } from "@repo/ui";
import { ChevronRight, Folder, FolderOpen, FolderPlus, X } from "lucide-react";
import { useMemo, useState } from "react";

type ClipModalFolderSectionProps = {
  clip: clipsWithFolders;
};

function FolderPickerItem({
  folder,
  depth,
  onSelect,
}: {
  folder: ClipFolderNode;
  depth: number;
  onSelect: (folderId: number) => void;
}) {
  const hasChildren = folder.children.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => onSelect(folder.id)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
          depth > 0 && "text-[13px]"
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
          {hasChildren ? <ChevronRight className="size-3 opacity-40" /> : null}
        </span>
        <Folder className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-medium">{folder.name}</span>
      </button>
      {hasChildren
        ? folder.children.map((child) => (
            <FolderPickerItem key={child.id} folder={child} depth={depth + 1} onSelect={onSelect} />
          ))
        : null}
    </>
  );
}

function AssignedFolderChip({
  folderId,
  folders,
  onRemove,
}: {
  folderId: number;
  folders: ReturnType<typeof useClipFolders>["folders"];
  onRemove: () => void;
}) {
  const folder = folders.find((item) => item.id === folderId);
  if (!folder) return null;

  const breadcrumb = getFolderBreadcrumb(folder, folders);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
      <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-sm">
        {breadcrumb.map((item, index) => (
          <span key={item.id} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="size-3 text-muted-foreground/60" />}
            <span className={cn(index === breadcrumb.length - 1 ? "font-medium" : "text-muted-foreground")}>
              {item.name}
            </span>
          </span>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
        onPointerDown={(event) => event.stopPropagation()}
        aria-label="Remove from folder"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}

function RemoveFolderConfirm({
  folderLabel,
  onCancel,
  onConfirm,
}: {
  folderLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-3">
      <p className="text-sm font-medium">Remove clip from folder?</p>
      <p className="mt-1 text-sm text-muted-foreground">
        This will remove the clip from <span className="font-medium text-foreground">{folderLabel}</span>. Are you
        sure?
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            onCancel();
          }}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            onConfirm();
          }}
        >
          Remove from folder
        </Button>
      </div>
    </div>
  );
}

export function ClipModalFolderSection({ clip }: ClipModalFolderSectionProps) {
  const { folders, getAvailableFolders, getFolderLabel, AddToFolder, handleRemoveClipFromFolder } =
    useClipFolders();
  const [assignedFolderIds, setAssignedFolderIds] = useState<number[]>(
    clip.folders.map((folder: { id: number }) => folder.id)
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [folderToRemove, setFolderToRemove] = useState<number | null>(null);

  const availableFolders = useMemo(
    () => getAvailableFolders(assignedFolderIds),
    [assignedFolderIds, getAvailableFolders]
  );
  const availableTree = useMemo(() => buildClipFolderTree(availableFolders), [availableFolders]);

  const addToFolder = (folderId: number) => {
    const label = getFolderLabel(folderId);
    if (!label) return;

    AddToFolder({
      folderId,
      folderName: label,
      clipId: clip.twitch_clip_id,
    });
    setAssignedFolderIds((current) => [...current, folderId]);
    setPickerOpen(false);
  };

  const removeFromFolder = (folderId: number) => {
    const label = getFolderLabel(folderId);
    handleRemoveClipFromFolder(folderId, clip.twitch_clip_id, label);
    setAssignedFolderIds((current) => current.filter((id) => id !== folderId));
    setFolderToRemove(null);
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-col rounded-lg border border-border bg-card/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Folder className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Folders</h3>
      </div>

      {assignedFolderIds.length > 0 ? (
        <div className="mb-3 space-y-2">
          {assignedFolderIds.map((folderId) =>
            folderToRemove === folderId ? (
              <RemoveFolderConfirm
                key={folderId}
                folderLabel={getFolderLabel(folderId)}
                onCancel={() => setFolderToRemove(null)}
                onConfirm={() => removeFromFolder(folderId)}
              />
            ) : (
              <AssignedFolderChip
                key={folderId}
                folderId={folderId}
                folders={folders}
                onRemove={() => setFolderToRemove(folderId)}
              />
            )
          )}
        </div>
      ) : (
        <p className="mb-3 text-sm text-muted-foreground">This clip is not in any folder yet.</p>
      )}

      {availableFolders.length > 0 ? (
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full justify-start gap-2 border-dashed bg-background/60 px-3 hover:bg-accent/40"
            >
              <FolderPlus className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">Add to folder or subfolder…</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[min(100vw-3rem,22rem)] p-0">
            <div className="border-b border-border px-3 py-2.5">
              <p className="text-sm font-medium">Choose a folder</p>
              <p className="text-xs text-muted-foreground">Select where this clip should be saved</p>
            </div>
            <ScrollArea className="max-h-56">
              <div className="p-1.5">
                {availableTree.map((folder) => (
                  <FolderPickerItem key={folder.id} folder={folder} depth={0} onSelect={addToFolder} />
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      ) : (
        <p className="text-sm text-muted-foreground">This clip is already in all of your folders.</p>
      )}
    </div>
  );
}
