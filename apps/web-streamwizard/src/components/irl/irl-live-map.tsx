"use client";

import dynamic from "next/dynamic";
import { useIrlGeoData, type IrlConnectionStatus, type GeoPayload } from "@repo/ui/overlay";
import { MapMarker, MarkerContent, MapControls } from "@/components/ui/map";

const Map = dynamic(() => import("@/components/ui/map").then((m) => m.Map), { ssr: false });
import { Wifi, WifiOff, Loader2, TriangleAlert, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  subscriberToken: string;
  mapHeight?: string;
}

export function IrlLiveMap({ subscriberToken, mapHeight = "h-[380px]" }: Props) {
  const { geo, status } = useIrlGeoData(subscriberToken, false);

  const isLive = status === "connected" && geo !== null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <StatusBadge status={status} hasGeo={geo !== null} />
      </div>

      <div className={cn("relative rounded-xl overflow-hidden border", mapHeight)}>
        {isLive ? (
          <Map
            center={[geo.longitude, geo.latitude]}
            zoom={14}
            className="h-full w-full"
          >
            <MapControls position="top-right" showZoom showCompass showFullscreen />
            <MapMarker latitude={geo.latitude} longitude={geo.longitude}>
              <MarkerContent>
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary ring-4 ring-primary/30" />
              </MarkerContent>
            </MapMarker>
          </Map>
        ) : (
          <WaitingOverlay status={status} />
        )}
      </div>

      {isLive && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-600 dark:text-green-400">
            <CircleCheck className="h-3.5 w-3.5 shrink-0" />
            <span>Everything is working — your location is streaming live to your overlays.</span>
          </div>
          {geo.accuracy > 50 && (
            <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-600 dark:text-yellow-400">
              <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
              <span>
                Poor GPS accuracy ({geo.accuracy.toFixed(0)} m) — you&apos;re probably indoors. Location tracking works much better when you&apos;re live outside.
              </span>
            </div>
          )}
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground px-1">
            {geo.speed != null && (
              <span><span className="font-medium text-foreground">{(geo.speed * 3.6).toFixed(1)}</span> km/h</span>
            )}
            {geo.altitude != null && (
              <span><span className="font-medium text-foreground">{geo.altitude.toFixed(0)}</span> m altitude</span>
            )}
            {geo.heading != null && (
              <span><span className="font-medium text-foreground">{geo.heading.toFixed(0)}°</span> heading</span>
            )}
            <span className={cn("flex items-center gap-1", geo.accuracy <= 10 ? "text-green-600 dark:text-green-400" : geo.accuracy <= 50 ? "text-foreground" : "text-yellow-600 dark:text-yellow-400")}>
              <span className="font-medium">±{geo.accuracy.toFixed(0)} m</span>
            </span>
            <span className="ml-auto">
              <span className="font-medium text-foreground">{geo.latitude.toFixed(5)}</span>, <span className="font-medium text-foreground">{geo.longitude.toFixed(5)}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, hasGeo }: { status: IrlConnectionStatus; hasGeo: boolean }) {
  if (status === "connected" && hasGeo) {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        Live
      </span>
    );
  }
  if (status === "connected") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-blue-500">
        <Wifi className="h-3.5 w-3.5" />
        Connected — waiting for GPS
      </span>
    );
  }
  if (status === "offline") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <WifiOff className="h-3.5 w-3.5" />
        Device offline
      </span>
    );
  }
  if (status === "connecting") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Connecting…
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <WifiOff className="h-3.5 w-3.5" />
      Disconnected
    </span>
  );
}

function WaitingOverlay({ status }: { status: IrlConnectionStatus }) {
  const isConnected = status === "connected";

  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-3 bg-muted/40">
      {isConnected ? (
        <Wifi className="h-6 w-6 text-muted-foreground/50" />
      ) : status === "offline" ? (
        <WifiOff className="h-6 w-6 text-muted-foreground/50" />
      ) : (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      )}
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-muted-foreground">
          {isConnected
            ? "Waiting for GPS signal"
            : status === "offline"
            ? "Device offline"
            : "Waiting for connection"}
        </p>
        <p className="text-xs text-muted-foreground/60">
          {isConnected
            ? "Connected — the map will appear once your phone starts sending location data."
            : status === "offline"
            ? "The IRL collector disconnected. Map will resume when it reconnects."
            : "Open the collector URL in IRL Pro to start streaming your location."}
        </p>
      </div>
    </div>
  );
}
