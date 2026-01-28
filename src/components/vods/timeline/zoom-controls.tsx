"use client";

import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVideoDialogStore } from "@/stores/video-dialog-store";

interface ZoomControlsProps {
  clipCenterPoint?: number;
  currentTime: number;
}

/**
 * Zoom controls for the timeline
 */
export function ZoomControls({ clipCenterPoint, currentTime }: ZoomControlsProps) {
  const zoomLevel = useVideoDialogStore((s) => s.zoomLevel);
  const zoomIn = useVideoDialogStore((s) => s.zoomIn);
  const zoomOut = useVideoDialogStore((s) => s.zoomOut);

  const centerPoint = clipCenterPoint ?? currentTime;

  return (
    <div className="flex items-center justify-end gap-2 mb-2">
      <span className="text-xs text-muted-foreground">Zoom: {zoomLevel.toFixed(1)}x</span>
      <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => zoomOut(centerPoint)} disabled={zoomLevel <= 1}>
        <ZoomOut className="h-3 w-3" />
      </Button>
      <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => zoomIn(centerPoint)} disabled={zoomLevel >= 20}>
        <ZoomIn className="h-3 w-3" />
      </Button>
    </div>
  );
}
