"use client";

import { useCallback, useEffect, useRef, useMemo } from "react";
import { TwitchVideo, parseDuration } from "@/types/twitch video";
import { getEventDisplayData, StreamEventType } from "@/types/stream-events";
import type { Database } from "@/types/supabase";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TwitchPlayerComponent, type TwitchPlayer } from "@/components/vods/twitch-player";
import { VideoTimeline, type TimelineEvent } from "./video-timeline";
import { StreamEventsPanel } from "./stream-events-panel";
import { EventTypeFilter } from "./event-type-filter";
import { useEventFilters } from "@/hooks/use-event-filters";
import { useVideoDialogStore } from "@/stores/video-dialog-store";
import { ExternalLink, Eye, Globe, Calendar, Scissors, Play, Pause, Volume2, VolumeX, X, SkipBack } from "lucide-react";

type StreamEvent = Database["public"]["Tables"]["stream_events"]["Row"];

interface VideoDetailsDialogProps {
  video: TwitchVideo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateClip?: (video: TwitchVideo) => void;
}

/**
 * Convert StreamEvent to TimelineEvent for the timeline component
 */
function toTimelineEvent(event: StreamEvent): TimelineEvent {
  const displayData = getEventDisplayData(event);
  const offset = event.offset_seconds || 0;
  const userName = displayData.userName || event.event_type;
  const message = displayData.message;

  return {
    id: event.id,
    offset,
    type: event.event_type as StreamEventType,
    label: userName,
    details: message,
  };
}

/**
 * Modal dialog with interactive Twitch player, timeline, and events panel
 */
