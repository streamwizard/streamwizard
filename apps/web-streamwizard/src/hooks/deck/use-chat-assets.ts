"use client";

import { createChatAssetFetcher, useChatAssets as useSharedChatAssets } from "@repo/ui/chat";

/**
 * The deck's chat asset prefetch, read from the session-authed dashboard route.
 * The hook itself is shared with the overlay chat box; see `@repo/ui/chat`.
 */

// Module-level so the fetcher's identity never changes and the prefetch runs once.
const fetchDashboardChatAsset = createChatAssetFetcher("/api/twitch/assets");

export function useChatAssets(enabled: boolean) {
  return useSharedChatAssets(enabled ? fetchDashboardChatAsset : null);
}
