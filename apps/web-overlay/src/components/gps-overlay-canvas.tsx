"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { OverlaySceneCanvas, overlayItemFromDbRow } from "@repo/ui/overlay";
import { IrlGeoProvider } from "@repo/ui/components/overlay/hooks/use-irl-geo-context";
import { ClipsWidgetContainer } from "@/components/widgets/clips-widget/ClipsWidgetContainer";
import { CustomWidgetContainer } from "@/components/widgets/custom-widget/CustomWidgetContainer";

const OVERLAY_WIDGETS = [
  { id: "clips_widget", Component: ClipsWidgetContainer },
  { id: "custom_widget", Component: CustomWidgetContainer },
];
import type { OverlayItemRow, OverlaySceneRow } from "@/types/overlays";

interface GeoPayload {
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  accuracy: number;
  timestamp: number;
}

export function GpsOverlayCanvas({ scene, items }: { scene: OverlaySceneRow; items: OverlayItemRow[] }) {
  const watchIdRef = useRef<number | null>(null);

  const [geo, setGeo] = useState<GeoPayload | null>(null);

  const overlayItems = useMemo(() => items.map(overlayItemFromDbRow), [items]);

  useEffect(() => {
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const payload: GeoPayload = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          altitude: pos.coords.altitude,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        };
        setGeo(payload);
      },
      (err) => console.warn("[geolocation]", err.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 }
    );

    return () => {
      if (watchIdRef.current !== null)
        navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  return (
    <IrlGeoProvider geo={geo}>
      <OverlaySceneCanvas scene={scene} items={overlayItems} widgets={OVERLAY_WIDGETS} />
    </IrlGeoProvider>
  );
}
