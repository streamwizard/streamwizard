"use client";

import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { useVideoPlayerStore } from "@/stores/video-dialog-store";
import { useModal } from "@/providers/modal-provider";
import { CreateMarkerModal } from "@/components/modals/create-marker-modal";
import { Scissors, Flag } from "lucide-react";
import { formatDuration } from "@/types/twitch video";
import { useState, type ReactNode } from "react";
import { getSecondsFromPosition } from "./timeline-utils";

interface TimelineContextMenuProps {
  children: ReactNode;
  /** Ref to the timeline track element, used to calculate click offset */
  trackRef: React.RefObject<HTMLDivElement | null>;
  /** Start of the visible time range in seconds */
  viewStart: number;
  /** Duration of the visible time range in seconds */
  visibleDuration: number;
  /** Whether the timeline is interactive */
  disabled?: boolean;
}

/**
 * Context menu wrapper for the video timeline.
 * Right-click opens a menu with "Create Clip Here" and "Add Marker" options.
 * The offset is calculated from where the user right-clicked, NOT the current seeker position.
 */
export function TimelineContextMenu({ children, trackRef, viewStart, visibleDuration, disabled = false }: TimelineContextMenuProps) {
  const startClipCreation = useVideoPlayerStore((s) => s.startClipCreation);
  const { openModal } = useModal();
  const [contextOffset, setContextOffset] = useState(0);

  const handleContextMenu = (e: React.MouseEvent) => {
    // Calculate the time offset from the right-click position on the timeline
    const offset = getSecondsFromPosition(e.clientX, trackRef.current, viewStart, visibleDuration);
    setContextOffset(Math.max(0, offset));
  };

  const handleCreateClip = () => {
    if (disabled) return;
    startClipCreation(contextOffset);
  };

  const handleAddMarker = () => {
    if (disabled) return;
    const timestamp = formatDuration(contextOffset);
    openModal(<CreateMarkerModal timestamp={timestamp} />);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={handleContextMenu}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuLabel className="font-mono text-xs text-muted-foreground">{formatDuration(contextOffset)}</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleCreateClip} disabled={disabled}>
          <Scissors className="h-4 w-4 text-purple-500" />
          Create Clip Here
        </ContextMenuItem>
        <ContextMenuItem onClick={handleAddMarker} disabled={disabled}>
          <Flag className="h-4 w-4 text-orange-500" />
          Add Marker
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
