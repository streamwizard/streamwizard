"use client";

import { createContext, useContext } from "react";
import { useIngestLiveWs, type LiveStatus, type LiveStreamEntry } from "@/lib/monitor/ingest-live-ws";
import type { IngestNodeLive } from "@repo/types/monitor";

// One monitor WebSocket shared by every live consumer on the /ingest page
// (the realtime panel and the Registered Nodes table) — each component
// calling useIngestLiveWs directly would open its own socket.

type IngestLiveContextValue = {
  /** False when the live monitor isn't set up here — consumers fall back to polled data. */
  configured: boolean;
  status: LiveStatus;
  nodes: IngestNodeLive[];
  fleet: { rxBps: number; txBps: number; nodeCount: number };
  streams: LiveStreamEntry[];
};

const IngestLiveContext = createContext<IngestLiveContextValue>({
  configured: false,
  status: "disconnected",
  nodes: [],
  fleet: { rxBps: 0, txBps: 0, nodeCount: 0 },
  streams: [],
});

export function IngestLiveProvider({
  wsUrl,
  children,
}: {
  /** From monitorWsUrl() on the server; null turns the socket off. */
  wsUrl: string | null;
  children: React.ReactNode;
}) {
  const live = useIngestLiveWs(wsUrl);
  return (
    <IngestLiveContext.Provider value={{ configured: !!wsUrl, ...live }}>
      {children}
    </IngestLiveContext.Provider>
  );
}

export function useIngestLive() {
  return useContext(IngestLiveContext);
}
