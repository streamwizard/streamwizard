"use client";

import { VodDetailClient } from "@/components/vods/vod-detail-client";
import { ModalProvider } from "@/providers/modal-provider";
import { SHOT_VOD } from "../fixtures";

/**
 * One VOD's detail page: player, timeline and the stream events panel.
 *
 * ModalProvider comes from the dashboard layout in the real app, and the
 * timeline's context menu reads it, so the harness has to supply it too.
 */
export default function VodDetailShotPage() {
  return (
    <ModalProvider>
      <div data-shot-stage className="min-h-screen bg-background">
        <VodDetailClient video={SHOT_VOD} />
      </div>
    </ModalProvider>
  );
}
