"use client";

import { TwitchVideo, formatThumbnailUrl } from "@/types/twitch video";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Video } from "lucide-react";

interface VodsTableProps {
  videos: TwitchVideo[];
  selectedIds: Set<string>;
  onSelectionChange: (selectedIds: Set<string>) => void;
  onVideoClick: (video: TwitchVideo) => void;
}

/**
 * Table component for displaying VODs with selection and click handling
 */
export function VodsTable({ videos, selectedIds, onSelectionChange, onVideoClick }: VodsTableProps) {
  const allSelected = videos.length > 0 && videos.every((v) => selectedIds.has(v.id));
  const someSelected = videos.some((v) => selectedIds.has(v.id)) && !allSelected;

  const handleSelectAll = (checked: boolean | "indeterminate") => {
    if (checked === true) {
      onSelectionChange(new Set(videos.map((v) => v.id)));
    } else {
      onSelectionChange(new Set());
    }
  };

  const handleSelectVideo = (videoId: string, checked: boolean | "indeterminate") => {
    const newSelection = new Set(selectedIds);
    if (checked === true) {
      newSelection.add(videoId);
    } else {
      newSelection.delete(videoId);
    }
    onSelectionChange(newSelection);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatViewCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  if (videos.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Video className="h-6 w-6" />
          </EmptyMedia>
          <EmptyTitle>No VODs found</EmptyTitle>
          <EmptyDescription>There are no archived videos for this channel.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[50px]">
            <Checkbox checked={allSelected ? true : someSelected ? "indeterminate" : false} onCheckedChange={handleSelectAll} aria-label="Select all videos" />
          </TableHead>
          <TableHead className="w-[140px]">Thumbnail</TableHead>
          <TableHead>Title</TableHead>
          <TableHead className="w-[100px]">Duration</TableHead>
          <TableHead className="w-[100px]">Views</TableHead>
          <TableHead className="w-[120px]">Created</TableHead>
          <TableHead className="w-[80px]">Language</TableHead>
          <TableHead className="w-[80px]">Type</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {videos.map((video) => {
          const thumbnailUrl = formatThumbnailUrl(video.thumbnail_url, 320, 180);
          const isSelected = selectedIds.has(video.id);

          return (
            <TableRow key={video.id} data-state={isSelected ? "selected" : undefined} className="cursor-pointer" onClick={() => onVideoClick(video)}>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox checked={isSelected} onCheckedChange={(checked) => handleSelectVideo(video.id, checked)} aria-label={`Select ${video.title}`} />
              </TableCell>
              <TableCell>
                <div className="h-[72px] w-[128px] overflow-hidden rounded bg-muted">
                  {thumbnailUrl ? (
                    <img src={thumbnailUrl} alt={video.title} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Video className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <span className="line-clamp-2 font-medium">
                  {video.title}{" "}
                  {video.is_live && (
                    <Badge variant="destructive" className="ml-2">
                      Live
                    </Badge>
                  )}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">{video.duration}</TableCell>
              <TableCell className="text-muted-foreground">{formatViewCount(video.view_count)}</TableCell>
              <TableCell className="text-muted-foreground">{formatDate(video.created_at)}</TableCell>
              <TableCell>
                <span className="uppercase text-muted-foreground">{video.language}</span>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="capitalize">
                  {video.type}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
