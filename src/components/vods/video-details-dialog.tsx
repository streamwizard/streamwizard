"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { TwitchVideo, parseDuration } from "@/types/twitch video";
import { getStreamEvents } from "@/actions/twitch/vods";
import { getEventDisplayData, StreamEventType } from "@/types/stream-events";
import type { Database } from "@/types/supabase";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TwitchPlayerComponent, useTwitchPlayer, type TwitchPlayer } from "@/components/vods/twitch-player";
import { VideoTimeline, type TimelineEvent } from "./video-timeline";
import { StreamEventsPanel } from "./stream-events-panel";
import { EventTypeFilter } from "./event-type-filter";
import { useEventFilters } from "@/hooks/use-event-filters";
import { ExternalLink, Eye, Globe, Calendar, Scissors, Play, Pause, Volume2, VolumeX } from "lucide-react";

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
  // Extract display data using the helper function
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
export function VideoDetailsDialog({ video, open, onOpenChange, onCreateClip }: VideoDetailsDialogProps) {
  const { setPlayer, controls } = useTwitchPlayer();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [playerKey, setPlayerKey] = useState(0);
  const timeUpdateRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Stream events state
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

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
      setPlayerKey((prev) => prev + 1);

      // Fetch events if we have a stream_id
      if (video.stream_id) {
        setIsLoadingEvents(true);
        getStreamEvents(video.stream_id)
          .then((result) => {
            if (result.success && result.events) {
              setEvents(result.events);
            } else {
              setEvents([]);
            }
          })
          .finally(() => {
            setIsLoadingEvents(false);
          });
      } else {
        setEvents([]);
      }
    } else {
      setIsPlaying(false);
      setIsMuted(true);
      setCurrentTime(0);
      setIsPlayerReady(false);
      setEvents([]);
      if (timeUpdateRef.current) {
        clearInterval(timeUpdateRef.current);
      }
    }
  }, [open, video]);

  // Poll for current time while playing
  useEffect(() => {
    if (isPlaying && isPlayerReady) {
      timeUpdateRef.current = setInterval(() => {
        const time = controls.getCurrentTime();
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
  }, [isPlaying, isPlayerReady, controls]);

  const handlePlayerReady = useCallback(
    (player: TwitchPlayer) => {
      setPlayer(player);
      setIsPlayerReady(true);
    },
    [setPlayer],
  );

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleSeek = useCallback(
    (seconds: number) => {
      controls.seek(seconds);
      setCurrentTime(seconds);
    },
    [controls],
  );

  const handleEventClick = useCallback(
    (event: StreamEvent) => {
      // Seek to event position (offset_seconds is a direct property of the event)
      const offset = event.offset_seconds || 0;
      handleSeek(offset);
    },
    [handleSeek],
  );

  const handleTimelineEventClick = useCallback(
    (event: TimelineEvent) => {
      handleSeek(event.offset);
    },
    [handleSeek],
  );

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      controls.pause();
    } else {
      controls.play();
    }
  }, [isPlaying, controls]);

  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    controls.setMuted(newMuted);
    setIsMuted(newMuted);
  }, [isMuted, controls]);

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
            {events.length > 0 && (
              <EventTypeFilter
                events={events}
                selectedTypes={selectedTypes}
                onToggleType={toggleType}
                onSelectAll={selectAll}
                onDeselectAll={deselectAll}
              />
            )}
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
            </div>

            {/* Custom Timeline */}
            <div className="mt-4">
              <VideoTimeline
                duration={durationSeconds}
                currentTime={currentTime}
                events={timelineEvents}
                onSeek={handleSeek}
                onEventClick={handleTimelineEventClick}
                disabled={!isPlayerReady}
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
            {video.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-4">{video.description}</p>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4 mt-4 border-t">
              <Button asChild variant="default">
                <a href={video.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Watch on Twitch
                </a>
              </Button>
              {onCreateClip && (
                <Button variant="outline" onClick={() => onCreateClip(video)}>
                  <Scissors className="mr-2 h-4 w-4" />
                  Create Clip
                </Button>
              )}
            </div>
          </div>

          {/* Right side: Events panel */}
          <div className="w-80 h-full shrink-0 border-l bg-muted/30">
            <StreamEventsPanel
              events={filteredEvents}
              isLoading={isLoadingEvents}
              onEventClick={handleEventClick}
              currentTime={currentTime}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
