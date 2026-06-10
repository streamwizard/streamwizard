"use client";

import { ClipModalFolderSection } from "@/components/modals/clip-modal-folder-section";
import { formatClipDuration, formatDate } from "@/lib/format";
import { downloadClip } from "@/lib/utils/download-clip";
import { clipsWithFolders } from "@/types/database";
import { Badge } from "@repo/ui";
import { Button } from "@repo/ui";
import { Calendar, Clock, Download, Eye, ExternalLink, Gamepad2, RectangleHorizontal, RectangleVertical, Star, User } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

type TwitchClipModalProps = {
  url: string;
  clip?: clipsWithFolders;
};

function ClipModalDetails({ clip }: { clip: clipsWithFolders }) {
  const copyUrl = () => {
    if (!clip.url) return;
    navigator.clipboard.writeText(clip.url);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <h2 className="text-lg font-semibold leading-snug">{clip.title}</h2>
          {clip.is_featured && (
            <Badge className="bg-yellow-500 text-yellow-950">
              <Star className="mr-1 size-3" />
              Featured
            </Badge>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {clip.url && (
            <Button variant="outline" size="sm" asChild>
              <Link href={clip.url} target="_blank">
                <ExternalLink className="mr-1.5 size-4" />
                Twitch
              </Link>
            </Button>
          )}
          {clip.url && (
            <Button variant="outline" size="sm" onClick={copyUrl}>
              Copy URL
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <User className="size-4 shrink-0" />
          <span className="truncate">{clip.creator_name ?? "—"}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Eye className="size-4 shrink-0" />
          <span>{clip.view_count != null ? `${clip.view_count.toLocaleString()} views` : "—"}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="size-4 shrink-0" />
          <span>{clip.created_at_twitch ? formatDate(clip.created_at_twitch) : "—"}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="size-4 shrink-0" />
          <span>{clip.duration != null ? formatClipDuration(clip.duration) : "—"}</span>
        </div>
        {clip.game_name && (
          <div className="col-span-2 flex items-center gap-2 text-muted-foreground sm:col-span-4">
            <Gamepad2 className="size-4 shrink-0" />
            <span className="truncate">{clip.game_name}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ClipModalDownloadSection({ clip }: { clip: clipsWithFolders }) {
  if (!clip.broadcaster_id) return null;

  const handleDownload = (layout: "landscape" | "portrait") =>
    downloadClip({
      clipId: clip.twitch_clip_id,
      layout,
      broadcaster_id: clip.broadcaster_id!,
      title: clip.title,
    });

  return (
    <div className="flex min-h-0 min-w-0 flex-col rounded-lg border border-border bg-card/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Download className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Download</h3>
      </div>
      <div className="mb-3">
        <Button
          type="button"
          variant="outline"
          className="h-[46px] w-full justify-start gap-2 border-border bg-muted/30 px-3 hover:bg-accent/40"
          onClick={() => handleDownload("landscape")}
        >
          <RectangleHorizontal className="size-4 text-muted-foreground" />
          Download Landscape
        </Button>
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-10 w-full justify-start gap-2 border-dashed bg-background/60 px-3 hover:bg-accent/40"
        onClick={() => handleDownload("portrait")}
      >
        <RectangleVertical className="size-4 text-muted-foreground" />
        Download Portrait
      </Button>
    </div>
  );
}

export default function TwitchClipModal({ url, clip }: TwitchClipModalProps) {
  const formattedUrl = `${url}&parent=localhost&parent=streamwizard.org&parent=staging.streamwizard.org&autoplay=true`;

  return (
    <div className="mt-6 max-h-[calc(100vh-5rem)] w-[960px] max-w-[calc(100vw-3rem)] overflow-y-auto pr-1">
      <iframe src={formattedUrl} height="480" width="100%" allowFullScreen className="rounded-md border border-border" title="Twitch clip preview" />

      {clip ? (
        <div className="mt-4 space-y-5 border-t border-border pt-4">
          <ClipModalDetails clip={clip} />
          <div
            className={
              clip.broadcaster_id
                ? "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-stretch"
                : "grid grid-cols-1 gap-4"
            }
          >
            <ClipModalFolderSection clip={clip} />
            <ClipModalDownloadSection clip={clip} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
