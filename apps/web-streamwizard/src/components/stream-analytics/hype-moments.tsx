"use client";

import { Trophy } from "lucide-react";
import type { HypeMoment, ClipData } from "./types";
import { useModal } from "@/providers/modal-provider";
import TwitchClipModal from "@/components/modals/twitch-clip-modal";

interface HypeMomentsProps {
  moments: HypeMoment[];
}

export function HypeMoments({ moments }: HypeMomentsProps) {
  const { openModal } = useModal();

  if (moments.length === 0) return null;

  const handleWatch = (clip: ClipData) => {
    if (clip.embed_url) openModal(<TwitchClipModal url={clip.embed_url} />);
  };

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
        <Trophy className="h-4 w-4 text-amber-500" />
        Hype moments
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {moments.slice(0, 6).map((moment) => (
          <div key={moment.bucket} className="overflow-hidden rounded-xl border bg-card">
            {moment.topClip?.thumbnail_url ? (
              <div className="relative aspect-video">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={moment.topClip.thumbnail_url}
                  alt={moment.topClip.title}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <span className="absolute left-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                  🔥 Highlight
                </span>
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center bg-muted text-2xl">
                🔥
              </div>
            )}

            <div className="space-y-1 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-muted-foreground">{moment.label}</span>
                <span className="text-muted-foreground">
                  {moment.viewers.toLocaleString()} viewers
                </span>
              </div>
              <p className="text-sm font-medium line-clamp-1">
                {moment.topClip?.title ?? "Stream moment"}
              </p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {moment.clipCount} clip{moment.clipCount !== 1 ? "s" : ""} created
                </span>
                {moment.topClip && (
                  <button
                    onClick={() => handleWatch(moment.topClip!)}
                    className="text-primary hover:underline"
                  >
                    Watch ▶
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
