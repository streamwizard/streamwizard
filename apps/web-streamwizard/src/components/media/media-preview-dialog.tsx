"use client";

import { Copy, FileJson } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import type { UserAsset } from "@/actions/assets";
import { formatBytes } from "@/lib/format";
import { uploadedFontRef } from "@repo/ui/overlay";
import { useGoogleFont } from "@/hooks/use-google-font";

interface MediaPreviewDialogProps {
  asset: UserAsset | null;
  onOpenChange: (open: boolean) => void;
  onCopyUrl: (asset: UserAsset) => void;
}

function FontPreview({ url }: { url: string }) {
  const ref = uploadedFontRef(url);
  useGoogleFont(ref ?? undefined);
  return (
    <div
      className="rounded-md bg-muted px-6 py-8 text-center text-3xl leading-snug break-words"
      style={ref ? { fontFamily: `"${ref}", sans-serif` } : undefined}
    >
      toastcrumb just followed!
      <p className="mt-3 text-base">ABCDEFGHIJKLM abcdefghijklm 0123456789</p>
    </div>
  );
}

function Preview({ asset }: { asset: UserAsset }) {
  if (asset.kind === "image") {
    return (
      // Plain <img>, same as the list thumbnails: R2 CDN files skip next/image
      // eslint-disable-next-line @next/next/no-img-element
      <img src={asset.url} alt={asset.file_name} className="max-h-[60vh] w-full rounded-md object-contain bg-muted" />
    );
  }
  if (asset.kind === "video") {
    return <video src={asset.url} controls autoPlay className="max-h-[60vh] w-full rounded-md bg-black" />;
  }
  if (asset.kind === "audio") {
    return <audio src={asset.url} controls autoPlay className="w-full" />;
  }
  if (asset.kind === "font") {
    return <FontPreview url={asset.url} />;
  }
  return (
    <div className="flex flex-col items-center gap-2 rounded-md bg-muted py-10 text-center">
      <FileJson className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">No preview for animation files yet. Add it to an overlay to see it move.</p>
    </div>
  );
}

export function MediaPreviewDialog({ asset, onOpenChange, onCopyUrl }: MediaPreviewDialogProps) {
  return (
    <Dialog open={asset !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {asset && (
          <>
            <DialogHeader className="min-w-0">
              <DialogTitle className="truncate pr-6" title={asset.file_name}>
                {asset.file_name}
              </DialogTitle>
              <DialogDescription>
                {formatBytes(asset.size_bytes)} · {asset.kind}
              </DialogDescription>
            </DialogHeader>
            <Preview asset={asset} />
            <DialogFooter>
              <Button variant="outline" onClick={() => onCopyUrl(asset)}>
                <Copy className="mr-2 h-4 w-4" />
                Copy URL
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
