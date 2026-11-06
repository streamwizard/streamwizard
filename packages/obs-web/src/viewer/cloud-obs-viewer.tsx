"use client";

import { useState, type ReactNode } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@repo/ui";
import { ClipboardPanel } from "./clipboard-panel";
import { useViewerFrame } from "./use-viewer-frame";
import { ViewerHeader } from "./viewer-header";

// An instance's OBS desktop: our header and controls around the node's
// Selkies viewer, which runs in a cross-origin <iframe> on the node's own
// origin. Nothing from the container runs next to the user's session here;
// the two pages only talk through the relay OIM serves in the frame
// (relay-protocol.ts).
//
// viewerRoot is the node's viewer page without a ticket
// (`<apiUrl>/instances/:id/selkies/`, see selkiesViewerRoot) and must come
// from a trusted server-side lookup, never the query string: it decides which
// origin we frame and accept messages from. getViewerUrl mints a fresh
// single-use ticket on every call (mintSelkiesViewerUrl); it runs once per
// open and once per reconnect.
export function CloudOBSViewer({
  name,
  logo,
  viewerRoot,
  getViewerUrl,
}: {
  name: string;
  logo?: ReactNode;
  viewerRoot: string;
  getViewerUrl: () => Promise<string>;
}) {
  const viewer = useViewerFrame({ viewerRoot, getViewerUrl });
  const [clipboardOpen, setClipboardOpen] = useState(false);
  const { phase } = viewer;

  return (
    <div className="flex h-screen w-screen flex-col bg-black">
      <ViewerHeader
        name={name}
        logo={logo}
        phase={phase}
        relay={viewer.relay}
        video={viewer.video}
        muted={viewer.muted}
        volume={viewer.volume}
        clipboardOpen={clipboardOpen}
        onToggleMute={viewer.toggleMute}
        onVolume={viewer.changeVolume}
        onToggleClipboard={() => setClipboardOpen((open) => !open)}
        onFullscreen={viewer.enterFullscreen}
        onReconnect={viewer.reconnect}
      />

      <div className="relative min-h-0 flex-1">
        {viewer.frame && (
          <iframe
            key={viewer.frame.key}
            ref={viewer.frameRef}
            src={viewer.frame.src}
            title="OBS desktop"
            onLoad={viewer.onFrameLoad}
            allow="clipboard-read; clipboard-write; autoplay; fullscreen"
            referrerPolicy="no-referrer"
            className="block h-full w-full border-0"
          />
        )}

        {clipboardOpen && viewer.relay === "paired" && (
          <div className="absolute top-3 right-3 z-10">
            <ClipboardPanel fromObs={viewer.clipboard} onSend={viewer.sendClipboard} />
          </div>
        )}

        {(phase.kind === "starting" || (phase.kind === "reconnecting" && !viewer.frame)) && (
          <Overlay>
            <Loader2 className="size-7 animate-spin text-white/60" />
            <p className="text-sm font-medium text-white">OBS is starting.</p>
            <p className="text-xs text-white/50">This usually takes under a minute.</p>
          </Overlay>
        )}

        {phase.kind === "reconnecting" && viewer.frame && (
          <Overlay translucent>
            <Loader2 className="size-7 animate-spin text-white/60" />
            <p className="text-sm font-medium text-white">Reconnecting to OBS…</p>
          </Overlay>
        )}

        {phase.kind === "error" && (
          <Overlay>
            <AlertCircle className="size-7 text-red-400" />
            <p className="max-w-sm text-center text-sm text-white">{phase.message}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                onClick={() => window.close()}
              >
                Close
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                onClick={viewer.reconnect}
              >
                <RefreshCw className="size-3.5" />
                Reconnect
              </Button>
            </div>
          </Overlay>
        )}
      </div>
    </div>
  );
}

function Overlay({ children, translucent = false }: { children: ReactNode; translucent?: boolean }) {
  return (
    <div
      className={`absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 ${translucent ? "bg-black/70" : "bg-black"}`}
    >
      {children}
    </div>
  );
}
