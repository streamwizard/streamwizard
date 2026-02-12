"use client";

import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { useVideoPlayerStore } from "@/stores/video-dialog-store";
import { getStreamEventDisplayInfo } from "@/lib/utils/stream-events";
import { getEventActions, type EventActionHelpers } from "@/lib/utils/event-actions";
import { formatDuration } from "@/types/twitch video";
import { StreamEvent } from "@/types/stream-events";
import type { ReactNode } from "react";

interface EventContextMenuProps {
  /** The stream event to show actions for */
  event: StreamEvent;
  /** Content to wrap with the context menu */
  children: ReactNode;
}

/**
 * Reusable context menu wrapper for stream events.
 * Shows type-specific actions based on the event-actions registry.
 * Used in both the timeline event markers and the stream events panel.
 */
export function EventContextMenu({ event, children }: EventContextMenuProps) {
  const seek = useVideoPlayerStore((s) => s.seek);
  const startClipCreation = useVideoPlayerStore((s) => s.startClipCreation);

  const displayInfo = getStreamEventDisplayInfo(event);
  const actions = getEventActions(event);
  const offsetSeconds = (event.offset_seconds as number) ?? 0;

  const helpers: EventActionHelpers = {
    seek,
    startClipCreation,
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuLabel className="flex items-center gap-2">
          <span>{displayInfo.label}</span>
          <span className="font-mono text-xs text-muted-foreground ml-auto">{formatDuration(offsetSeconds)}</span>
        </ContextMenuLabel>
        {displayInfo.subtitle && <ContextMenuLabel className="text-xs text-muted-foreground font-normal pt-0 truncate">{displayInfo.subtitle}</ContextMenuLabel>}
        <ContextMenuSeparator />
        {actions.map((action) => (
          <ContextMenuItem key={action.label} onClick={() => action.handler(event, helpers)}>
            <action.icon className="h-4 w-4" />
            {action.label}
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}
