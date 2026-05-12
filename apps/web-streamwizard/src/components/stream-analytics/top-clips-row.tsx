"use client";

import { Film } from "lucide-react";
import type { ClipData } from "./types";
import TwitchClipCard from "@/components/cards/clip-card";
import type { clipsWithFolders } from "@/types/database";

interface TopClipsRowProps {
  clips: ClipData[];
}

function toCardProps(clip: ClipData): clipsWithFolders {
  return {
    ...(clip as unknown as clipsWithFolders),
    folders: [],
  };
}

export function TopClipsRow({ clips }: TopClipsRowProps) {
  if (clips.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
        <Film className="h-4 w-4" />
        Top clips
      </h2>
      <div className="grid grid-cols-4 gap-4">
        {clips.slice(0, 4).map((clip) => (
          <TwitchClipCard key={clip.twitch_clip_id} {...toCardProps(clip)} />
        ))}
      </div>
    </section>
  );
}
