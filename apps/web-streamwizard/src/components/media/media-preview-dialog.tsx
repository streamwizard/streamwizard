"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Separator,
} from "@repo/ui";
import { cn } from "@repo/ui";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Copy, Download, Pencil, Trash2 } from "lucide-react";
import {
  deleteAsset,
  getAssetDownloadUrl,
  renameAsset,
  type AssetListing,
  type UserAsset,
} from "@/actions/assets";
import { formatBytes, formatDate, formatDuration } from "@/lib/format";
import { MediaPreviewBody, type MediaMeta } from "./media-preview-body";

interface Props {
  asset: UserAsset | null;
  /** The list as currently shown, so the arrows walk what the user can see. */
  files: UserAsset[];
  onClose: () => void;
  onNavigate: (asset: UserAsset) => void;
  onRenamed: (asset: UserAsset) => void;
  onDeleted: (listing: AssetListing | null, next: UserAsset | null) => void;
  /** Picker mode: offer the file instead of just showing it. */
  onSelect?: (asset: UserAsset) => void;
  /** True when this opens on top of the asset picker's own dialog. */
  nested?: boolean;
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium" title={value}>
        {value}
      </p>
    </div>
  );
}

export function MediaPreviewDialog({
  asset,
  files,
  onClose,
  onNavigate,
  onRenamed,
  onDeleted,
  onSelect,
  nested,
}: Props) {
  const [meta, setMeta] = useState<MediaMeta>({});
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const index = asset ? files.findIndex((f) => f.id === asset.id) : -1;
  const previous = index > 0 ? files[index - 1] : null;
  const next = index >= 0 && index < files.length - 1 ? files[index + 1] : null;

  // Fresh file, fresh measurements and a closed rename field. Adjusted during
  // render (the React "previous prop" pattern) rather than in an effect, the
  // same way the sidebar's folder tree handles route changes.
  const [prevAssetId, setPrevAssetId] = useState(asset?.id ?? null);
  if ((asset?.id ?? null) !== prevAssetId) {
    setPrevAssetId(asset?.id ?? null);
    setMeta({});
    setRenaming(false);
    setDraftName(asset?.file_name ?? "");
  }

  const go = useCallback(
    (target: UserAsset | null) => {
      if (target) onNavigate(target);
    },
    [onNavigate],
  );

  // Arrow keys walk the list. No wrapping: in a long library, jumping from the
  // last file back to the first makes "am I at the end?" unanswerable.
  useEffect(() => {
    if (!asset) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        go(next);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        go(previous);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [asset, go, next, previous]);

  if (!asset) return null;

  const onCopyUrl = async () => {
    await navigator.clipboard.writeText(asset.url);
    toast.success("URL copied");
  };

  const onDownload = async () => {
    const { data, error } = await getAssetDownloadUrl(asset.id);
    if (error || !data) {
      toast.error(error ?? "Failed to start the download.");
      return;
    }
    const link = document.createElement("a");
    link.href = data.url;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const onSaveName = async () => {
    if (draftName.trim() === asset.file_name) {
      setRenaming(false);
      return;
    }
    setSaving(true);
    const { data, error } = await renameAsset(asset.id, draftName);
    setSaving(false);
    if (error || !data) {
      toast.error(error ?? "Failed to rename the file.");
      return;
    }
    onRenamed(data);
    setRenaming(false);
    toast.success("Renamed");
  };

  const onConfirmDelete = async () => {
    const { data, error } = await deleteAsset(asset.id);
    if (error) {
      toast.error(error);
      return;
    }
    setConfirmingDelete(false);
    // Land on the next file so deleting a run of files doesn't mean
    // reopening the dialog each time.
    onDeleted(data, next ?? previous ?? null);
    toast.success("File deleted");
  };

  const nameMatchesLink = asset.url.endsWith(`/${asset.file_name}`);
  const dimensions = meta.width && meta.height ? `${meta.width} x ${meta.height}` : null;
  const duration = meta.durationSeconds ? formatDuration(Math.round(meta.durationSeconds)) : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "w-[95vw] max-w-3xl gap-0 overflow-hidden p-0 lg:max-w-4xl",
          // Sits on top of the asset picker's dialog when opened from there.
          nested && "z-[60]",
        )}
      >
        <div className="flex max-h-[90vh] min-w-0 flex-col">
          <MediaPreviewBody key={asset.id} asset={asset} onMeta={setMeta} />

          <div className="min-w-0 space-y-4 overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="truncate text-left" title={asset.file_name}>
                {asset.file_name}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Preview of {asset.file_name}, with its details and actions.
              </DialogDescription>
            </DialogHeader>

            {renaming ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    autoFocus
                    value={draftName}
                    disabled={saving}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void onSaveName();
                      if (e.key === "Escape") setRenaming(false);
                    }}
                    className="max-w-xs"
                  />
                  <Button size="sm" onClick={() => void onSaveName()} disabled={saving}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRenaming(false)} disabled={saving}>
                    Cancel
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Renaming changes the name here, not the link. Everything already using this file keeps working.
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <InfoCell label="Type" value={asset.mime_type} />
              <InfoCell label="Size" value={formatBytes(asset.size_bytes)} />
              {dimensions ? <InfoCell label="Dimensions" value={dimensions} /> : null}
              {duration ? <InfoCell label="Length" value={duration} /> : null}
              <InfoCell label="Uploaded" value={formatDate(asset.created_at)} />
            </div>

            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Link</p>
              <p className="truncate font-mono text-xs" title={asset.url}>
                {asset.url}
              </p>
              {!nameMatchesLink ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  The link keeps the name this file was uploaded under. Downloads use the name above.
                </p>
              ) : null}
            </div>

            <Separator />

            <div className="flex flex-wrap items-center gap-2">
              {onSelect ? (
                <Button size="sm" onClick={() => onSelect(asset)}>
                  Use this file
                </Button>
              ) : null}
              <Button size="sm" variant="outline" onClick={() => void onCopyUrl()}>
                <Copy className="mr-2 size-4" />
                Copy URL
              </Button>
              <Button size="sm" variant="outline" onClick={() => void onDownload()}>
                <Download className="mr-2 size-4" />
                Download
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRenaming(true)}>
                <Pencil className="mr-2 size-4" />
                Rename
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmingDelete(true)}>
                <Trash2 className="mr-2 size-4" />
                Delete
              </Button>

              <div className="ml-auto flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  title="Previous file"
                  disabled={!previous}
                  onClick={() => go(previous)}
                >
                  <ChevronLeft className="size-4" />
                  <span className="sr-only">Previous file</span>
                </Button>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {index + 1} / {files.length}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  title="Next file"
                  disabled={!next}
                  onClick={() => go(next)}
                >
                  <ChevronRight className="size-4" />
                  <span className="sr-only">Next file</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent className={nested ? "z-[70]" : undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {asset.file_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Any overlay using this file loses it. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onConfirmDelete()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
