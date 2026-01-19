"use client";

import { useState } from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { Trash2, Film, MoreHorizontal, ExternalLink, Play } from "lucide-react";
import { TwitchVideo } from "@/types/twitch";
import { deleteVideos } from "@/actions/twitch/vods";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteVodsDialog } from "./delete-vods-dialog";
import { CreateClipModal } from "./create-clip-modal";
import { VideoPlayerWithClipCreator } from "./video-player-modal";

interface VodTableProps {
  videos: TwitchVideo[];
  onVideosDeleted?: (deletedIds: string[]) => void;
}

function formatDuration(duration: string): string {
  // Duration format: "3h2m1s" or "2m30s" or "45s"
  const hours = duration.match(/(\d+)h/)?.[1] || "0";
  const minutes = duration.match(/(\d+)m/)?.[1] || "0";
  const seconds = duration.match(/(\d+)s/)?.[1] || "0";

  const parts = [];
  if (hours !== "0") parts.push(`${hours}h`);
  if (minutes !== "0" || hours !== "0") parts.push(`${minutes.padStart(2, "0")}m`);
  parts.push(`${seconds.padStart(2, "0")}s`);

  return parts.join(" ");
}

function formatViewCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

function getThumbnailUrl(url: string, width: number = 320, height: number = 180): string {
  return url.replace("%{width}", width.toString()).replace("%{height}", height.toString());
}

export function VodTable({ videos, onVideosDeleted }: VodTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clipModalOpen, setClipModalOpen] = useState(false);
  const [selectedVodForClip, setSelectedVodForClip] = useState<TwitchVideo | null>(null);
  const [playerModalOpen, setPlayerModalOpen] = useState(false);
  const [selectedVodForPlayer, setSelectedVodForPlayer] = useState<TwitchVideo | null>(null);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(videos.map((v) => v.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;

    setIsDeleting(true);
    const idsArray = Array.from(selectedIds);

    // Delete in batches of 5
    const batches = [];
    for (let i = 0; i < idsArray.length; i += 5) {
      batches.push(idsArray.slice(i, i + 5));
    }

    const allDeletedIds: string[] = [];
    let hasError = false;

    for (const batch of batches) {
      const result = await deleteVideos(batch);
      if (result.success && result.data) {
        allDeletedIds.push(...result.data.deletedIds);
      } else {
        hasError = true;
        toast.error(result.message);
        break;
      }
    }

    if (allDeletedIds.length > 0) {
      toast.success(`Deleted ${allDeletedIds.length} video(s)`);
      onVideosDeleted?.(allDeletedIds);
      setSelectedIds(new Set());
    }

    if (!hasError && allDeletedIds.length === idsArray.length) {
      setDeleteDialogOpen(false);
    }

    setIsDeleting(false);
  };

  const handleOpenClipModal = (video: TwitchVideo) => {
    setSelectedVodForClip(video);
    setClipModalOpen(true);
  };

  const handleOpenPlayerModal = (video: TwitchVideo) => {
    setSelectedVodForPlayer(video);
    setPlayerModalOpen(true);
  };

  const allSelected = videos.length > 0 && selectedIds.size === videos.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < videos.length;

  return (
    <div className="space-y-4">
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} video(s) selected
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Selected
          </Button>
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  ref={(el) => {
                    if (el) {
                      (el as unknown as HTMLInputElement).indeterminate = someSelected;
                    }
                  }}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead className="w-[280px]">Video</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Views</TableHead>
              <TableHead>Language</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="w-12">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {videos.map((video) => (
              <TableRow key={video.id} data-state={selectedIds.has(video.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(video.id)}
                    onCheckedChange={(checked) => handleSelectOne(video.id, checked as boolean)}
                    aria-label={`Select ${video.title}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleOpenPlayerModal(video)}
                      className="relative w-32 h-18 flex-shrink-0 rounded overflow-hidden bg-muted group cursor-pointer"
                    >
                      <Image
                        src={getThumbnailUrl(video.thumbnail_url)}
                        alt={video.title}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                        sizes="128px"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-8 h-8 text-white fill-white" />
                      </div>
                    </button>
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => handleOpenPlayerModal(video)}
                        className="font-medium text-sm hover:underline line-clamp-2 text-left"
                      >
                        {video.title}
                      </button>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDistanceToNow(new Date(video.created_at), { addSuffix: true })}
                </TableCell>
                <TableCell className="text-sm">
                  {formatDuration(video.duration)}
                </TableCell>
                <TableCell className="text-sm">
                  {formatViewCount(video.view_count)}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="uppercase">
                    {video.language}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {video.type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <a href={video.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open on Twitch
                        </a>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleOpenClipModal(video)}>
                        <Film className="w-4 h-4 mr-2" />
                        Create Clip
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          setSelectedIds(new Set([video.id]));
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <DeleteVodsDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        count={selectedIds.size}
        isDeleting={isDeleting}
        onConfirm={handleDeleteSelected}
      />

      {selectedVodForClip && (
        <CreateClipModal
          open={clipModalOpen}
          onOpenChange={setClipModalOpen}
          video={selectedVodForClip}
        />
      )}

      <VideoPlayerWithClipCreator
        open={playerModalOpen}
        onOpenChange={setPlayerModalOpen}
        video={selectedVodForPlayer}
      />
    </div>
  );
}
