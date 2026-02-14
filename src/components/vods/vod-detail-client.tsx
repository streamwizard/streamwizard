"use client";

import { useEffect, useRef, useState } from "react";
import { TwitchVideo, parseDuration } from "@/types/twitch video";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TwitchPlayerComponent,
  type TwitchPlayer,
} from "@/components/vods/twitch-player";
import { VideoTimeline } from "./timeline";
import { StreamEventsPanel } from "./stream-events-panel";
import { EventTypeFilter } from "./event-type-filter";
import { useVideoPlayerStore } from "@/stores/video-dialog-store";
import {
  ExternalLink,
  Eye,
  Globe,
  Calendar,
  Scissors,
  Play,
  Pause,
  Volume2,
  VolumeX,
  X,
  SkipBack,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

interface VodDetailClientProps {
  video: TwitchVideo;
}

/**
 * Full-page VOD detail view with interactive Twitch player, timeline, and events panel.
 * Replaces the previous modal-based VideoDetailsDialog.
 */
export function VodDetailClient({ video }: VodDetailClientProps) {
  const {
    isPlaying,
    isMuted,
    currentTime,
    isPlayerReady,
    playerKey,
    events,
    isCreatingClip,
    clipTitle,
    clipStartTime,
    clipEndTime,
    isSubmittingClip,
    setVideo,
    setPlayer,
    setPlayerReady,
    setIsPlaying,
    setCurrentTime,
    incrementPlayerKey,
    togglePlay,
    toggleMute,
    seek,
    fetchEvents,
    startClipCreation,
    cancelClipCreation,
    setClipTitle,
    setClipSelection,
    saveClip,
    seekToClipStart,
    resetState,
  } = useVideoPlayerStore();

  const timeUpdateRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const [leftPanelHeight, setLeftPanelHeight] = useState<number | undefined>(
    undefined,
  );

  // Measure left panel height and sync to right panel
  useEffect(() => {
    const el = leftPanelRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setLeftPanelHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Initialize store on mount and reset on unmount
  useEffect(() => {
    incrementPlayerKey();
    setVideo(video);

    return () => {
      resetState();
      if (timeUpdateRef.current) {
        clearInterval(timeUpdateRef.current);
      }
    };
  }, []);

  // Fetch stream events and clips via video ID
  useEffect(() => {
    fetchEvents(video.id);
  }, [video]);

  // Poll for current time while playing
  useEffect(() => {
    const { player } = useVideoPlayerStore.getState();

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
  }, [isPlaying, isPlayerReady]);

  // Clip mode looping: when playback reaches clip end, loop back to clip start
  useEffect(() => {
    if (!isCreatingClip || !isPlaying || !isPlayerReady) return;

    if (currentTime >= clipEndTime) {
      seek(clipStartTime);
    }
  }, [
    isCreatingClip,
    isPlaying,
    isPlayerReady,
    currentTime,
    clipStartTime,
    clipEndTime,
  ]);

  // When entering clip mode, seek to clip start
  useEffect(() => {
    if (isCreatingClip && isPlayerReady) {
      seek(clipStartTime);
    }
  }, [isCreatingClip, isPlayerReady]);

  const handlePlayerReady = (player: TwitchPlayer) => {
    setPlayer(player);
    setPlayerReady(true);
  };

  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleToggleClipCreation = () => {
    if (isCreatingClip) {
      cancelClipCreation();
    } else {
      startClipCreation();
    }
  };

  const handleSaveClip = async () => {
    await saveClip();
  };

  const createdDate = new Date(video.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const durationSeconds = parseDuration(video.duration);

  return (
    <div className="flex h-full flex-col">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 p-4 pb-2 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/vods">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold line-clamp-1">
              {video.title}
            </h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <span>{video.user_name}</span>
              <Badge variant="secondary" className="capitalize">
                {video.type}
              </Badge>
              {video.stream_id && (
                <Badge variant="outline" className="text-xs">
                  Stream: {video.stream_id}
                </Badge>
              )}
            </div>
          </div>
        </div>
        {events.length > 0 && <EventTypeFilter />}
      </div>

      {/* Two-column layout: Video player left, Events right */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left side: Video player and controls */}
        <div
          ref={leftPanelRef}
          className="flex-1 flex flex-col min-w-0 p-4 pt-0 overflow-y-auto"
        >
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
            <Button
              variant="outline"
              size="icon"
              onClick={togglePlay}
              disabled={!isPlayerReady}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleMute}
              disabled={!isPlayerReady}
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            {isCreatingClip && (
              <Button
                variant="outline"
                size="sm"
                onClick={seekToClipStart}
                disabled={!isPlayerReady}
                title="Jump to clip start"
              >
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
              disabled={!isPlayerReady}
              isClipMode={isCreatingClip}
              clipSelection={
                isCreatingClip
                  ? { startTime: clipStartTime, endTime: clipEndTime }
                  : undefined
              }
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
          {video.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-4">
              {video.description}
            </p>
          )}

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
              <Button
                variant={isCreatingClip ? "secondary" : "outline"}
                onClick={handleToggleClipCreation}
                disabled={!isPlayerReady}
              >
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
                  <Input
                    id="clip-title"
                    placeholder="Add a title (required)"
                    value={clipTitle}
                    onChange={(e) => setClipTitle(e.target.value)}
                    className="bg-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    Clips with unique titles get more views. Help{" "}
                    {video.user_name} get discovered by adding a title.
                  </p>
                </div>

                {/* Save/Cancel buttons */}
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={cancelClipCreation}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveClip}
                    disabled={!clipTitle.trim() || isSubmittingClip}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    Save Clip
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right side: Events panel */}
        <div
          className="w-80 shrink-0 overflow-hidden border-l rounded-lg bg-muted/30"
          style={{ maxHeight: leftPanelHeight }}
        >
          <StreamEventsPanel />
        </div>
      </div>
    </div>
  );
}
