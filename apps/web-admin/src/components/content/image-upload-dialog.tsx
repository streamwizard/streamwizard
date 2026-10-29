"use client";

import { useEffect, useId, useState } from "react";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button, Checkbox, Input, Label, Progress, Textarea } from "@repo/ui";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/widgets/responsive-dialog";
import { CMS_IMAGE_TYPES, MAX_ALT_LENGTH, type CmsUploadPurpose } from "@/lib/cms/media";
import type { CmsMediaItem } from "@/lib/cms/media-items";
import { FormField } from "./form-field";
import { uploadCmsImage } from "./upload-image";

const ACCEPT = Object.keys(CMS_IMAGE_TYPES).join(",");

interface ImageUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purpose: CmsUploadPurpose;
  /** Prefills the alt text (an avatar's is usually the author's name). */
  defaultAlt?: string;
  /** A file that's already chosen (pasted or dropped into the editor): only the alt text is left to write. */
  initialFile?: File;
  onUploaded: (asset: CmsMediaItem) => void;
}

/** Pick a file, write its alt text, upload. Alt text is asked here, once, not afterwards. */
export function ImageUploadDialog(props: ImageUploadDialogProps) {
  // Mounted only while open, so every upload starts from a clean form.
  return props.open ? <UploadForm {...props} /> : null;
}

function UploadForm({ onOpenChange, purpose, defaultAlt = "", initialFile, onUploaded }: ImageUploadDialogProps) {
  const uid = useId();
  const [file, setFile] = useState<File | null>(initialFile ?? null);
  const [preview, setPreview] = useState<string | null>(null);
  const [alt, setAlt] = useState(defaultAlt);
  const [decorative, setDecorative] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  // A data URL rather than a blob URL: nothing to revoke, so a pasted file's
  // preview survives the dialog mounting twice (React dev mode does that).
  useEffect(() => {
    if (!file) return;
    let current = true;
    const reader = new FileReader();
    reader.onload = () => current && setPreview(String(reader.result));
    reader.readAsDataURL(file);
    return () => {
      current = false;
    };
  }, [file]);

  const choose = (next: File | null) => {
    setFile(next);
    if (!next) setPreview(null);
  };

  const uploading = progress !== null;

  const upload = async () => {
    if (!file) return;
    setProgress(0);
    const result = await uploadCmsImage(file, { alt, decorative, purpose, onProgress: setProgress });
    if (result.error || !result.asset) {
      setProgress(null);
      return void toast.error(result.error ?? "Couldn't upload the image.");
    }
    toast.success("Uploaded.");
    onUploaded(result.asset);
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog open onOpenChange={(next) => !uploading && onOpenChange(next)}>
      <ResponsiveDialogContent className="sm:max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Upload an image</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            JPG, PNG, WebP, AVIF or GIF, up to {purpose === "avatar" ? "2" : "8"} MB.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4">
          <FormField
            label="File"
            htmlFor={`${uid}-file`}
            hint={
              initialFile && file === initialFile
                ? `Pasted: ${initialFile.name}. Pick another file to swap it.`
                : undefined
            }
          >
            <Input
              id={`${uid}-file`}
              type="file"
              accept={ACCEPT}
              disabled={uploading}
              onChange={(event) => choose(event.target.files?.[0] ?? null)}
            />
          </FormField>

          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local blob preview, nothing to optimise
            <img src={preview} alt="" className="max-h-56 w-full rounded-md border bg-muted object-contain" />
          ) : (
            <div className="flex h-32 items-center justify-center rounded-md border border-dashed text-muted-foreground">
              <ImagePlus aria-hidden className="size-6" />
            </div>
          )}

          <FormField
            label="Alt text"
            htmlFor={`${uid}-alt`}
            hint="What the image shows, for people using a screen reader. Skip the word “image”."
          >
            <Textarea
              id={`${uid}-alt`}
              autoFocus={initialFile !== undefined}
              value={decorative ? "" : alt}
              maxLength={MAX_ALT_LENGTH}
              disabled={decorative || uploading}
              placeholder="OBS settings window with the Output tab open"
              onChange={(event) => setAlt(event.target.value)}
            />
          </FormField>

          <div className="flex items-start gap-2">
            <Checkbox
              id={`${uid}-decorative`}
              checked={decorative}
              disabled={uploading}
              onCheckedChange={(checked) => setDecorative(checked === true)}
            />
            <div className="grid gap-0.5">
              <Label htmlFor={`${uid}-decorative`}>Decorative</Label>
              <p className="text-xs text-muted-foreground">
                Only for images that add nothing to the text. Screen readers skip them.
              </p>
            </div>
          </div>

          {uploading && <Progress value={progress} aria-label="Upload progress" />}
        </div>

        <ResponsiveDialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={upload} disabled={!file || uploading || (!decorative && !alt.trim())}>
            {uploading ? `Uploading ${progress}%` : "Upload"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
