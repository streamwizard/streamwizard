"use client";

import { useState } from "react";
import { FileJson, Music } from "lucide-react";
import type { UserAsset } from "@/actions/assets";

export interface MediaMeta {
  width?: number;
  height?: number;
  durationSeconds?: number;
}

// Dimensions and duration aren't stored on the row: the upload is a direct
// browser PUT to R2, so the server never sees the bytes. The decoded element
// knows them, so read them off it and hand them up.
interface Props {
  asset: UserAsset;
  onMeta: (meta: MediaMeta) => void;
}

// Transparent PNGs are the common case for alert images, so they need
// something behind them that is not the same flat colour as the file.
const CHECKERBOARD = {
  backgroundImage:
    "linear-gradient(45deg, rgba(255,255,255,0.05) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.05) 75%), " +
    "linear-gradient(45deg, rgba(255,255,255,0.05) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.05) 75%)",
  backgroundSize: "20px 20px",
  backgroundPosition: "0 0, 10px 10px",
};

function Shell({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      className="flex min-h-[220px] w-full items-center justify-center overflow-hidden bg-black/90 p-4"
      style={style}
    >
      {children}
    </div>
  );
}

export function MediaPreviewBody({ asset, onMeta }: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <Shell>
        <p className="text-sm text-white/80">This file didn&apos;t load. Its link still works below.</p>
      </Shell>
    );
  }

  if (asset.kind === "image") {
    return (
      <Shell style={CHECKERBOARD}>
        {/* Plain <img>: these are R2 CDN URLs, next/image buys nothing here */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.url}
          alt={asset.file_name}
          className="max-h-[70vh] w-auto max-w-full object-contain"
          onLoad={(e) =>
            onMeta({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })
          }
          onError={() => setFailed(true)}
        />
      </Shell>
    );
  }

  if (asset.kind === "video") {
    return (
      <Shell>
        <video
          src={asset.url}
          controls
          playsInline
          preload="metadata"
          className="max-h-[70vh] w-full"
          onLoadedMetadata={(e) =>
            onMeta({
              width: e.currentTarget.videoWidth,
              height: e.currentTarget.videoHeight,
              durationSeconds: Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : undefined,
            })
          }
          onError={() => setFailed(true)}
        />
      </Shell>
    );
  }

  if (asset.kind === "audio") {
    return (
      <Shell>
        <div className="flex w-full max-w-md flex-col items-center gap-4">
          <Music className="size-10 text-white/60" />
          <audio
            src={asset.url}
            controls
            preload="metadata"
            className="w-full"
            onLoadedMetadata={(e) =>
              onMeta({
                durationSeconds: Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : undefined,
              })
            }
            onError={() => setFailed(true)}
          />
        </div>
      </Shell>
    );
  }

  // Lottie: nothing in the app renders these yet, so say so instead of
  // showing an empty box.
  return (
    <Shell>
      <div className="flex flex-col items-center gap-3 text-center">
        <FileJson className="size-10 text-white/60" />
        <p className="max-w-sm text-sm text-white/80">
          Lottie files don&apos;t preview here yet. Point a widget at the link below to see it move.
        </p>
      </div>
    </Shell>
  );
}
