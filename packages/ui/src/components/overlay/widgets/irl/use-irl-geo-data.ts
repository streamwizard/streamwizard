"use client";

// Next.js replaces NEXT_PUBLIC_* at build time; declare process so tsc is happy in this library package.
declare const process: { env: Record<string, string | undefined> };

import { useEffect, useState } from "react";
import type { GeoPayload } from "../../types";
import type { IrlConnectionStatus } from "./irl-ws-store";
import { subscribeToIrlData } from "./irl-ws-store";

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
  const [state, setState] = useState<{ geo: GeoPayload | null; status: IrlConnectionStatus }>(() => ({
    geo: mockData ? MOCK_GEO : null,
    status: mockData ? "connected" : "connecting",
  }));

  useEffect(() => {
    if (mockData) {
      setState({ geo: MOCK_GEO, status: "connected" });
      return;
    }
    if (!subscriberToken) {
      setState({ geo: null, status: "connecting" });
      return;
    }
    const wsUrl = process.env.NEXT_PUBLIC_IRL_WS_URL ?? "ws://localhost:3009";
    return subscribeToIrlData(subscriberToken, wsUrl, (geo, status) => setState({ geo, status }));
  }, [subscriberToken, mockData]);

  return state;
}
