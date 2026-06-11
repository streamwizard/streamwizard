"use client";

import { ClipModalFolderSection } from "@/components/modals/clip-modal-folder-section";
import { formatClipDuration, formatDate } from "@/lib/format";
import { downloadClip } from "@/lib/utils/download-clip";
import { clipsWithFolders } from "@/types/database";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import {
  Calendar,
  Clock,
  Download,
  ExternalLink,
  Eye,
  Gamepad2,
  RectangleHorizontal,
  RectangleVertical,
  Star,
  User,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

type TwitchClipDialogProps = {
  clip: clipsWithFolders | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function ClipMetaItem({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{children}</span>
    </div>
  );
}

function ClipDialogDownloadSection({ clip }: { clip: clipsWithFolders }) {
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
      <Button
        type="button"
        variant="outline"
        className="mb-3 h-[46px] w-full justify-start gap-2 border-border bg-muted/30 px-3 hover:bg-accent/40"
        onClick={() => handleDownload("landscape")}
      >
        <RectangleHorizontal className="size-4 text-muted-foreground" />
        Download Landscape
      </Button>
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

export function TwitchClipDialog({ clip, open, onOpenChange }: TwitchClipDialogProps) {
  const embedUrl = clip?.embed_url
    ? `${clip.embed_url}&parent=localhost&parent=streamwizard.org&parent=staging.streamwizard.org&autoplay=true`
    : null;

  const copyUrl = () => {
    if (!clip?.url) return;
    navigator.clipboard.writeText(clip.url);
    toast.success("Copied to clipboard");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-3xl gap-0 overflow-hidden p-0 lg:max-w-4xl">
        {clip ? (
          <div key={clip.id} className="flex max-h-[90vh] min-w-0 flex-col">
            {/* Video */}
            <div className="relative aspect-video w-full shrink-0 bg-black">
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  allowFullScreen
                  className="absolute inset-0 size-full"
                  title={clip.title}
                />
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

            {/* Details + actions */}
            <div className="min-w-0 space-y-5 overflow-y-auto p-4 sm:p-6">
              <DialogHeader className="space-y-2 text-left">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <DialogTitle className="text-lg leading-snug">{clip.title}</DialogTitle>
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
                        <Link href={clip.url} target="_blank" rel="noopener noreferrer">
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
                <DialogDescription className="sr-only">
                  Clip by {clip.creator_name} on {clip.broadcaster_name}&apos;s channel.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                <ClipMetaItem icon={<User className="size-4" />}>{clip.creator_name ?? "—"}</ClipMetaItem>
                <ClipMetaItem icon={<Eye className="size-4" />}>
                  {clip.view_count != null ? `${clip.view_count.toLocaleString()} views` : "—"}
                </ClipMetaItem>
                <ClipMetaItem icon={<Calendar className="size-4" />}>
                  {clip.created_at_twitch ? formatDate(clip.created_at_twitch) : "—"}
                </ClipMetaItem>
                <ClipMetaItem icon={<Clock className="size-4" />}>
                  {clip.duration != null ? formatClipDuration(clip.duration) : "—"}
                </ClipMetaItem>
                {clip.game_name && (
                  <div className="col-span-2 sm:col-span-4">
                    <ClipMetaItem icon={<Gamepad2 className="size-4" />}>{clip.game_name}</ClipMetaItem>
                  </div>
                )}
              </div>

              <div
                className={
                  clip.broadcaster_id
                    ? "grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:items-stretch"
                    : "grid min-w-0 grid-cols-1 gap-4"
                }
              >
                <ClipModalFolderSection clip={clip} />
                <ClipDialogDownloadSection clip={clip} />
              </div>
            </div>
          </div>
        ) : (
          <DialogTitle className="sr-only">Clip</DialogTitle>
        )}
      </DialogContent>
    </Dialog>
  );
}
