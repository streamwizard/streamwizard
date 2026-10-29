"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, X } from "lucide-react";
import { Button } from "@repo/ui";
import { createPreviewLinkAction } from "@/actions/cms-preview";

// The saved draft as the site shows it, next to the editor. It reloads after
// every save (the preview page keeps its scroll position), and asks for a
// fresh one-hour preview link before the old one runs out.

const REFRESH_AFTER_MS = 50 * 60 * 1000;

export function PreviewPane({
  contentId,
  flush,
  reloadKey,
  onClose,
}: {
  contentId: string;
  flush: () => Promise<boolean>;
  /** Changes after every save. */
  reloadKey: number;
  onClose: () => void;
}) {
  const [link, setLink] = useState<{ url: string; at: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const linkAt = useRef(0);

  useEffect(() => {
    // A link is good for an hour: get a new one when this one is getting old.
    if (linkAt.current && Date.now() - linkAt.current < REFRESH_AFTER_MS) return;
    let cancelled = false;
    void (async () => {
      await flush();
      const result = await createPreviewLinkAction(contentId, 1);
      if (cancelled) return;
      if (result.error || !result.url) return setError(result.error ?? "Couldn't make a preview link.");
      linkAt.current = Date.now();
      setError(null);
      setLink({ url: result.url, at: linkAt.current });
    })();
    return () => {
      cancelled = true;
    };
  }, [contentId, flush, reloadKey]);

  return (
    <section aria-label="Preview" className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Preview</p>
        <div className="flex items-center gap-1">
          {link && (
            <Button variant="ghost" size="sm" className="h-11 md:h-8" asChild>
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden />
                New tab
              </a>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-11 md:size-8"
            aria-label="Close the preview"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="rounded-lg border border-destructive/50 p-4 text-sm">
          {error}
        </p>
      ) : link ? (
        <iframe
          // A new key after each save loads the page again with the saved draft.
          key={`${link.at}:${reloadKey}`}
          src={link.url}
          title="Draft preview"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          className="min-h-0 w-full flex-1 rounded-lg border bg-background"
        />
      ) : (
        <div className="flex flex-1 items-center justify-center gap-2 rounded-lg border text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Saving and loading the preview…
        </div>
      )}
    </section>
  );
}
