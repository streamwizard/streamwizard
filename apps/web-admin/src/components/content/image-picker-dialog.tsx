"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button, Input } from "@repo/ui";
import { listCmsMediaAction } from "@/actions/cms-media";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/widgets/responsive-dialog";
import type { CmsUploadPurpose } from "@/lib/cms/media";
import type { CmsMediaItem } from "@/lib/cms/media-items";
import { ImageUploadDialog } from "./image-upload-dialog";

interface ImagePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purpose: CmsUploadPurpose;
  defaultAlt?: string;
  onPick: (asset: CmsMediaItem) => void;
}

/** Choose an image from the media library, or upload a new one. */
export function ImagePickerDialog({ open, onOpenChange, purpose, defaultAlt, onPick }: ImagePickerDialogProps) {
  const [items, setItems] = useState<CmsMediaItem[]>([]);
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [loading, start] = useTransition();

  const load = useCallback(
    (term: string) =>
      start(async () => {
        const result = await listCmsMediaAction(1, term);
        if (result.error) return void toast.error(result.error);
        setItems(result.items);
      }),
    [],
  );

  useEffect(() => {
    if (open) load("");
  }, [open, load]);

  const pick = (asset: CmsMediaItem) => {
    onPick(asset);
    onOpenChange(false);
  };

  return (
    <>
      <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
        <ResponsiveDialogContent className="sm:max-w-2xl">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Choose an image</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Newest first. Upload one if it isn&apos;t here yet.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              load(search);
            }}
          >
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="File name or alt text"
              aria-label="Search images"
            />
            <Button type="submit" variant="secondary" disabled={loading}>
              <Search aria-hidden />
              Search
            </Button>
            <Button type="button" onClick={() => setUploadOpen(true)}>
              <Upload aria-hidden />
              Upload
            </Button>
          </form>

          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{loading ? "Loading…" : "No images yet."}</p>
          ) : (
            <ul className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => pick(item)}
                    className="group block w-full overflow-hidden rounded-md border text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- CDN thumbnail in an internal tool */}
                    <img src={item.url} alt={item.alt} className="aspect-video w-full bg-muted object-contain" />
                    <span className="block truncate px-2 py-1.5 text-xs text-muted-foreground group-hover:text-foreground">
                      {item.alt || item.fileName}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ImageUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        purpose={purpose}
        defaultAlt={defaultAlt}
        onUploaded={pick}
      />
    </>
  );
}