export function VideoDetailsDialog({ video, open, onOpenChange }: VideoDetailsDialogProps) {
  // Get state and actions from the store
  const {
    isPlaying,
    isMuted,
    currentTime,
    isPlayerReady,
    playerKey,
    events,
    isLoadingEvents,
    isCreatingClip,
    clipTitle,
    clipStartTime,
    clipEndTime,
    setPlayer,
    setPlayerReady,
    setIsPlaying,
    setCurrentTime,
    incrementPlayerKey,
    togglePlay,
    toggleMute,
    seek,
    fetchEvents,
    setEvents,
    startClipCreation,
    cancelClipCreation,
    setClipTitle,
    setClipSelection,
    saveClip,
    seekToClipStart,
    resetState,
  } = useVideoDialogStore();

  const timeUpdateRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Event type filters
  const { selectedTypes, toggleType, selectAll, deselectAll } = useEventFilters();

  // Filter events based on selected types
  const filteredEvents = useMemo(() => {
    return events.filter((event) => selectedTypes.has(event.event_type as StreamEventType));
  }, [events, selectedTypes]);

  // Reset state and fetch events when dialog opens/closes
  useEffect(() => {
    if (open && video) {
      // Increment key to force a fresh player instance
      incrementPlayerKey();

      // Fetch events if we have a stream_id
      if (video.stream_id) {
        fetchEvents(video.stream_id);
      } else {
        setEvents([]);
      }
    } else {
      resetState();
      if (timeUpdateRef.current) {
        clearInterval(timeUpdateRef.current);
      }
    }
  }, [open, video, incrementPlayerKey, fetchEvents, setEvents, resetState]);

  // Poll for current time while playing
  useEffect(() => {
    const { player } = useVideoDialogStore.getState();

    if (isPlaying && isPlayerReady && player) {
      timeUpdateRef.current = setInterval(() => {
        const time = player.getCurrentTime();
        if (time !== undefined) {
          setCurrentTime(time);
        }
      }, 500);
    } else {
      if (timeUpdateRef.current) {
        clearInterval(timeUpdateRef.current);
      }
    }

    return () => {
      if (timeUpdateRef.current) {
        clearInterval(timeUpdateRef.current);
      }
    };
  }, [isPlaying, isPlayerReady, setCurrentTime]);

  // Clip mode looping: when playback reaches clip end, loop back to clip start
  useEffect(() => {
    if (!isCreatingClip || !isPlaying || !isPlayerReady) return;

    if (currentTime >= clipEndTime) {
      seek(clipStartTime);
    }
  }, [isCreatingClip, isPlaying, isPlayerReady, currentTime, clipStartTime, clipEndTime, seek]);

  // When entering clip mode, seek to clip start
  useEffect(() => {
    if (isCreatingClip && isPlayerReady) {
      seek(clipStartTime);
    }
  }, [isCreatingClip, isPlayerReady]); // Only trigger on mode change

  const handlePlayerReady = useCallback(
    (player: TwitchPlayer) => {
      setPlayer(player);
      setPlayerReady(true);
    },
    [setPlayer, setPlayerReady],
  );

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
  }, [setIsPlaying]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, [setIsPlaying]);

  const handleTimelineEventClick = useCallback(
    (event: TimelineEvent) => {
      seek(event.offset);
    },
    [seek],
  );

  const handleToggleClipCreation = useCallback(() => {
    if (isCreatingClip) {
      cancelClipCreation();
    } else {
      startClipCreation();
    }
  }, [isCreatingClip, cancelClipCreation, startClipCreation]);

  const handleSaveClip = useCallback(async () => {
    const result = await saveClip();

    if (result.success) {
      console.log("Clip created successfully:", result.clipId);
      console.log("Edit URL:", result.editUrl);

      if (result.editUrl) {
        window.open(result.editUrl, "_blank");
      }
    } else {
      console.error("Failed to create clip:", result.error);
      alert(`Failed to create clip: ${result.error}`);
    }
  }, [saveClip]);

  if (!video) return null;

  const createdDate = new Date(video.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const durationSeconds = parseDuration(video.duration);
  const timelineEvents = filteredEvents.map(toTimelineEvent);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[95vw] !h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-4 pb-2 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="line-clamp-1">{video.title}</DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                <span>{video.user_name}</span>
                <Badge variant="secondary" className="capitalize">
                  {video.type}
                </Badge>
                {video.stream_id && (
                  <Badge variant="outline" className="text-xs">
                    Stream: {video.stream_id}
                  </Badge>
                )}
              </DialogDescription>
            </div>
            {events.length > 0 && <EventTypeFilter events={events} selectedTypes={selectedTypes} onToggleType={toggleType} onSelectAll={selectAll} onDeselectAll={deselectAll} />}
          </div>
        </DialogHeader>

        {/* Two-column layout: Video player left, Events right */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left side: Video player and controls */}
          <div className="flex-1 flex flex-col min-w-0 p-4 pt-0 overflow-y-auto">
            {/* Interactive Twitch Player */}
            <div className="relative aspect-video w-full max-h-[50vh] overflow-hidden rounded-lg bg-black shrink-0">
              <TwitchPlayerComponent
                key={`vod-player-${video.id}-${playerKey}`}
                id={`vod-player-${video.id}-${playerKey}`}
                video={video.id}
                width="100%"
                height="100%"
                autoplay={false}
                muted={true}
                onReady={handlePlayerReady}
                onPlay={handlePlay}
                onPause={handlePause}
              />
            </div>

            {/* Custom Controls */}
            <div className="flex items-center gap-2 mt-4">
              <Button variant="outline" size="icon" onClick={togglePlay} disabled={!isPlayerReady}>
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="icon" onClick={toggleMute} disabled={!isPlayerReady}>
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              {isCreatingClip && (
                <Button variant="outline" size="sm" onClick={seekToClipStart} disabled={!isPlayerReady} title="Jump to clip start">
                  <SkipBack className="h-4 w-4 mr-1" />
                  Clip Start
                </Button>
              )}
            </div>

            {/* Custom Timeline */}
            <div className="mt-4">
              <VideoTimeline
                duration={durationSeconds}
                currentTime={currentTime}
                events={timelineEvents}
                onSeek={seek}
                onEventClick={handleTimelineEventClick}
                disabled={!isPlayerReady}
                isClipMode={isCreatingClip}
                clipSelection={isCreatingClip ? { startTime: clipStartTime, endTime: clipEndTime } : undefined}
                onClipSelectionChange={setClipSelection}
                mutedSegments={video.muted_segments}
              />
            </div>

            {/* Video Stats */}
            <div className="grid grid-cols-3 gap-4 text-sm mt-4">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span>{video.view_count.toLocaleString()} views</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="uppercase">{video.language}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{createdDate}</span>
              </div>
            </div>

            {/* Description (if present) */}
            {video.description && <p className="text-sm text-muted-foreground line-clamp-2 mt-4">{video.description}</p>}

            {/* Actions */}
            <div className="pt-4 mt-4 border-t space-y-4">
              {/* Action buttons row */}
              <div className="flex gap-2">
                <Button asChild variant="default">
                  <a href={video.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Watch on Twitch
                  </a>
                </Button>
                <Button variant={isCreatingClip ? "secondary" : "outline"} onClick={handleToggleClipCreation} disabled={!isPlayerReady}>
                  {isCreatingClip ? (
                    <>
                      <X className="mr-2 h-4 w-4" />
                      Cancel Clip
                    </>
                  ) : (
                    <>
                      <Scissors className="mr-2 h-4 w-4" />
                      Create Clip
                    </>
                  )}
                </Button>
              </div>

              {/* Clip Creation Form (timeline is above) */}
              {isCreatingClip && (
                <div className="space-y-4 p-4 rounded-lg bg-muted/50 border">
                  {/* Clip Title */}
                  <div className="space-y-2">
                    <Label htmlFor="clip-title" className="text-sm font-medium">
                      Clip Title
                    </Label>
                    <Input id="clip-title" placeholder="Add a title (required)" value={clipTitle} onChange={(e) => setClipTitle(e.target.value)} className="bg-background" />
                    <p className="text-xs text-muted-foreground">Clips with unique titles get more views. Help {video.user_name} get discovered by adding a title.</p>
                  </div>

                  {/* Save/Cancel buttons */}
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={cancelClipCreation}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveClip} disabled={!clipTitle.trim()} className="bg-purple-600 hover:bg-purple-700">
                      Save Clip
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right side: Events panel */}
          <div className="w-80 h-full shrink-0 border-l bg-muted/30">
            <StreamEventsPanel events={filteredEvents} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
