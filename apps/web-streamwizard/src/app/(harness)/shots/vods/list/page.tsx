"use client";

import { VodsPageClient } from "@/components/vods/vods-page-client";
import { SHOT_VODS } from "../fixtures";

/**
 * The VOD list with fixture rows. /dashboard/vods calls Twitch Helix on every
 * request, so there is no way to seed it: this is the only way to photograph
 * the page without a live Twitch account and five real broadcasts.
 */
export default function VodListShotPage() {
  return (
    <div data-shot-stage className="min-h-screen bg-background p-8">
      <VodsPageClient initialVideos={SHOT_VODS} />
    </div>
  );
}
