"use client";

import { useState, useTransition } from "react";
import { Copy, Eye, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PREVIEW_DURATIONS_HOURS } from "@repo/cms";
import { Button, NativeSelect, NativeSelectOption } from "@repo/ui";
import {
  createPreviewLinkAction,
  listPreviewLinksAction,
  revokePreviewLinkAction,
  type PreviewLink,
} from "@/actions/cms-preview";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/widgets/responsive-dialog";
import { formatDateTime } from "@/lib/discord/tickets";

const DURATION_LABELS: Record<(typeof PREVIEW_DURATIONS_HOURS)[number], string> = {
  1: "1 hour",
  24: "24 hours",
  168: "7 days",
};

interface PreviewMenuProps {
  contentId: string;
  /** Saves pending edits first, so the preview shows what's on screen. Resolves to false when that failed. */
  flush: () => Promise<boolean>;
}

/** Preview (opens the draft on the site for an hour) and Share (a link for someone else). */
export function PreviewMenu({ contentId, flush }: PreviewMenuProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [links, setLinks] = useState<PreviewLink[]>([]);
  const [hours, setHours] = useState<number>(24);
  const [fresh, setFresh] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const preview = () => {
    // Opened now, filled in later: a window opened after an await counts as a popup.
    const tab = window.open("", "_blank");
    start(async () => {
      if (!(await flush())) {
        tab?.close();
        return void toast.error("Save first: the preview shows the saved draft.");
      }
      const result = await createPreviewLinkAction(contentId, 1);
      if (result.error || !result.url) {
        tab?.close();
        return void toast.error(result.error ?? "Couldn't make a preview link.");
      }
      if (tab) {
        tab.opener = null;
        tab.location.href = result.url;
      } else {
        window.open(result.url, "_blank", "noopener");
      }
    });
  };

  const openShare = () => {
    setFresh(null);
    setShareOpen(true);
    start(async () => {
      const result = await listPreviewLinksAction(contentId);
      if (result.error) return void toast.error(result.error);
      setLinks(result.links);
    });
  };

  const create = () =>
    start(async () => {
      await flush();
      const result = await createPreviewLinkAction(contentId, hours);
      if (result.error || !result.url || !result.link)
        return void toast.error(result.error ?? "Couldn't make a preview link.");
      setFresh(result.url);
      setLinks((current) => [result.link!, ...current]);
      await navigator.clipboard.writeText(result.url).then(
        () => toast.success("Link copied."),
        () => undefined,
      );
    });

  const revoke = (id: string) =>
    start(async () => {
      const result = await revokePreviewLinkAction(contentId, id);
      if (result.error) return void toast.error(result.error);
      setLinks((current) => current.filter((link) => link.id !== id));
      toast.success("Link turned off.");
    });

  return (
    <>
      <Button variant="outline" className="h-11 md:h-9" onClick={preview} disabled={pending}>
        <Eye aria-hidden />
        Preview
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-11 md:size-9"
        onClick={openShare}
        aria-label="Share a preview link"
      >
        <Link2 />
      </Button>

      <ResponsiveDialog open={shareOpen} onOpenChange={setShareOpen}>
        <ResponsiveDialogContent className="sm:max-w-lg">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Share a preview</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Anyone with the link sees the saved draft, without an account. It shows the newest save, not a frozen
              copy.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Works for</span>
              <NativeSelect
                value={String(hours)}
                onChange={(event) => setHours(Number(event.target.value))}
                className="w-36"
              >
                {PREVIEW_DURATIONS_HOURS.map((option) => (
                  <NativeSelectOption key={option} value={String(option)}>
                    {DURATION_LABELS[option]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            <Button onClick={create} disabled={pending}>
              Make link
            </Button>
          </div>

          {fresh && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2 text-xs">
              <code className="min-w-0 flex-1 truncate">{fresh}</code>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 shrink-0"
                aria-label="Copy link"
                onClick={() => navigator.clipboard.writeText(fresh).then(() => toast.success("Link copied."))}
              >
                <Copy />
              </Button>
            </div>
          )}
          {fresh && <p className="text-xs text-muted-foreground">Copy it now: it can&apos;t be shown again.</p>}

          <div className="space-y-2">
            <p className="text-sm font-medium">Links that still work</p>
            {links.length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              <ul className="divide-y rounded-md border text-sm">
                {links.map((link) => (
                  <li key={link.id} className="flex items-center gap-2 px-3 py-2">
                    <span className="flex-1">Until {formatDateTime(link.expiresAt)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9"
                      onClick={() => revoke(link.id)}
                      disabled={pending}
                      aria-label="Turn this link off"
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <ResponsiveDialogFooter>
            <Button variant="ghost" onClick={() => setShareOpen(false)}>
              Done
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
