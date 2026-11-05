"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@repo/ui";

// Opens an instance's OBS desktop. The viewer itself (Selkies: video, audio,
// two-way clipboard) is served by the node, so this window only mints a
// single-use ticket and navigates to the node's viewer URL. The node shows
// its own "OBS is starting" page while the instance boots.
//
// getViewerUrl must mint a fresh ticket on every call: a ticket can't be
// reused (see ws-ticket.ts's mintSelkiesViewerUrl).
export function CloudOBSViewer({ getViewerUrl }: { getViewerUrl: () => Promise<string> }) {
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const open = useCallback(() => {
    setError(null);
    getViewerUrl()
      .then((url) => window.location.replace(url))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Couldn't open the OBS desktop.");
      });
  }, [getViewerUrl]);

  useEffect(() => {
    // StrictMode runs effects twice in dev; one ticket per open is enough.
    if (started.current) return;
    started.current = true;
    open();
  }, [open]);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-white">
        <AlertCircle className="size-6 text-red-400" />
        <p className="max-w-sm text-center text-sm text-red-400">{error}</p>
        <Button size="sm" variant="secondary" onClick={open}>
          <RefreshCw className="size-4" />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center gap-2 text-sm text-white/60">
      <Loader2 className="size-4 animate-spin" />
      Connecting to OBS…
    </div>
  );
}
