"use client";

import TwitchClipCard from "@/components/cards/clip-card";
import { ClipsDetailsView } from "@/components/clips/clips-details-view";
import { getClipViewContainerClass, type ClipView } from "@/lib/utils/clip-view";
import { clipsWithFolders } from "@/types/database";

type ClipsDisplayProps = {
  clips: clipsWithFolders[];
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
