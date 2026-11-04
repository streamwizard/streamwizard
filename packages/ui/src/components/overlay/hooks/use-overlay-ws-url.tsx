"use client";

import { createContext, useContext, type ReactNode } from "react";

// The ws-server URL the live widgets subscribe to. The host app fills it from
// its own env (NEXT_PUBLIC_WS_SERVER_URL); @repo/ui reads no environment.
// Without a provider it is "", and widgets don't connect.
const OverlayWsUrlContext = createContext("");

export function OverlayWsUrlProvider({ url, children }: { url: string | undefined; children: ReactNode }) {
  return <OverlayWsUrlContext.Provider value={url ?? ""}>{children}</OverlayWsUrlContext.Provider>;
}

/** The ws-server URL for live widget rooms, or "" when the host app set none. */
export function useOverlayWsUrl(): string {
  return useContext(OverlayWsUrlContext);
}
