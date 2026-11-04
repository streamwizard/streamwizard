"use client";

import TwitchClipCard from "@/components/shared/clips/clip-card";
import { ClipsDetailsView } from "@/components/clips/clips-details-view";
import { getClipViewContainerClass, type ClipView } from "@/lib/clips/clip-view";
import type { ClipWithFolders } from "@/types/database";

type ClipsDisplayProps = {
  clips: ClipWithFolders[];
  view: ClipView;
};

export function ClipsDisplay({ clips, view }: ClipsDisplayProps) {
  if (view === "details") {
    return <ClipsDetailsView clips={clips} />;
  }

  return (
    <div className={getClipViewContainerClass(view)}>
      {clips.map((clip) => (
        <TwitchClipCard key={clip.id} {...clip} />
      ))}
    </div>
  );
}
