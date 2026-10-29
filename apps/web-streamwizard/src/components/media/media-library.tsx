"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, Music, Video, FileJson, Trash2, Loader2, Copy, ImageIcon, FolderUp, Type } from "lucide-react";
import { Button, Progress } from "@repo/ui";
import { cn } from "@repo/ui";
import { toast } from "sonner";
import {
  confirmAssetUpload,
  createAssetUpload,
  deleteAsset,
  type AssetListing,
  type UserAsset,
} from "@/actions/assets";
import { uploadMimeType, type AssetKind } from "@/lib/asset-mime";
import { formatBytes } from "@/lib/format";
import { filesFromDrop, partitionUploadable } from "@/lib/media-upload";
import { MediaPreviewDialog } from "./media-preview-dialog";

interface Uploading {
  id: string;
  name: string;
  progress: number;
}

// Browser PUTs straight to the presigned R2 URL; XHR gives real progress.
function putToPresignedUrl(
  url: string,
  file: File,
  mimeType: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    // Has to match the type the URL was signed for.
    xhr.setRequestHeader("Content-Type", mimeType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Upload failed: network error"));
    xhr.send(file);
  });
}

function KindIcon({ asset }: { asset: UserAsset }) {
  if (asset.kind === "image") {
    return (
      // Plain <img>: R2 CDN thumbnails don't need next/image optimization here
      // eslint-disable-next-line @next/next/no-img-element
      <img src={asset.url} alt={asset.file_name} className="h-10 w-10 rounded object-cover bg-muted" />
    );
  }
  const Icon =
    asset.kind === "audio" ? Music : asset.kind === "video" ? Video : asset.kind === "font" ? Type : FileJson;
  return (
    <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
      <Icon className="h-5 w-5 text-muted-foreground" />
    </div>
  );
}

function AssetSummary({ asset }: { asset: UserAsset }) {
  return (
    <>
      <KindIcon asset={asset} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" title={asset.file_name}>{asset.file_name}</p>
        <p className="text-xs text-muted-foreground">
          {formatBytes(asset.size_bytes)} · {asset.kind}
        </p>
      </div>
    </>
  );
}

interface MediaLibraryProps {
  initialListing: AssetListing | null;
  // Select mode (asset pickers): clicking a file calls onSelect instead of
  // showing copy/delete actions. kindFilter narrows the list (e.g. images only).
  onSelect?: (asset: UserAsset) => void;
  kindFilter?: AssetKind[];
}

