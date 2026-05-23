"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { GeoPayload } from "../types";

// undefined = no IrlGeoProvider in the tree (OBS mode → use WebSocket)
// null      = provider present but GPS not yet acquired (phone mode, waiting)
// GeoPayload = provider present with live GPS data
const IrlGeoContext = createContext<GeoPayload | null | undefined>(undefined);

export function IrlGeoProvider({
  geo,
  children,
}: {
  geo: GeoPayload | null;
  children: ReactNode;
}) {
  return (
    <IrlGeoContext.Provider value={geo}>{children}</IrlGeoContext.Provider>
  );
}

export function useIrlGeoContext(): GeoPayload | null | undefined {
  return useContext(IrlGeoContext);
}
