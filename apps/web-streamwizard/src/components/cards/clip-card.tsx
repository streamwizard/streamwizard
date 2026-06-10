"use client";
import { Badge } from "@repo/ui";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@repo/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@repo/ui";
import { useClipFolders } from "@/providers/clips-provider";
import { useModal } from "@/providers/modal-provider";
import type { ClipView } from "@/lib/utils/clip-view";
import { clipsWithFolders } from "@/types/database";
import { Calendar, Eye, Gamepad2, MoreHorizontal, Star, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import TwitchClipModal from "../modals/twitch-clip-modal";
import { Button } from "@repo/ui";
import { formatClipDuration, formatDate } from "@/lib/format";
import { downloadClip } from "@/lib/utils/download-clip";
import { cn } from "@/lib/utils";
import { useCallback } from "react";

let suppressClipOpenUntil = 0;

function suppressClipOpen() {
  suppressClipOpenUntil = Date.now() + 400;
}

function shouldSuppressClipOpen() {
  if (Date.now() < suppressClipOpenUntil) {
    suppressClipOpenUntil = 0;
    return true;
  }
  return false;
}

const menuSurfaceHandlers = {
  onPointerDown: (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    suppressClipOpen();
  },
  onClick: (event: React.MouseEvent) => {
    event.stopPropagation();
  },
};

type TwitchClipCardProps = clipsWithFolders & {
  view?: ClipView;
};

export function useClipCardActions(clip: clipsWithFolders) {
  const { openModal } = useModal();

  const OpenClip = () => {
    openModal(<TwitchClipModal url={clip.embed_url!} clip={clip} />);
  };

  return { OpenClip };
}

export function ClipCardActions({ clip }: { clip: clipsWithFolders }) {
  const { getAvailableFolders, getRemovableFolders, getFolderLabel, AddToFolder, handleRemoveClipFromFolder } =
    useClipFolders();

  const copyClipUrl = () => {
    navigator.clipboard.writeText(clip.url!);
    toast.success("Copied to clipboard");
  };

  const downloadClipLayout = (layout: "landscape" | "portrait") =>
    downloadClip({
      clipId: clip.twitch_clip_id,
      layout,
      broadcaster_id: clip.broadcaster_id!,
      title: clip.title,
    });

  const folderIds = clip.folders.map((folder: { id: number }) => folder.id);
  const availableFolders = getAvailableFolders(folderIds);
  const removableFolders = getRemovableFolders(folderIds);

  return (
    <DropdownMenu
      modal
      onOpenChange={(open) => {
        if (!open) suppressClipOpen();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" {...menuSurfaceHandlers}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Folders</DropdownMenuLabel>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Add to folder</DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent {...menuSurfaceHandlers}>
                {availableFolders.length === 0 ? (
                  <DropdownMenuItem disabled>No folders available</DropdownMenuItem>
                ) : (
                  availableFolders.map((folder) => (
                    <DropdownMenuItem
                      key={folder.id}
                      onClick={() =>
                        AddToFolder({
                          folderName: getFolderLabel(folder.id),
                          folderId: folder.id,
                          clipId: clip.twitch_clip_id,
                        })
                      }
                    >
                      {getFolderLabel(folder.id)}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Remove from folder</DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent {...menuSurfaceHandlers}>
                {removableFolders.length === 0 ? (
                  <DropdownMenuItem disabled>No folders available</DropdownMenuItem>
                ) : (
                  removableFolders.map((folder) => (
                    <DropdownMenuItem
                      key={folder.id}
                      onClick={() =>
                        handleRemoveClipFromFolder(folder.id, clip.twitch_clip_id, getFolderLabel(folder.id))
                      }
                    >
                      {getFolderLabel(folder.id)}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <Link href={clip.url!} target="_blank">
          <DropdownMenuItem onClick={() => navigator.clipboard.writeText(clip.url!)}>View</DropdownMenuItem>
        </Link>
        <DropdownMenuItem onClick={() => downloadClipLayout("landscape")}>Download Landscape</DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadClipLayout("portrait")}>Download Portrait</DropdownMenuItem>
        <DropdownMenuItem onClick={copyClipUrl}>Copy URL to clipboard</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ClipThumbnail({
  clip,
  className,
  imageClassName,
}: {
  clip: clipsWithFolders;
  className?: string;
  imageClassName?: string;
}) {
  return (
    <div className={cn("relative shrink-0", className)}>
      <div className="relative overflow-hidden rounded-lg">
        <Image
          src={clip.thumbnail_url!}
          alt={clip.title}
          width={500}
          height={108}
          className={cn("w-full object-cover", imageClassName)}
        />
        <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground">
          {formatClipDuration(clip.duration!)}
        </Badge>
        {clip.is_featured && (
          <Badge className="absolute bottom-2 left-2 bg-yellow-500 text-yellow-950">
            <Star className="w-3 h-3 mr-1" />
            Featured
          </Badge>
        )}
      </div>
    </div>
  );
}

function ClipMetaRow({ clip }: { clip: clipsWithFolders }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
      <div className="flex items-center gap-1">
        <User className="size-4" />
        <span>{clip.creator_name}</span>
      </div>
      <div className="flex items-center gap-1">
        <Eye className="size-4" />
        <span>{clip.view_count!.toLocaleString()} views</span>
      </div>
      <div className="flex items-center gap-1">
        <Calendar className="size-4" />
        <span>{formatDate(clip.created_at_twitch!)}</span>
      </div>
      {clip.game_name && (
        <div className="flex items-center gap-1">
          <Gamepad2 className="size-4" />
          <span>{clip.game_name}</span>
        </div>
      )}
    </div>
  );
}

export default function TwitchClipCard({ view = "grid", ...clip }: TwitchClipCardProps) {
  const { OpenClip } = useClipCardActions(clip);

  const handleCardClick = useCallback(() => {
    if (shouldSuppressClipOpen()) return;
    OpenClip();
  }, [OpenClip]);

  const cardClassName =
    "w-full overflow-hidden cursor-pointer transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-lg";

  if (view === "list") {
    return (
      <Card className={cn(cardClassName, "max-w-none")} onClick={handleCardClick}>
        <div className="flex items-stretch">
          <ClipThumbnail
            clip={clip}
            className="w-44 sm:w-52"
            imageClassName="h-full min-h-28 sm:min-h-32"
          />
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 p-4">
            <div className="space-y-2">
              <CardTitle className="text-base line-clamp-2">{clip.title}</CardTitle>
              <ClipMetaRow clip={clip} />
            </div>
            <div className="flex justify-start">
              <ClipCardActions clip={clip} />
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn(cardClassName, "max-w-md gap-4 pb-4")} onClick={handleCardClick}>
      <CardHeader className="p-0">
        <ClipThumbnail clip={clip} className="px-3 pt-3" imageClassName="h-48" />
      </CardHeader>
      <CardContent className="px-4 pb-0 pt-4">
        <CardTitle className="mb-2 line-clamp-2 text-lg">{clip.title}</CardTitle>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <User className="h-4 w-4" />
          <span>{clip.creator_name}</span>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-2 px-4 pb-2 pt-3 text-sm text-muted-foreground">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center">
            <Eye className="mr-1 h-4 w-4" />
            {clip.view_count!.toLocaleString()} views
          </div>
          <div className="flex items-center">
            <Calendar className="mr-1 h-4 w-4" />
            {formatDate(clip.created_at_twitch!)}
          </div>
        </div>
        <div className="-ml-2 mt-1 flex justify-start">
              <ClipCardActions clip={clip} />
        </div>
      </CardFooter>
    </Card>
  );
}
