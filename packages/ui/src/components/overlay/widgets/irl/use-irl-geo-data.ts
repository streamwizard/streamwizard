"use client";

// Next.js replaces NEXT_PUBLIC_* at build time; declare process so tsc is happy in this library package.
declare const process: { env: Record<string, string | undefined> };

import { useEffect, useState } from "react";
import type { GeoPayload } from "../../types";
import { subscribeToWsRoom } from "../../lib/ws-store";
import { useIrlGeoContext } from "../../hooks/use-irl-geo-context";

export type IrlConnectionStatus = "connecting" | "connected" | "offline" | "disconnected";

type IrlMessage =
  | { type: "ws:open" }
  | { type: "ws:close" }
  | { type: "streamwizard.geo"; status: "connected"; payload: GeoPayload }
  | { type: "streamwizard.geo"; status: "offline" };

const MOCK_GEO: GeoPayload = {
  latitude: 52.37403,
  longitude: 4.88969,
  altitude: 14,
  speed: 11.2,
  heading: 247,
  accuracy: 5,
  timestamp: Date.now(),
};

export function useIrlGeoData(
  subscriberToken: string,
  mockData: boolean
): { geo: GeoPayload | null; status: IrlConnectionStatus } {
  const contextGeo = useIrlGeoContext();

  const [state, setState] = useState<{ geo: GeoPayload | null; status: IrlConnectionStatus }>(() => ({
    geo: mockData ? MOCK_GEO : null,
    status: mockData ? "connected" : "connecting",
  }));

  useEffect(() => {
    // When a local geo context is provided (phone render mode), skip the WebSocket.
    if (contextGeo !== undefined) return;

    if (mockData) {
      setState({ geo: MOCK_GEO, status: "connected" });
      return;
    }
    if (!subscriberToken) {
      setState({ geo: null, status: "connecting" });
      return;
    }
    const wsUrl = process.env.NEXT_PUBLIC_WS_SERVER_URL ?? "ws://localhost:3009";
    return subscribeToWsRoom(subscriberToken, wsUrl, (raw) => {
      const msg = raw as IrlMessage;
      if (msg.type === "ws:open") {
        setState((s) => ({ ...s, status: "connected" }));
      } else if (msg.type === "ws:close") {
        setState((s) => ({ ...s, status: "disconnected" }));
      } else if (msg.type === "streamwizard.geo") {
        if (msg.status === "offline") {
          setState((s) => ({ ...s, status: "offline" }));
        } else {
          setState({ geo: msg.payload, status: "connected" });
        }
      }
    });
  }, [subscriberToken, mockData, contextGeo]);

  // Context geo takes priority (phone render mode).
  if (contextGeo !== undefined) {
    return { geo: contextGeo, status: contextGeo ? "connected" : "connecting" };
  }

  return state;
}
