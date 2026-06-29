"use client";

import { Monitor } from "lucide-react";
import { Badge } from "@repo/ui";
import { cn } from "@repo/ui";

interface ObsVncPreviewProps {
  instanceId: string | null;
  isConnected: boolean;
  onOpen: () => void;
}

export function ObsVncPreview({ instanceId, isConnected, onOpen }: ObsVncPreviewProps) {
  return (
    <button
      onClick={onOpen}
      disabled={!instanceId}
      className={cn(
        "group relative w-full max-w-xs rounded-xl border-2 bg-black overflow-hidden transition-all",
        instanceId
          ? "border-border cursor-pointer hover:border-primary hover:shadow-lg hover:shadow-primary/10"
          : "border-border/40 cursor-not-allowed opacity-50"
      )}
      style={{ aspectRatio: "16 / 9" }}
    >
      {/* Screen scanline texture */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.15) 2px, rgba(255,255,255,0.15) 4px)",
        }}
      />

      {/* Status badge */}
      <div className="absolute top-2 right-2 z-10">
        {isConnected ? (
          <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0 border-0">
            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-black/60 text-muted-foreground text-[10px] px-1.5 py-0">
            OFFLINE
          </Badge>
        )}
      </div>

      {/* Center icon */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <Monitor
          className={cn(
            "h-10 w-10 transition-transform",
            instanceId ? "text-muted-foreground group-hover:text-primary group-hover:scale-110" : "text-muted-foreground/40"
          )}
        />
        <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
          {instanceId ? "Click to open OBS" : "No running instance"}
        </span>
      </div>

      {/* Bottom bar */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
        <p className="text-[10px] text-muted-foreground/60 truncate">Cloud OBS</p>
      </div>
    </button>
  );
}
