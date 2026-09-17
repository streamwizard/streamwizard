"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ImageUp, Loader2, Pencil, Undo2 } from "lucide-react";
import { BANNER_RECOMMENDED_SIZE, BANNER_IMAGE_TYPES, validateBannerImage, type BannerElement as Banner } from "@repo/discord-message";
import { cn } from "../../lib/utils";
import { REVEAL } from "./element-shell";
import { ToolbarButton } from "./toolbar-button";

interface BannerElementProps {
  banner: Banner;
  /** The banner's own upload, else the theme's image. */
  imageUrl: string | undefined;
  disabled?: boolean;
  onChange: (patch: Partial<Pick<Banner, "text" | "image">>) => void;
  onUploadImage?: (file: File) => Promise<string>;
}

const { width, height } = BANNER_RECOMMENDED_SIZE;

export function BannerElement({ banner, imageUrl, disabled, onChange, onUploadImage }: BannerElementProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editor = useRef<HTMLFormElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const editing = draft !== null;

  // Clicking anywhere outside the input cancels, like Escape.
  useEffect(() => {
    if (!editing) return;
    const cancel = (e: PointerEvent) => {
      if (!editor.current?.contains(e.target as Node)) setDraft(null);
    };
    document.addEventListener("pointerdown", cancel);
    return () => document.removeEventListener("pointerdown", cancel);
  }, [editing]);

  const confirm = () => {
    if (draft !== null) onChange({ text: draft.trim() });
    setDraft(null);
  };

  const upload = async (file: File | undefined) => {
    if (!file || !onUploadImage) return;
    const [issue] = validateBannerImage(file);
    if (issue) return setError(issue.message);
    setError(null);
    setUploading(true);
    try {
      onChange({ image: { url: await onUploadImage(file) } });
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Couldn't upload that image. Try again?");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div
        className="relative w-full max-w-[545px] overflow-hidden rounded-lg bg-[#1e1f22]"
        style={{ aspectRatio: `${width} / ${height}`, containerType: "inline-size" }}
      >
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- theme art or a CDN upload, shown as Discord would
          <img src={imageUrl} alt="" draggable={false} className="absolute inset-0 size-full object-cover" />
        )}

        {editing ? (
          <form
            ref={editor}
            onSubmit={(e) => {
              e.preventDefault();
              confirm();
            }}
            className="absolute inset-0 flex items-center justify-center gap-2 bg-black/45 px-4"
          >
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setDraft(null)}
              placeholder="Banner text"
              aria-label="Banner text"
              className="min-w-0 flex-1 rounded-md border border-white/30 bg-black/50 px-3 py-1.5 text-center text-xl font-extrabold text-white outline-none placeholder:text-white/50 focus:border-white"
            />
            <ToolbarButton type="submit" label="Save banner text" className="size-9 text-white" style={{ backgroundColor: "#248046" }}>
              <Check />
            </ToolbarButton>
          </form>
        ) : (
          <p
            className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-[clamp(0.75rem,6.5cqw,2.25rem)] font-extrabold uppercase tracking-wide text-white [text-shadow:0_2px_8px_rgb(0_0_0/0.65)]">
            <span className="line-clamp-2">{banner.text}</span>
          </p>
        )}

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-white" role="status">
            <Loader2 className="size-5 animate-spin" />
            <span className="sr-only">Uploading</span>
          </div>
        )}

        {!editing && !uploading && (
          <div className={cn("absolute right-2 top-2 flex gap-1", REVEAL)}>
            <ToolbarButton label="Edit banner text" disabled={disabled} onClick={() => setDraft(banner.text)}>
              <Pencil />
            </ToolbarButton>
            <ToolbarButton
              label={onUploadImage ? `Upload an image (${width}x${height}px, png, jpg or gif)` : "Image uploads aren't set up here"}
              disabled={disabled || !onUploadImage}
              onClick={() => fileInput.current?.click()}
            >
              <ImageUp />
            </ToolbarButton>
            {banner.image && (
              <ToolbarButton label="Go back to the theme image" disabled={disabled} onClick={() => onChange({ image: null })}>
                <Undo2 />
              </ToolbarButton>
            )}
          </div>
        )}
        <input
          ref={fileInput}
          type="file"
          accept={Object.keys(BANNER_IMAGE_TYPES).join(",")}
          className="hidden"
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-[#ffb3b5]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
