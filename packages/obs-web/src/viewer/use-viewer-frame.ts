"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createReconnectGuard } from "./reconnect-guard";
import { waitForViewer } from "./readiness";
import { parseRelayMessage, type ViewerCommand } from "./relay-protocol";

// Runs one framed viewer: wait for the node, mint a ticket, frame the node's
// Selkies page, pair with the relay OIM serves in it, and load a new frame
// with a new ticket whenever the relay says the viewer session expired.

export type ViewerPhase =
  | { kind: "starting" }
  | { kind: "connecting" }
  | { kind: "connected" }
  | { kind: "reconnecting" }
  | { kind: "error"; message: string };

/** "pending" until the relay answers; "absent" for a node without one (older OIM). */
export type RelayState = "pending" | "paired" | "absent";

// How long a loaded frame may stay silent before we treat the node as one
// without a relay: frame only, no controls.
const PAIR_TIMEOUT_MS = 5_000;

const ERRORS = {
  timeout: "OBS didn't start in time. Try again, or restart the instance from your dashboard.",
  mint: "Couldn't open the OBS desktop. Try again?",
  looping: "The viewer keeps losing its connection. Reconnect to try again.",
};

// A minted URL must point at the trusted viewer root, so a bad mint can't
// frame some other page.
function isViewerUrl(url: string, viewerRoot: URL): boolean {
  try {
    const parsed = new URL(url);
    return parsed.origin === viewerRoot.origin && parsed.pathname === viewerRoot.pathname && parsed.hash.length > 1;
  } catch {
    return false;
  }
}

export function useViewerFrame({ viewerRoot, getViewerUrl }: { viewerRoot: string; getViewerUrl: () => Promise<string> }) {
  const root = new URL(viewerRoot);
  const nodeOrigin = root.origin;

  const [phase, setPhase] = useState<ViewerPhase>({ kind: "starting" });
  const [frame, setFrame] = useState<{ key: number; src: string } | null>(null);
  const [relay, setRelay] = useState<RelayState>("pending");
  const [video, setVideo] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  const frameRef = useRef<HTMLIFrameElement>(null);
  const runRef = useRef<AbortController | null>(null);
  const pairTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guardRef = useRef(createReconnectGuard());
  const relayRef = useRef<RelayState>("pending");
  const audioRef = useRef({ muted: false, volume: 1 });

  const post = useCallback(
    (command: ViewerCommand) => frameRef.current?.contentWindow?.postMessage(command, nodeOrigin),
    [nodeOrigin],
  );

  const send = useCallback(
    (command: Exclude<ViewerCommand, { type: "sw-hello" }>) => {
      if (relayRef.current === "paired") post(command);
    },
    [post],
  );

  const markRelay = useCallback((state: RelayState) => {
    relayRef.current = state;
    setRelay(state);
  }, []);

  const clearTimers = useCallback(() => {
    if (pairTimerRef.current) clearTimeout(pairTimerRef.current);
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    pairTimerRef.current = null;
    reconnectTimerRef.current = null;
  }, []);

  // One open: wait for the node, mint, frame. A new call cancels the last.
  const open = useCallback(
    async (kind: "starting" | "reconnecting") => {
      runRef.current?.abort();
      const run = new AbortController();
      runRef.current = run;
      clearTimers();
      setPhase({ kind });

      const ready = await waitForViewer(viewerRoot, { signal: run.signal });
      if (run.signal.aborted) return;
      if (!ready) {
        setPhase({ kind: "error", message: ERRORS.timeout });
        return;
      }

      let url: string;
      try {
        url = await getViewerUrl();
      } catch {
        if (!run.signal.aborted) setPhase({ kind: "error", message: ERRORS.mint });
        return;
      }
      if (run.signal.aborted) return;
      if (!isViewerUrl(url, new URL(viewerRoot))) {
        setPhase({ kind: "error", message: ERRORS.mint });
        return;
      }

      markRelay("pending");
      setVideo(false);
      setAudioBlocked(false);
      // A new key mounts a new <iframe>: a new ticket needs a fresh page load
      // (Selkies reads the token for its socket once per page).
      setFrame((prev) => ({ key: (prev?.key ?? 0) + 1, src: url }));
      setPhase({ kind: "connecting" });
    },
    [viewerRoot, getViewerUrl, clearTimers, markRelay],
  );

  const reconnect = useCallback(() => {
    guardRef.current.reset();
    void open("reconnecting");
  }, [open]);

  // Every load of the frame (including the node's own "OBS is starting"
  // refreshes) gets a hello; the relay answers sw-ready.
  const onFrameLoad = useCallback(() => {
    post({ type: "sw-hello" });
    if (pairTimerRef.current) clearTimeout(pairTimerRef.current);
    pairTimerRef.current = setTimeout(() => {
      if (relayRef.current !== "pending") return;
      markRelay("absent");
      setPhase((p) => (p.kind === "connecting" ? { kind: "connected" } : p));
    }, PAIR_TIMEOUT_MS);
  }, [post, markRelay]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const message = parseRelayMessage(event, { origin: nodeOrigin, source: frameRef.current?.contentWindow });
      if (!message) return;
      switch (message.type) {
        case "sw-ready":
          markRelay("paired");
          // A new frame starts unmuted at full volume; keep the user's choice.
          if (audioRef.current.muted) post({ type: "setMute", value: true });
          if (audioRef.current.volume !== 1) post({ type: "setVolume", value: audioRef.current.volume });
          setPhase((p) => (p.kind === "connecting" ? { kind: "connected" } : p));
          break;
        case "pipelineStatusUpdate":
          if (message.video !== undefined) setVideo(message.video);
          break;
        case "audio-state":
          setAudioBlocked(message.blocked);
          break;
        case "viewer-expired": {
          const decision = guardRef.current.next();
          if (decision.action === "stop") {
            runRef.current?.abort();
            setPhase({ kind: "error", message: ERRORS.looping });
          } else if (decision.action === "now") {
            void open("reconnecting");
          } else {
            setPhase({ kind: "reconnecting" });
            reconnectTimerRef.current = setTimeout(() => void open("reconnecting"), decision.ms);
          }
          break;
        }
        case "clientRoleUpdate":
          break;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [nodeOrigin, open, post, markRelay]);

  useEffect(() => {
    // Also cut here, before the node page loads, for a window opened some
    // other way than openViewerWindow: a frame can reach top.opener.
    window.opener = null;
    void open("starting");
    return () => {
      runRef.current?.abort();
      clearTimers();
    };
  }, [open, clearTimers]);

  const toggleMute = useCallback(() => {
    const next = !audioRef.current.muted;
    audioRef.current.muted = next;
    setMuted(next);
    send({ type: "setMute", value: next });
  }, [send]);

  const changeVolume = useCallback(
    (value: number) => {
      const next = Math.min(1, Math.max(0, value));
      audioRef.current.volume = next;
      setVolume(next);
      send({ type: "setVolume", value: next });
      if (audioRef.current.muted && next > 0) {
        audioRef.current.muted = false;
        setMuted(false);
        send({ type: "setMute", value: false });
      }
    },
    [send],
  );

  const enterFullscreen = useCallback(() => {
    frameRef.current?.requestFullscreen().catch(() => {});
  }, []);

  return {
    phase,
    frame,
    frameRef,
    onFrameLoad,
    relay,
    video,
    audioBlocked,
    muted,
    volume,
    toggleMute,
    changeVolume,
    enterFullscreen,
    reconnect,
  };
}
