import Image from "next/image";
import { PlayIcon, BookmarkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const markers = [
  { position: "18%", label: "Clutch" },
  { position: "41%", label: "Death" },
  { position: "67%", label: "Win" },
];

export function VodPlayerBackground() {
  return (
    <div className="absolute inset-x-0 top-0 overflow-hidden mask-[linear-gradient(to_top,transparent_25%,#000_100%)]">
      {/* Video thumbnail */}
      <div className="relative w-full">
        <Image
          src="/img/landing-page/video-player.png"
          alt=""
          width={800}
          height={400}
          className="w-full object-cover object-top opacity-70 scale-[1.03] group-hover:scale-100 transition-transform duration-500 ease-out"
          aria-hidden="true"
        />

        {/* Player chrome overlay */}
        <div className="absolute inset-0 flex flex-col justify-end pb-3 px-3 bg-gradient-to-t from-black/60 via-transparent to-transparent">
          {/* Timestamp markers */}
          <div className="relative h-5 mb-1.5">
            {markers.map((m) => (
              <div
                key={m.label}
                className="absolute -translate-x-1/2 flex flex-col items-center gap-0.5"
                style={{ left: m.position }}
              >
                <BookmarkIcon className="h-2.5 w-2.5 text-primary fill-primary" />
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="relative h-1 w-full rounded-full bg-white/20 overflow-visible mb-2">
            <div className="h-full w-[41%] rounded-full bg-primary" />
            <div className="absolute top-1/2 -translate-y-1/2 left-[41%] -translate-x-1/2 h-3 w-3 rounded-full bg-white shadow-md border-2 border-primary" />
            {markers.map((m) => (
              <div
                key={m.label}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-primary/70 ring-1 ring-white/40"
                style={{ left: m.position }}
              />
            ))}
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full",
                "bg-white/10 backdrop-blur-sm"
              )}
            >
              <PlayIcon className="h-3 w-3 text-white fill-white ml-0.5" />
            </div>
            <span className="text-[10px] text-white/70 tabular-nums">41:23 / 1:52:07</span>
            <div className="ml-auto flex items-center gap-1">
              {markers.map((m) => (
                <span
                  key={m.label}
                  className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium"
                >
                  {m.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
