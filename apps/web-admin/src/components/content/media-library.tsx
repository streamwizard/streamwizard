"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Images, Pencil, Search, SearchX, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Checkbox,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Input,
  Label,
  Textarea,
} from "@repo/ui";
import { deleteCmsAssetAction, updateCmsAssetAction } from "@/actions/cms-media";
import { TicketFiltersForm } from "@/components/discord/ticket-filters-form";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/widgets/responsive-dialog";
import { PageHeader } from "@/components/widgets/page-header";
import { MAX_ALT_LENGTH } from "@/lib/cms/media";
import type { CmsMediaItem } from "@/lib/cms/media-items";
import { formatBytes } from "@/lib/users";
import { ConfirmButton } from "./confirm-button";
import { FormField } from "./form-field";
import { ImageUploadDialog } from "./image-upload-dialog";

interface MediaLibraryProps {
  items: CmsMediaItem[];
  total: number;
  page: number;
  pageSize: number;
  search?: string;
  uploadsEnabled: boolean;
}

function AltDialog({ item, onClose }: { item: CmsMediaItem; onClose: (saved: boolean) => void }) {
  const uid = useId();
  const [alt, setAlt] = useState(item.alt);
  const [decorative, setDecorative] = useState(item.decorative);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const result = await updateCmsAssetAction(item.id, { alt, decorative });
      if (result.error) return void toast.error(result.error);
      toast.success("Alt text saved.");
      onClose(true);
    });

  return (
    <ResponsiveDialog open onOpenChange={(open) => !open && onClose(false)}>
      <ResponsiveDialogContent className="sm:max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Alt text</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Live posts pick up the change the next time you update them.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        {/* eslint-disable-next-line @next/next/no-img-element -- CDN thumbnail in an internal tool */}
        <img src={item.url} alt="" className="max-h-48 w-full rounded-md border bg-muted object-contain" />
        <FormField label="Alt text" htmlFor={`${uid}-alt`}>
          <Textarea
            id={`${uid}-alt`}
            value={decorative ? "" : alt}
            maxLength={MAX_ALT_LENGTH}
            disabled={decorative}
            onChange={(event) => setAlt(event.target.value)}
          />
        </FormField>
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${uid}-decorative`}
            checked={decorative}
            onCheckedChange={(checked) => setDecorative(checked === true)}
          />
          <Label htmlFor={`${uid}-decorative`}>Decorative (screen readers skip it)</Label>
        </div>
        <ResponsiveDialogFooter>
          <Button variant="ghost" onClick={() => onClose(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || (!decorative && !alt.trim())}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function MediaCard({ item, onEdit, onChanged }: { item: CmsMediaItem; onEdit: () => void; onChanged: () => void }) {
  const [pending, start] = useTransition();

  const remove = () =>
    start(async () => {
      const result = await deleteCmsAssetAction(item.id);
      if (result.error) return void toast.error(result.error);
      toast.success("Deleted.");
      onChanged();
    });

  const copy = async () => {
    await navigator.clipboard.writeText(item.url);
    toast.success("URL copied.");
  };

  return (
    <li className="flex flex-col overflow-hidden rounded-lg border bg-card">
      {/* eslint-disable-next-line @next/next/no-img-element -- CDN thumbnail in an internal tool */}
      <img src={item.url} alt={item.alt} loading="lazy" className="aspect-video w-full bg-muted object-contain" />
      <div className="flex flex-1 flex-col gap-1.5 p-3 text-sm">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate font-medium" title={item.fileName}>
            {item.fileName}
          </span>
          {item.unused && (
            <Badge variant="outline" className="shrink-0 text-xs">
              Unused
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          {item.width && item.height ? `${item.width} × ${item.height} · ` : ""}
          {formatBytes(item.sizeBytes)}
        </p>
        <p className={item.decorative ? "text-xs italic text-muted-foreground" : "line-clamp-2 text-xs"}>
          {item.decorative ? "Decorative" : item.alt}
        </p>
        <div className="mt-auto flex items-center gap-1 pt-1">
          <Button variant="ghost" size="sm" className="h-11 md:h-8" onClick={onEdit}>
            <Pencil aria-hidden />
            Alt text
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-11 md:size-8"
            onClick={copy}
            aria-label={`Copy URL of ${item.fileName}`}
          >
            <Copy />
          </Button>
          {item.unused && (
            <ConfirmButton
              title={`Delete ${item.fileName}?`}
              description="Nothing uses it. It's removed from the CDN too. You can't undo this."
              onConfirm={remove}
            >
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto size-11 md:size-8"
                disabled={pending}
                aria-label={`Delete ${item.fileName}`}
              >
                <Trash2 />
              </Button>
            </ConfirmButton>
          )}
        </div>
      </div>
    </li>
  );
}

/** Every CMS image: covers, inline images, OG images and avatars. */
export function MediaLibrary({ items, total, page, pageSize, search, uploadsEnabled }: MediaLibraryProps) {
  const router = useRouter();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<CmsMediaItem | null>(null);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const refresh = () => router.refresh();

  const pageHref = (target: number) => {
    const next = new URLSearchParams();
    if (search) next.set("q", search);
    next.set("page", String(target));
    return `/content/media?${next}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Media"
        description="Images for blog posts, guides and author avatars. Unused ones can be deleted."
      >
        <Button className="h-11 md:h-9" onClick={() => setUploadOpen(true)} disabled={!uploadsEnabled}>
          <Upload aria-hidden />
          Upload
        </Button>
      </PageHeader>

      {!uploadsEnabled && (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Uploads need R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ASSETS_BUCKET and NEXT_PUBLIC_CDN_URL
          in this environment.
        </p>
      )}

      <TicketFiltersForm action="/content/media" className="flex flex-wrap items-center gap-2">
        <Input
          name="q"
          defaultValue={search}
          placeholder="File name or alt text"
          aria-label="Search images"
          className="h-11 basis-full md:h-9 lg:basis-64 lg:flex-1"
        />
        <Button type="submit" variant="secondary" className="h-11 md:h-9">
          <Search aria-hidden />
          Search
        </Button>
        {search && (
          <Button variant="ghost" className="h-11 md:h-9" asChild>
            <Link href="/content/media">Clear</Link>
          </Button>
        )}
      </TicketFiltersForm>

      {items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">{search ? <SearchX /> : <Images />}</EmptyMedia>
            <EmptyTitle>{search ? "No images match" : "No images yet"}</EmptyTitle>
            <EmptyDescription>
              {search ? "Try a shorter search." : "Upload a cover or a screenshot to get started."}
            </EmptyDescription>
          </EmptyHeader>
          {search && (
            <EmptyContent>
              <Button variant="outline" className="h-11 md:h-8" asChild>
                <Link href="/content/media">Clear search</Link>
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {items.map((item) => (
            <MediaCard key={item.id} item={item} onEdit={() => setEditing(item)} onChanged={refresh} />
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <nav className="flex flex-wrap items-center justify-between gap-2 text-sm" aria-label="Pagination">
          <span className="text-muted-foreground tabular-nums">
            {total} image{total === 1 ? "" : "s"}
            {pages > 1 && ` · page ${page} of ${pages}`}
          </span>
          {pages > 1 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-11 md:h-8" asChild={page > 1} disabled={page <= 1}>
                {page > 1 ? <Link href={pageHref(page - 1)}>Previous</Link> : <span>Previous</span>}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-11 md:h-8"
                asChild={page < pages}
                disabled={page >= pages}
              >
                {page < pages ? <Link href={pageHref(page + 1)}>Next</Link> : <span>Next</span>}
              </Button>
            </div>
          )}
        </nav>
      )}

      <ImageUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} purpose="content" onUploaded={refresh} />
      {editing && (
        <AltDialog
          item={editing}
          onClose={(saved) => {
            setEditing(null);
            if (saved) refresh();
          }}
        />
      )}
    </div>
  );
}
