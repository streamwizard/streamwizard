"use client";

import TwitchClipCard from "@/components/cards/clip-card";
import { ClipsDetailsView } from "@/components/clips/clips-details-view";
import { ClipsViewSelector } from "@/components/clips/clips-view-selector";
import { getClipViewContainerClass, type ClipView } from "@/lib/utils/clip-view";
import { clipsWithFolders } from "@/types/database";

type ClipsDisplayProps = {
  clips: clipsWithFolders[];
  view: ClipView;
};

export function ClipsDisplay({ clips, view }: ClipsDisplayProps) {
  return (
    <>
      <ClipsViewSelector currentView={view} />
      {view === "details" ? (
        <ClipsDetailsView clips={clips} />
      ) : (
        <div className={getClipViewContainerClass(view)}>
          {clips.map((clip) => (
            <TwitchClipCard key={clip.id} view={view} {...clip} />
          ))}
        </div>
      )}
    </>
  );
}
