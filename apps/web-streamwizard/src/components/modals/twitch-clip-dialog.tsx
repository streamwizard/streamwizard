"use client";

import { AddToFolderItems } from "@/components/clips/add-to-folder-menu";
import { formatClipDuration, formatDate } from "@/lib/format";
import { buildClipFolderTree, type ClipFolderNode } from "@/lib/utils/clip-folders";
import { downloadClip } from "@/lib/utils/download-clip";
import { useClipFolders } from "@/providers/clips-provider";
import { useClipFolderDialog } from "@/providers/clip-folder-dialog-provider";
import { clipsWithFolders } from "@/types/database";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Separator,
} from "@repo/ui";
import {
  Calendar,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FolderMinus,
  FolderPlus,
  Gamepad2,
  Loader2,
  Star,
  User,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

type TwitchClipDialogProps = {
  clip: clipsWithFolders | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function InfoCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="shrink-0 text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium" title={value}>
          {value}
        </p>
      </div>
    </div>
  );
}

function ClipDialogBody({ clip }: { clip: clipsWithFolders }) {
  const { openCreateFolder } = useClipFolderDialog();
  const { folders, getRemovableFolders, getFolderLabel, AddToFolder, handleRemoveClipFromFolder } = useClipFolders();
  const [isDownloading, setIsDownloading] = useState(false);
  const [assignedFolderIds, setAssignedFolderIds] = useState(() => clip.folders.map((f) => f.id));

  const removableFolders = getRemovableFolders(assignedFolderIds);
  const folderTree = buildClipFolderTree(folders);

  const handleAddToFolder = (folder: ClipFolderNode) => {
    setAssignedFolderIds((prev) => [...prev, folder.id]);
    AddToFolder({ folderName: getFolderLabel(folder.id), folderId: folder.id, clipId: clip.twitch_clip_id });
  };

  const handleRemoveFromFolder = (folderId: number) => {
    setAssignedFolderIds((prev) => prev.filter((id) => id !== folderId));
    handleRemoveClipFromFolder(folderId, clip.twitch_clip_id, getFolderLabel(folderId));
  };

  const embedUrl = clip.embed_url
    ? `${clip.embed_url}&parent=localhost&parent=streamwizard.org&parent=staging.streamwizard.org&autoplay=true`
    : null;

  const copyUrl = () => {
    if (!clip.url) return;
    navigator.clipboard.writeText(clip.url);
    toast.success("Copied to clipboard");
  };

  const handleDownload = async (layout: "landscape" | "portrait") => {
    if (!clip.broadcaster_id) return;
    setIsDownloading(true);
    try {
      await downloadClip({
        clipId: clip.twitch_clip_id,
        layout,
        broadcaster_id: clip.broadcaster_id,
        title: clip.title,
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex max-h-[90vh] min-w-0 flex-col">
      {/* Video */}
      <div className="relative aspect-video w-full shrink-0 bg-black">
        {embedUrl ? (
          <iframe src={embedUrl} allowFullScreen className="absolute inset-0 size-full" title={clip.title} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            This clip can&apos;t be played here.
          </div>
        )}
        {clip.duration != null && (
          <Badge className="absolute left-2 top-2 bg-primary text-primary-foreground">
            {formatClipDuration(clip.duration)}
          </Badge>
        )}
      </div>

      {/* Body */}
      <div className="min-w-0 space-y-4 overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-1 text-left">
          <div className="flex items-start gap-2">
            <DialogTitle className="line-clamp-2 text-lg leading-snug">{clip.title}</DialogTitle>
            {clip.is_featured && (
              <Badge className="shrink-0 bg-yellow-500 text-yellow-950">
                <Star className="mr-1 size-3" />
                Featured
              </Badge>
            )}
          </div>
          <DialogDescription className="sr-only">
            Clip by {clip.creator_name} on {clip.broadcaster_name}&apos;s channel.
          </DialogDescription>
        </DialogHeader>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <InfoCell icon={<User className="size-4" />} label="Clipped by" value={clip.creator_name || "—"} />
          <InfoCell icon={<Calendar className="size-4" />} label="Created" value={clip.created_at_twitch ? formatDate(clip.created_at_twitch) : "—"} />
          <InfoCell icon={<Gamepad2 className="size-4" />} label="Category" value={clip.game_name || "—"} />
          <InfoCell icon={<Eye className="size-4" />} label="Views" value={(clip.view_count ?? 0).toLocaleString()} />
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {/* Add to folder */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <FolderPlus className="mr-2 size-4" />
                Add to folder
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {folderTree.length === 0 ? (
                <DropdownMenuItem disabled>No folders yet</DropdownMenuItem>
              ) : (
                <AddToFolderItems nodes={folderTree} assignedIds={assignedFolderIds} onAdd={handleAddToFolder} />
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => openCreateFolder()}>
                Create new folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Remove from folder */}
          {removableFolders.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <FolderMinus className="mr-2 size-4" />
                  Remove from folder
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {removableFolders.map((folder) => (
                  <DropdownMenuItem
                    key={folder.id}
                    onClick={() => handleRemoveFromFolder(folder.id)}
                  >
                    {getFolderLabel(folder.id)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Download */}
          {clip.broadcaster_id && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={isDownloading}>
                  {isDownloading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}
                  Download
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => handleDownload("landscape")}>Landscape</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload("portrait")}>Portrait</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Copy URL */}
          {clip.url && (
            <Button variant="outline" size="sm" onClick={copyUrl}>
              <Copy className="mr-2 size-4" />
              Copy URL
            </Button>
          )}

          {/* Open on Twitch */}
          {clip.url && (
            <Button variant="outline" size="sm" asChild>
              <Link href={clip.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 size-4" />
                Open on Twitch
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function TwitchClipDialog({ clip, open, onOpenChange }: TwitchClipDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-3xl gap-0 overflow-hidden p-0 lg:max-w-4xl">
        {clip ? (
          <ClipDialogBody key={clip.id} clip={clip} />
        ) : (
          <DialogTitle className="sr-only">Clip</DialogTitle>
        )}
      </DialogContent>
    </Dialog>
  );
}
