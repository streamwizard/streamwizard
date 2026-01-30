"use client";

import Script from "next/script";
import { useEffect, useRef, useCallback, useState } from "react";

declare global {
  interface Window {
    Twitch: {
      Player: new (elementId: string, options: TwitchPlayerOptions) => TwitchPlayer;
    };
  }
}

export interface TwitchPlayerOptions {
  width?: number | string;
  height?: number | string;
  channel?: string;
  video?: string;
  collection?: string;
  parent?: string[];
  autoplay?: boolean;
  muted?: boolean;
  time?: string;
}

export interface PlaybackStats {
  backendVersion: string;
  bufferSize: number;
  codecs: string;
  displayResolution: string;
  fps: number;
  hlsLatencyBroadcaster: number;
  playbackRate: number;
  skippedFrames: number;
  videoResolution: string;
}

export interface TwitchPlayer {
  // Playback controls
  disableCaptions: () => void;
  enableCaptions: () => void;
  pause: () => void;
  play: () => void;
  seek: (timestamp: number) => void;
  setChannel: (channel: string) => void;
  setCollection: (collectionId: string, videoId?: string) => void;
  setQuality: (quality: string) => void;
  setVideo: (videoId: string, timestamp?: number) => void;

  // Volume controls
  getMuted: () => boolean;
  setMuted: (muted: boolean) => void;
  getVolume: () => number;
  setVolume: (volumeLevel: number) => void;

  // Status API
  getPlaybackStats: () => PlaybackStats;
  getChannel: () => string;
  getCurrentTime: () => number;
  getDuration: () => number;
  getEnded: () => boolean;
  getQualities: () => string[];
  getQuality: () => string;
  getVideo: () => string;
  isPaused: () => boolean;

  // Event handling
  addEventListener: (event: string, callback: () => void) => void;
  removeEventListener: (event: string, callback: () => void) => void;
}

export type TwitchPlayerEvent = "captions" | "ended" | "pause" | "play" | "playbackBlocked" | "playing" | "offline" | "online" | "ready" | "seek";

interface TwitchPlayerComponentProps extends TwitchPlayerOptions {
  id?: string;
  className?: string;
  initialVolume?: number;
  onReady?: (player: TwitchPlayer) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onPlaying?: () => void;
  onOffline?: () => void;
  onOnline?: () => void;
  onSeek?: () => void;
  onPlaybackBlocked?: () => void;
  onCaptions?: (captions: string) => void;
}

const TWITCH_PLAYER_SCRIPT = "https://player.twitch.tv/js/embed/v1.js";

// Twitch Player event constants
const TwitchPlayerEvents = {
  CAPTIONS: "captions",
  ENDED: "ended",
  PAUSE: "pause",
  PLAY: "play",
  PLAYBACK_BLOCKED: "playbackBlocked",
  PLAYING: "playing",
  OFFLINE: "offline",
  ONLINE: "online",
  READY: "ready",
  SEEK: "seek",
} as const;

export function TwitchPlayerComponent({
  id = "twitch-player",
  className,
  width = "100%",
  height = 480,
  channel,
  video,
  collection,
  parent,
  autoplay = true,
  muted = false,
  time,
  initialVolume = 0.5,
  onReady,
  onPlay,
  onPause,
  onEnded,
  onPlaying,
  onOffline,
  onOnline,
  onSeek,
  onPlaybackBlocked,
  onCaptions,
}: TwitchPlayerComponentProps) {
  const playerRef = useRef<TwitchPlayer | null>(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const initPlayer = useCallback(() => {
    if (!window.Twitch || !containerRef.current) return;

    // Clean up existing player iframe if present
    const existingIframe = containerRef.current.querySelector("iframe");
    if (existingIframe) {
      existingIframe.remove();
    }

    // Determine parent domains for the embed
    const parentDomains = parent || [window.location.hostname];

    const options: TwitchPlayerOptions = {
      width,
      height,
      parent: parentDomains,
      autoplay,
      muted,
    };

    // Add content source (channel, video, or collection)
    if (channel) {
      options.channel = channel;
    } else if (video) {
      options.video = video;
      if (time) options.time = time;
    } else if (collection) {
      options.collection = collection;
      if (video) options.video = video;
    }

    const player = new window.Twitch.Player(id, options);
    playerRef.current = player;

    // Set initial volume
    player.setVolume(initialVolume);

    // Add event listeners
    player.addEventListener(TwitchPlayerEvents.READY, () => {
      onReady?.(player);
    });

    if (onPlay) {
      player.addEventListener(TwitchPlayerEvents.PLAY, onPlay);
    }

    if (onPause) {
      player.addEventListener(TwitchPlayerEvents.PAUSE, onPause);
    }

    if (onEnded) {
      player.addEventListener(TwitchPlayerEvents.ENDED, onEnded);
    }

    if (onPlaying) {
      player.addEventListener(TwitchPlayerEvents.PLAYING, onPlaying);
    }

    if (onOffline) {
      player.addEventListener(TwitchPlayerEvents.OFFLINE, onOffline);
    }

    if (onOnline) {
      player.addEventListener(TwitchPlayerEvents.ONLINE, onOnline);
    }

    if (onSeek) {
      player.addEventListener(TwitchPlayerEvents.SEEK, onSeek);
    }

    if (onPlaybackBlocked) {
      player.addEventListener(TwitchPlayerEvents.PLAYBACK_BLOCKED, onPlaybackBlocked);
    }

    if (onCaptions) {
      player.addEventListener(TwitchPlayerEvents.CAPTIONS, onCaptions as unknown as () => void);
    }
  }, [
    id,
    width,
    height,
    channel,
    video,
    collection,
    parent,
    autoplay,
    muted,
    time,
    initialVolume,
    onReady,
    onPlay,
    onPause,
    onEnded,
    onPlaying,
    onOffline,
    onOnline,
    onSeek,
    onPlaybackBlocked,
    onCaptions,
  ]);

  useEffect(() => {
    if (isScriptLoaded) {
      initPlayer();
    }
  }, [isScriptLoaded, initPlayer]);

  // Check if Twitch script is already loaded (from previous mount)
  useEffect(() => {
    if (typeof window !== "undefined" && window.Twitch && !isScriptLoaded) {
      setIsScriptLoaded(true);
    }
  }, [isScriptLoaded]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      playerRef.current = null;
    };
  }, []);

  return (
    <>
      <Script src={TWITCH_PLAYER_SCRIPT} strategy="lazyOnload" onLoad={() => setIsScriptLoaded(true)} />
      <div
        ref={containerRef}
        id={id}
        className={className}
        style={{
          width: typeof width === "number" ? `${width}px` : width,
          height: typeof height === "number" ? `${height}px` : height,
          visibility: "visible",
          display: "block",
        }}
      />
    </>
  );
}

export default TwitchPlayerComponent;
