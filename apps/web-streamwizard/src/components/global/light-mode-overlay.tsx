"use client";

import { useRef } from "react";
import { useTheme } from "next-themes";
import { useLightModeTransitionStore } from "@/stores/light-mode-transition-store";

export function LightModeOverlay() {
  const { setTheme } = useTheme();
  const { isPlaying, reset } = useLightModeTransitionStore();
  const hasSwitchedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  if (!isPlaying) return null;

  function handleTimeUpdate(e: React.SyntheticEvent<HTMLVideoElement>) {
    if (!hasSwitchedRef.current && e.currentTarget.currentTime >= 3.8) {
      hasSwitchedRef.current = true;
      setTheme("light");
    }
  }

  function handleEnded() {
    if (!hasSwitchedRef.current) setTheme("light");
    hasSwitchedRef.current = false;
    reset();
  }

  function handleError() {
    setTheme("light");
    hasSwitchedRef.current = false;
    reset();
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "all" }}>
      <video
        ref={videoRef}
        src={`${process.env.NEXT_PUBLIC_CDN_URL}/public/animations/lightmode-transfer.a3be503ecf4b.webm`}
        autoPlay
        playsInline
        onPlay={(e) => { e.currentTarget.volume = 0.5; }}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={handleError}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
}
