"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { TwitchVideo } from "@/types/twitch";
import { createClipFromVod } from "@/actions/twitch/vods";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  ExternalLink,
  Scissors,
  X,
  ZoomIn,
  ZoomOut,
  Focus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface VideoPlayerWithClipCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  video: TwitchVideo | null;
}

declare global {
  interface Window {
    Twitch: any;
  }
}

// Parse duration string like "3h2m1s" to seconds
function parseDurationToSeconds(duration: string): number {
  const hours = parseInt(duration.match(/(\d+)h/)?.[1] || "0");
  const minutes = parseInt(duration.match(/(\d+)m/)?.[1] || "0");
  const seconds = parseInt(duration.match(/(\d+)s/)?.[1] || "0");
  return hours * 3600 + minutes * 60 + seconds;
}

// Format seconds to "HH:MM:SS" or "MM:SS"
function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Format seconds to "XhYmZs" for Twitch Player
function formatTwitchTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${hours}h${minutes}m${seconds}s`;
}

export function VideoPlayerWithClipCreator({
  open,
  onOpenChange,
  video
}: VideoPlayerWithClipCreatorProps) {

  // Clip creation mode
  const [isClipMode, setIsClipMode] = useState(false);

  // Player state
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Clip selection state
  const [clipDuration, setClipDuration] = useState(30);
  const [clipEndTime, setClipEndTime] = useState(30);
  const [clipTitle, setClipTitle] = useState("");

  // API state
  const [isCreating, setIsCreating] = useState(false);
  const [result, setResult] = useState<{ id: string; editUrl: string } | null>(null);

  // Zoom and pan state for timeline
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = full view, higher = zoomed in
  const [viewStart, setViewStart] = useState(0); // Start of visible range in seconds

  // Drag state for timeline interaction
  const timelineRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{
    type: 'move' | 'resize-left' | 'resize-right';
    startX: number;
    initialEndTime: number;
    initialDuration: number;
  } | null>(null);

  // VOD duration in seconds
  const vodDuration = video ? parseDurationToSeconds(video.duration) : 0;

  // Calculate clip start time (end - duration)
  const clipStartTime = Math.max(0, clipEndTime - clipDuration);

  // Calculate visible duration based on zoom
  const visibleDuration = vodDuration / zoomLevel;
  const viewEnd = Math.min(viewStart + visibleDuration, vodDuration);

  // Auto-calculate optimal zoom for the clip
  const optimalZoomForClip = useMemo(() => {
    if (vodDuration === 0) return 1;
    // Show clip with ~20% padding on each side
    const clipWithPadding = clipDuration * 1.4;
    return Math.min(Math.max(vodDuration / clipWithPadding, 1), 20);
  }, [vodDuration, clipDuration]);

  // Player refs and state
  const playerRef = useRef<any>(null);
  const embedRef = useRef<HTMLDivElement>(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  // Load Twitch script
  useEffect(() => {
    console.log("Loading Twitch script");
    if (typeof window !== "undefined" && window.Twitch && window.Twitch.Player) {
      setIsScriptLoaded(true);
      console.log("Twitch script already loaded");
      return;
    }

    // Check if script already exists
    const existingScript = document.querySelector('script[src="https://player.twitch.tv/js/embed/v1.js"]');
    if (existingScript) {
      // Script exists, wait for it to load
      const checkTwitch = setInterval(() => {
        if (window.Twitch && window.Twitch.Player) {
          setIsScriptLoaded(true);
          clearInterval(checkTwitch);
        }
      }, 100);
      return () => clearInterval(checkTwitch);
    }

    const script = document.createElement("script");
    script.src = "https://player.twitch.tv/js/embed/v1.js";
    script.async = true;
    script.onload = () => {
      console.log("Twitch script loaded");
      setIsScriptLoaded(true);
    };
    script.onerror = () => {
      console.error("Failed to load Twitch script");
    };
    document.body.appendChild(script);
  }, []);

  // Initialize player
  useEffect(() => {
    if (!isScriptLoaded || !open || !video || !embedRef.current) {
      console.log("Player init skipped:", { isScriptLoaded, open, video: !!video, embedRef: !!embedRef.current });
      return;
    }

    console.log("Initializing Twitch player for video:", video.id);

    // Clean up existing player
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
        console.log("Destroyed existing player");
      } catch (e) {
        console.error("Error destroying player:", e);
      }
      playerRef.current = null;
    }

    // Clear the container
    embedRef.current.innerHTML = "";

    const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
    const embedId = `twitch-embed-${Date.now()}`;

    console.log("Creating player with ID:", embedId, "hostname:", hostname);

    // Create a div for the player
    const playerDiv = document.createElement("div");
    playerDiv.id = embedId;
    playerDiv.style.position = "absolute";
    playerDiv.style.inset = "0";
    embedRef.current.appendChild(playerDiv);

    // Wait a tick for the DOM to update
    setTimeout(() => {
      try {
        const options = {
          width: "100%",
          height: "100%",
          video: video.id,
          parent: [hostname, "localhost", "127.0.0.1"],
          autoplay: false,
          muted: false,
        };

        console.log("Creating Twitch.Player with options:", options);
        const player = new window.Twitch.Player(embedId, options);
        playerRef.current = player;

        player.addEventListener(window.Twitch.Player.READY, () => {
          console.log("Player ready");
          player.setVolume(0.5);
        });

        player.addEventListener(window.Twitch.Player.PLAY, () => {
          console.log("Player playing");
          setIsPlaying(true);
        });

        player.addEventListener(window.Twitch.Player.PAUSE, () => {
          console.log("Player paused");
          setIsPlaying(false);
        });

        player.addEventListener(window.Twitch.Player.ENDED, () => {
          console.log("Player ended");
          setIsPlaying(false);
        });
      } catch (error) {
        console.error("Error creating Twitch player:", error);
      }
    }, 0);

    // Cleanup function
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.error("Error destroying player:", e);
        }
        playerRef.current = null;
      }
    };
  }, [isScriptLoaded, open, video]);

  // Sync player time to state
  useEffect(() => {
    if (!isPlaying || !playerRef.current) return;
    const interval = setInterval(() => {
      const time = playerRef.current.getCurrentTime();
      if (typeof time === 'number') setCurrentTime(time);
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Reset state when modal closes or opens
  useEffect(() => {
    if (open && video) {
      setCurrentTime(0);
      setClipEndTime(Math.min(30, vodDuration));
      setClipDuration(30);
      setClipTitle("");
      setResult(null);
      setIsClipMode(false);
      setZoomLevel(1);
      setViewStart(0);
    }
  }, [open, video, vodDuration]);

  // Auto-zoom and center on clip when entering clip mode
  const handleEnterClipMode = () => {
    setIsClipMode(true);
    const initialEnd = Math.max(clipDuration, Math.min(currentTime + clipDuration, vodDuration));
    setClipEndTime(initialEnd);

    // Auto-zoom to clip region
    autoFocusOnClip(initialEnd - clipDuration, initialEnd);
  };

  // Center view on clip region with appropriate zoom
  const autoFocusOnClip = (start: number, end: number) => {
    const clipCenter = (start + end) / 2;
    const newZoom = optimalZoomForClip;
    const newVisibleDuration = vodDuration / newZoom;
    let newViewStart = clipCenter - newVisibleDuration / 2;

    // Clamp view start
    newViewStart = Math.max(0, Math.min(newViewStart, vodDuration - newVisibleDuration));

    setZoomLevel(newZoom);
    setViewStart(newViewStart);
  };

  const handleExitClipMode = () => {
    setIsClipMode(false);
    setResult(null);
    setClipTitle("");
    setZoomLevel(1);
    setViewStart(0);
  };

  // Update seekTo to control player
  const seekTo = (time: number) => {
    const clampedTime = Math.max(0, Math.min(time, vodDuration));
    setCurrentTime(clampedTime);
    if (playerRef.current) {
      playerRef.current.seek(clampedTime);
    }
  };

  // Handle click on timeline to seek
  const handleTimelineClick = (e: React.MouseEvent) => {
    // Ignore if clicking on interactive elements
    if ((e.target as HTMLElement).closest('.cursor-move') || (e.target as HTMLElement).closest('.cursor-ew-resize')) return;

    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const percentage = x / width;

    // Calculate time based on visible range
    const visibleDuration = vodDuration / zoomLevel;
    const time = viewStart + (percentage * visibleDuration);

    seekTo(time);
  };

  // Drag handler start
  const handleDragStart = (type: 'move' | 'resize-left' | 'resize-right', e: any) => {
    e.stopPropagation();
    e.preventDefault();
    setDragState({
      type,
      startX: e.clientX,
      initialEndTime: clipEndTime,
      initialDuration: clipDuration,
    });
  };

  // Drag logic
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current) return;

      const { width } = timelineRef.current.getBoundingClientRect();
      const pixelsPerSecond = width / (vodDuration / zoomLevel);

      const deltaPixels = e.clientX - dragState.startX;
      const deltaSeconds = deltaPixels / pixelsPerSecond;

      if (dragState.type === 'move') {
        const initialStartTime = dragState.initialEndTime - dragState.initialDuration;
        let newStartTime = initialStartTime + deltaSeconds;
        newStartTime = Math.max(0, Math.min(newStartTime, vodDuration - dragState.initialDuration));
        setClipEndTime(newStartTime + dragState.initialDuration); // End time moves
      } else if (dragState.type === 'resize-left') {
        let newDuration = dragState.initialDuration - deltaSeconds;
        newDuration = Math.max(5, Math.min(newDuration, 60));

        if (dragState.initialEndTime - newDuration < 0) {
          newDuration = dragState.initialEndTime;
        }
        setClipDuration(newDuration);
        // End time fixed
      } else if (dragState.type === 'resize-right') {
        let newDuration = dragState.initialDuration + deltaSeconds;
        newDuration = Math.max(5, Math.min(newDuration, 60));

        const initialStartTime = dragState.initialEndTime - dragState.initialDuration;
        if (initialStartTime + newDuration > vodDuration) {
          newDuration = vodDuration - initialStartTime;
        }
        setClipDuration(newDuration);
        setClipEndTime(initialStartTime + newDuration); // End time increases
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, vodDuration, zoomLevel]);

  const handleCreateClip = async () => {
    if (!video) return;

    setIsCreating(true);

    const response = await createClipFromVod({
      vodId: video.id,
      vodOffset: clipEndTime,
      duration: clipDuration,
      title: clipTitle || undefined,
    });

    setIsCreating(false);

    if (response.success && response.data) {
      setResult(response.data);
      toast.success("Clip created successfully!");
    } else {
      toast.error(response.message);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  // Zoom controls
  const handleZoomIn = () => {
    const newZoom = Math.min(zoomLevel * 1.5, 20);
    const clipCenter = (clipStartTime + clipEndTime) / 2;
    const newVisibleDuration = vodDuration / newZoom;
    let newViewStart = clipCenter - newVisibleDuration / 2;
    newViewStart = Math.max(0, Math.min(newViewStart, vodDuration - newVisibleDuration));

    setZoomLevel(newZoom);
    setViewStart(newViewStart);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoomLevel / 1.5, 1);
    const clipCenter = (clipStartTime + clipEndTime) / 2;
    const newVisibleDuration = vodDuration / newZoom;
    let newViewStart = clipCenter - newVisibleDuration / 2;
    newViewStart = Math.max(0, Math.min(newViewStart, vodDuration - newVisibleDuration));

    setZoomLevel(newZoom);
    setViewStart(newViewStart);
  };

  const handleFocusClip = () => {
    autoFocusOnClip(clipStartTime, clipEndTime);
  };

  // Pan controls
  const handlePanLeft = () => {
    const panAmount = visibleDuration * 0.25;
    setViewStart(Math.max(0, viewStart - panAmount));
  };

  const handlePanRight = () => {
    const panAmount = visibleDuration * 0.25;
    setViewStart(Math.min(vodDuration - visibleDuration, viewStart + panAmount));
  };

  // Calculate position within visible range (for timeline display)
  const getVisiblePosition = (timeInSeconds: number): number => {
    if (visibleDuration === 0) return 0;
    return ((timeInSeconds - viewStart) / visibleDuration) * 100;
  };

  // Calculate visible width percentage
  const getVisibleWidth = (durationInSeconds: number): number => {
    if (visibleDuration === 0) return 0;
    return (durationInSeconds / visibleDuration) * 100;
  };

  // Check if time is within visible range
  const isInVisibleRange = (time: number): boolean => {
    return time >= viewStart && time <= viewEnd;
  };

  // Generate timeline markers based on zoom level
  const timelineMarkers = useMemo(() => {
    const markers: { time: number; label: string }[] = [];

    // Determine appropriate interval based on visible duration
    let interval: number;
    if (visibleDuration <= 60) {
      interval = 10; // 10 seconds
    } else if (visibleDuration <= 300) {
      interval = 30; // 30 seconds
    } else if (visibleDuration <= 600) {
      interval = 60; // 1 minute
    } else if (visibleDuration <= 1800) {
      interval = 300; // 5 minutes
    } else if (visibleDuration <= 3600) {
      interval = 600; // 10 minutes
    } else {
      interval = 1800; // 30 minutes
    }

    // Generate markers
    const startMarker = Math.ceil(viewStart / interval) * interval;
    for (let time = startMarker; time <= viewEnd; time += interval) {
      markers.push({ time, label: formatTime(time) });
    }

    return markers;
  }, [viewStart, viewEnd, visibleDuration]);

  if (!video) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-6xl p-0 overflow-hidden max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-background">
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-lg font-semibold truncate">{video.title}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Duration: {video.duration} • {video.view_count.toLocaleString()} views
            </p>
          </div>
          {!isClipMode && (
            <Button onClick={handleEnterClipMode} variant="secondary">
              <Scissors className="w-4 h-4 mr-2" />
              Create Clip
            </Button>
          )}
        </div>

        {/* Main content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Video player */}
          <div className={`flex-1 bg-black ${isClipMode ? "w-2/3" : "w-full"}`}>
            <div className="aspect-video w-full relative" ref={embedRef}>
              {/* Twitch player will be injected here */}
            </div>
          </div>

          {/* Clip creation sidebar */}
          {isClipMode && (
            <div className="w-80 border-l bg-background flex flex-col">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold">Create Clip</h3>
                <Button variant="ghost" size="icon" onClick={handleExitClipMode}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {result ? (
                /* Success state */
                <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
                  <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-semibold text-lg">Clip Created!</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your clip is ready to edit
                    </p>
                  </div>
                  <Button asChild className="mt-2">
                    <a href={result.editUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open in Clip Editor
                    </a>
                  </Button>
                  <Button variant="outline" onClick={() => setResult(null)}>
                    Create Another Clip
                  </Button>
                </div>
              ) : (
                /* Clip creation form */
                <div className="flex-1 p-4 space-y-6 overflow-y-auto">
                  {/* Title */}
                  <div className="space-y-2">
                    <Label htmlFor="clip-title">Clip Title</Label>
                    <Input
                      id="clip-title"
                      placeholder="Add a title (required)..."
                      value={clipTitle}
                      onChange={(e) => setClipTitle(e.target.value)}
                      disabled={isCreating}
                    />
                    <p className="text-xs text-muted-foreground">
                      Clips with unique titles get more views
                    </p>
                  </div>

                  {/* Duration selector */}
                  <div className="space-y-3">
                    <Label>Clip Duration: {clipDuration} seconds</Label>
                    <Slider
                      value={[clipDuration]}
                      onValueChange={([value]) => {
                        setClipDuration(value);
                        // Ensure end time is still valid
                        if (clipEndTime < value) {
                          setClipEndTime(Math.min(value, vodDuration));
                        }
                        // Auto-focus on new clip region
                        setTimeout(() => autoFocusOnClip(clipEndTime - value, clipEndTime), 0);
                      }}
                      min={5}
                      max={60}
                      step={1}
                      disabled={isCreating}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>5s</span>
                      <span>60s</span>
                    </div>
                  </div>

                  {/* Timeline position */}
                  <div className="space-y-3">
                    <Label>Clip End Position</Label>
                    <Slider
                      value={[clipEndTime]}
                      onValueChange={([value]) => {
                        setClipEndTime(value);
                        // Auto-pan if clip moves out of view
                        const newStart = value - clipDuration;
                        if (!isInVisibleRange(newStart) || !isInVisibleRange(value)) {
                          autoFocusOnClip(newStart, value);
                        }
                      }}
                      min={clipDuration}
                      max={vodDuration}
                      step={1}
                      disabled={isCreating}
                    />
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        Start: {formatTime(clipStartTime)}
                      </span>
                      <span className="font-medium">
                        End: {formatTime(clipEndTime)}
                      </span>
                    </div>
                  </div>

                  {/* Clip preview info */}
                  <div className="bg-muted rounded-lg p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Clip starts at:</span>
                      <span className="font-mono">{formatTime(clipStartTime)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Clip ends at:</span>
                      <span className="font-mono">{formatTime(clipEndTime)}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t pt-2 mt-2">
                      <span className="text-muted-foreground">Duration:</span>
                      <span className="font-semibold">{clipDuration} seconds</span>
                    </div>
                  </div>

                  {/* Create button */}
                  <Button
                    onClick={handleCreateClip}
                    disabled={isCreating || !clipTitle.trim()}
                    className="w-full"
                    size="lg"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating Clip...
                      </>
                    ) : (
                      <>
                        <Scissors className="w-4 h-4 mr-2" />
                        Save Clip
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Enhanced Timeline with Zoom */}
        {isClipMode && (
          <div className="border-t p-4 bg-background space-y-3">
            {/* Zoom controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handlePanLeft}
                        disabled={viewStart <= 0}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Pan Left</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleZoomOut}
                        disabled={zoomLevel <= 1}
                      >
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Zoom Out</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <span className="text-xs text-muted-foreground px-2 min-w-[50px] text-center">
                  {zoomLevel.toFixed(1)}x
                </span>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleZoomIn}
                        disabled={zoomLevel >= 20}
                      >
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Zoom In</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handlePanRight}
                        disabled={viewStart + visibleDuration >= vodDuration}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Pan Right</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <div className="w-px h-6 bg-border mx-2" />

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8"
                        onClick={handleFocusClip}
                      >
                        <Focus className="h-4 w-4 mr-1" />
                        Focus Clip
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Auto-zoom to clip region</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="text-sm text-muted-foreground">
                Viewing: {formatTime(viewStart)} - {formatTime(viewEnd)}
              </div>
            </div>

            {/* Timeline visualization */}
            <div className="relative h-16 bg-muted rounded-lg overflow-hidden">
              {/* Mini-map showing full VOD */}
              <div className="absolute top-0 left-0 right-0 h-2 bg-muted-foreground/20">
                {/* Visible range indicator */}
                <div
                  className="absolute top-0 bottom-0 bg-primary/50"
                  style={{
                    left: `${(viewStart / vodDuration) * 100}%`,
                    width: `${(visibleDuration / vodDuration) * 100}%`,
                  }}
                />
                {/* Clip position on mini-map */}
                <div
                  className="absolute top-0 bottom-0 bg-green-500"
                  style={{
                    left: `${(clipStartTime / vodDuration) * 100}%`,
                    width: `${(clipDuration / vodDuration) * 100}%`,
                  }}
                />
              </div>

              {/* Main zoomed timeline area */}
              <div ref={timelineRef} className="absolute top-3 bottom-0 left-0 right-0" onClick={handleTimelineClick}>
                {/* Playhead (current time) */}
                {isInVisibleRange(currentTime) && (
                  <div
                    className="absolute top-0 bottom-4 w-0.5 bg-red-500 z-10 pointer-events-none"
                    style={{
                      left: `${getVisiblePosition(currentTime)}%`,
                    }}
                  >
                    <div className="absolute -top-1 -translate-x-1/2 w-2.5 h-2.5 bg-red-500 rounded-full shadow-sm" />
                  </div>
                )}

                {/* Clip selection highlight (only show if in visible range) */}
                {(isInVisibleRange(clipStartTime) || isInVisibleRange(clipEndTime)) && (
                  <div
                    className="absolute top-0 bottom-4 bg-primary/30 border-x-2 border-primary rounded cursor-move hover:bg-primary/40 transition-colors"
                    style={{
                      left: `${Math.max(0, getVisiblePosition(clipStartTime))}%`,
                      width: `${Math.min(100, getVisibleWidth(clipDuration))}%`,
                    }}
                    onMouseDown={(e) => handleDragStart('move', e)}
                  >
                    {/* Clip handles */}
                    <div
                      className="absolute -left-1 top-0 bottom-0 w-2 bg-primary rounded-l cursor-ew-resize hover:scale-x-125 transition-transform"
                      onMouseDown={(e) => handleDragStart('resize-left', e)}
                    />
                    <div
                      className="absolute -right-1 top-0 bottom-0 w-2 bg-primary rounded-r cursor-ew-resize hover:scale-x-125 transition-transform"
                      onMouseDown={(e) => handleDragStart('resize-right', e)}
                    />
                  </div>
                )}

                {/* Timeline markers */}
                <div className="absolute bottom-0 left-0 right-0 h-4 flex items-end">
                  {timelineMarkers.map((marker) => (
                    <div
                      key={marker.time}
                      className="absolute flex flex-col items-center"
                      style={{ left: `${getVisiblePosition(marker.time)}%` }}
                    >
                      <div className="h-2 w-px bg-border" />
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap -translate-x-1/2">
                        {marker.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Clip time labels */}
                {isInVisibleRange(clipStartTime) && (
                  <div
                    className="absolute top-1 text-[10px] font-mono text-primary -translate-x-1/2"
                    style={{ left: `${getVisiblePosition(clipStartTime)}%` }}
                  >
                    {formatTime(clipStartTime)}
                  </div>
                )}
                {isInVisibleRange(clipEndTime) && (
                  <div
                    className="absolute top-1 text-[10px] font-mono text-primary -translate-x-1/2"
                    style={{ left: `${getVisiblePosition(clipEndTime)}%` }}
                  >
                    {formatTime(clipEndTime)}
                  </div>
                )}
              </div>
            </div>

            {/* Help text */}
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Use sliders above to select clip • Zoom to see details</span>
              <span className="font-medium text-foreground">
                {formatTime(clipStartTime)} - {formatTime(clipEndTime)} ({clipDuration}s)
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}