export function MediaLibrary({ initialListing, onSelect, kindFilter }: MediaLibraryProps) {
  const [listing, setListing] = useState<AssetListing | null>(initialListing);
  const [uploads, setUploads] = useState<Uploading[]>([]);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<UserAsset | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const upload = useCallback(async (picked: File[]) => {
    const { uploadable: incoming, skipped } = partitionUploadable(picked);
    if (skipped.length > 0) {
      const n = skipped.length;
      toast.info(`Skipped ${n} ${n === 1 ? "file" : "files"} that ${n === 1 ? "isn't" : "aren't"} an image, sound, video, font or Lottie JSON.`);
    }
    // One file gets its own toast; a batch gets one at the end, not one per file.
    const single = incoming.length === 1;
    let uploaded = 0;
    for (const file of incoming) {
      const id = crypto.randomUUID();
      setUploads((prev) => [...prev, { id, name: file.name, progress: 0 }]);
      try {
        const mimeType = uploadMimeType(file);
        const { data, error } = await createAssetUpload({
          fileName: file.name,
          mimeType,
          sizeBytes: file.size,
        });
        if (error || !data) throw new Error(error ?? "Failed to start the upload.");

        await putToPresignedUrl(data.uploadUrl, file, mimeType, (p) =>
          setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, progress: p } : u))),
        );

        const confirmed = await confirmAssetUpload(data.assetId);
        if (confirmed.error || !confirmed.data) throw new Error(confirmed.error ?? "Failed to finish the upload.");
        setListing(confirmed.data);
        uploaded++;
        if (single) toast.success(`Uploaded ${file.name}`);
      } catch (err) {
        toast.error(`${file.name}: ${(err as Error).message}`);
      } finally {
        setUploads((prev) => prev.filter((u) => u.id !== id));
      }
    }
    if (!single && uploaded > 0) toast.success(`Uploaded ${uploaded} ${uploaded === 1 ? "file" : "files"}`);
  }, []);

  const onDelete = useCallback(async (asset: UserAsset) => {
    if (!window.confirm(`Delete ${asset.file_name}? Overlays using it will lose it.`)) return;
    const { data, error } = await deleteAsset(asset.id);
    if (error) {
      toast.error(error);
      return;
    }
    if (data) setListing(data);
    toast.success("File deleted");
  }, []);

  const onCopyUrl = useCallback(async (asset: UserAsset) => {
    await navigator.clipboard.writeText(asset.url);
    toast.success("URL copied");
  }, []);

  const usedPercent =
    listing && listing.quota_bytes > 0 ? Math.min(100, (listing.used_bytes / listing.quota_bytes) * 100) : 0;

  const visibleFiles = (listing?.files ?? []).filter((f) => !kindFilter || kindFilter.includes(f.kind));

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    // Folders in the drop are walked; this has to start inside the handler.
    void filesFromDrop(e.dataTransfer).then((files) => {
      if (files.length > 0) void upload(files);
    });
  };

  return (
    <div className="space-y-4 min-w-0">
      {listing && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Storage</span>
            <span className="tabular-nums">
              {formatBytes(listing.used_bytes)} / {formatBytes(listing.quota_bytes)}
            </span>
          </div>
          <Progress value={usedPercent} className="h-2" />
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 px-6 cursor-pointer transition-all",
          dragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/50 hover:bg-muted/30",
        )}
      >
        <Upload className={cn("h-8 w-8 transition-colors", dragging ? "text-primary" : "text-muted-foreground")} />
        <div className="text-center">
          <p className="text-sm font-medium">Drop files or a folder here, or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">
            Images, sounds, videos, and fonts (.woff2, .woff) for your overlays. Up to 10MB per file.
          </p>
          {!kindFilter || kindFilter.includes("font") ? (
            <p className="text-xs text-muted-foreground mt-1">
              Only upload fonts you have the right to use on stream.
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            folderInputRef.current?.click();
          }}
        >
          <FolderUp className="mr-2 h-4 w-4" />
          Upload a folder
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,audio/*,video/*,.json,.woff,.woff2,font/woff,font/woff2"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void upload(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
        <input
          // webkitdirectory isn't in React's input types; every current
          // browser supports it, so set it on the element directly.
          ref={(el) => {
            folderInputRef.current = el;
            el?.setAttribute("webkitdirectory", "");
          }}
          type="file"
          multiple
          className="hidden"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            if (e.target.files?.length) void upload(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
      </div>

      {uploads.map((u) => (
        <div key={u.id} className="rounded-lg border bg-card p-3 flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-muted-foreground shrink-0 animate-spin" />
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium truncate" title={u.name}>{u.name}</p>
              <span className="text-xs text-muted-foreground tabular-nums">{u.progress}%</span>
            </div>
            <Progress value={u.progress} className="h-1" />
          </div>
        </div>
      ))}

      {!listing || (visibleFiles.length === 0 && uploads.length === 0) ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Nothing here yet</p>
          <p className="text-xs text-muted-foreground">
            Upload alert images, sounds, or videos and use them in any overlay.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleFiles.map((asset) => (
            <div
              key={asset.id}
              onClick={onSelect ? () => onSelect(asset) : undefined}
              className={cn(
                "rounded-lg border bg-card p-3 flex items-center gap-3",
                onSelect && "cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors",
              )}
            >
              {onSelect ? (
                <AssetSummary asset={asset} />
              ) : (
                <button
                  type="button"
                  onClick={() => setPreview(asset)}
                  title="Preview"
                  className="flex flex-1 min-w-0 items-center gap-3 rounded-md text-left hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <AssetSummary asset={asset} />
                </button>
              )}
              {!onSelect && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Copy URL" onClick={() => onCopyUrl(asset)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Delete" onClick={() => onDelete(asset)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <MediaPreviewDialog asset={preview} onOpenChange={(open) => !open && setPreview(null)} onCopyUrl={onCopyUrl} />
    </div>
  );
}
