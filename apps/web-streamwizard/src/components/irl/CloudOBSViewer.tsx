"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, MonitorOff, RefreshCw } from "lucide-react";
import { Button } from "@repo/ui";

type VncStatus = "connecting" | "connected" | "disconnected" | "error";

const RETRY_DELAY_MS = 3000;
const MAX_AUTO_RETRIES = 30; // ~90 seconds of waiting

// getWsUrl mints a fresh single-use ws-ticket and returns the full WS URL. It's
// called once per connection attempt (including every retry) because a ticket
// can't be reused -- see lib/ws-ticket.ts.
export function CloudOBSViewer({ getWsUrl }: { getWsUrl: () => Promise<string> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<VncStatus>("connecting");
  const [attempt, setAttempt] = useState(0);
  // Retry count lives in a ref, not state: it has to survive the effect re-runs
  // that each retry triggers, and we mutate it from inside an event handler
  // rather than a setState updater (updaters must stay pure -- the old code
  // scheduled the retry timer inside one, which double-fired under StrictMode).
  const retryCountRef = useRef(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // When the tab is backgrounded the browser throttles requestAnimationFrame,
  // so noVNC stops painting -- but the socket keeps streaming full-desktop OBS
  // frames into its render queue, which then grows without bound (the "10 GB
  // over time" leak). Track visibility and drop the connection while hidden.
  const [visible, setVisible] = useState(() => typeof document === "undefined" || !document.hidden);

  useEffect(() => {
    const onVisibility = () => {
      const isVisible = !document.hidden;
      if (isVisible) retryCountRef.current = 0; // give a backgrounded-then-reopened tab a full retry budget
      setVisible(isVisible);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    // While hidden we deliberately hold no socket; the previous run's cleanup
    // has already disconnected. Reconnect happens when `visible` flips back.
    if (!visible) return;

    const container = containerRef.current;
    if (!container) return;

    let rfb: import("@novnc/novnc").default | undefined;
    let cancelled = false;
    let wasConnected = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    setStatus("connecting");
    setErrorMessage(null);

    Promise.all([import("@novnc/novnc"), getWsUrl()]).then(([{ default: RFB }, wsUrl]) => {
      if (cancelled) return;

      rfb = new RFB(container, wsUrl);
      rfb.scaleViewport = true;
      rfb.resizeSession = false;

      rfb.addEventListener("connect", () => {
        if (cancelled) return;
        wasConnected = true;
        setStatus("connected");
        retryCountRef.current = 0;
      });

      rfb.addEventListener("disconnect", (event: Event) => {
        if (cancelled) return;

        if (wasConnected) {
          setStatus("disconnected");
          return;
        }

        // Before we ever connect, both clean and unclean closes mean the VNC
        // port isn't ready yet (the proxy closes uncleanly when it can't reach
        // the container). Auto-retry until MAX_AUTO_RETRIES before giving up.
        retryCountRef.current += 1;
        if (retryCountRef.current >= MAX_AUTO_RETRIES) {
          setStatus("error");
          setErrorMessage("OBS didn't start in time. The instance may have crashed.");
          return;
        }
        retryTimer = setTimeout(() => {
          if (!cancelled) setAttempt((a) => a + 1);
        }, RETRY_DELAY_MS);
      });

      rfb.addEventListener("securityfailure", (event: Event) => {
        if (cancelled) return;
        const { reason } = (event as CustomEvent<{ reason?: string }>).detail;
        setStatus("error");
        setErrorMessage(reason ?? "Authentication failed.");
      });

      rfb.addEventListener("clipboard", (event: Event) => {
        const text = (event as CustomEvent<{ text: string }>).detail.text;
        navigator.clipboard.writeText(text).catch(() => {});
      });
    }).catch(() => {
      if (cancelled) return;
      setStatus("error");
      setErrorMessage("Couldn't get a connection ticket. Please try again.");
    });

    const pushLocalClipboard = () => {
      navigator.clipboard
        .readText()
        .then((text) => rfb?.clipboardPasteFrom(text))
        .catch(() => {});
    };
    container.addEventListener("focusin", pushLocalClipboard);
    window.addEventListener("focus", pushLocalClipboard);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      container.removeEventListener("focusin", pushLocalClipboard);
      window.removeEventListener("focus", pushLocalClipboard);
      rfb?.disconnect();
    };
    // `attempt` is intentionally included so incrementing it re-runs this effect
    // and creates a fresh RFB connection (used for both auto-retry and manual
    // retry). `visible` re-runs it to drop/restore the socket on tab visibility.
  }, [getWsUrl, attempt, visible]);

  const handleManualRetry = () => {
    retryCountRef.current = 0;
    setAttempt((a) => a + 1);
  };

  return (
    <div className="relative h-full w-full">
      {/* noVNC mounts its canvas here — always in the DOM so RFB has a stable target */}
      <div ref={containerRef} className="h-full w-full" />

      {!visible && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 backdrop-blur-sm">
          <MonitorOff className="h-7 w-7 text-white/40" />
          <p className="text-sm font-medium text-white">Paused while this tab is in the background.</p>
          <p className="text-xs text-white/40">Switch back to reconnect.</p>
        </div>
      )}

      {visible && status === "connecting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 backdrop-blur-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
            <Loader2 className="h-7 w-7 animate-spin text-white/60" />
          </div>
          <p className="text-sm font-medium text-white">OBS is starting up.</p>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/30"
                style={{ animationDelay: `${i * 200}ms` }}
              />
            ))}
          </div>
        </div>
      )}

      {visible && status === "disconnected" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/95 backdrop-blur-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
            <MonitorOff className="h-7 w-7 text-white/40" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white">OBS stopped.</p>
            <p className="mt-1 text-xs text-white/40">The instance was shut down.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => window.close()}>
              Close
            </Button>
            <Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={handleManualRetry}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Reconnect
            </Button>
          </div>
        </div>
      )}

      {visible && status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/95 backdrop-blur-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white">Couldn&apos;t connect.</p>
            {errorMessage && <p className="mt-1 max-w-xs text-xs text-white/40">{errorMessage}</p>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => window.close()}>
              Close
            </Button>
            <Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={handleManualRetry}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Try again
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
