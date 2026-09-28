"use client";

import { useEffect, useState } from "react";
import { EMPTY_CHAT_ASSETS, type ChatAssets, type ThirdPartyProvider } from "./types";

/**
 * Prefetches the maps chat rendering needs, once.
 *
 * Chat renders immediately with whatever has landed — first-party Twitch emotes
 * need no map at all, and the bot pre-enriches badge URLs onto the events — so a
 * slow or failed prefetch degrades to plain text rather than an empty pane.
 * `version` bumps exactly once when everything settles, so memoized rows
 * re-render one time instead of on every incoming message.
 *
 * Where the maps come from is the host's call: the dashboard reads its
 * session-authed route, an overlay reads its subscriber-token route. Both serve
 * the same `{ badges }`, `{ cheermotes }` and `{ emotes }` bodies.
 */

export const CHAT_ASSET_PROVIDERS: readonly ThirdPartyProvider[] = ["7tv", "bttv", "ffz"];

export type ChatAssetResource = "badges" | "cheermotes" | "emotes";

/** Resolves one asset body, or null on any failure. */
export type ChatAssetFetcher = (
  resource: ChatAssetResource,
  query?: Record<string, string>,
) => Promise<unknown>;

export interface UseChatAssetsOptions {
  /** Which third-party emote sets to load. Defaults to all three. */
  providers?: readonly ThirdPartyProvider[];
}

/** A fetcher for a same-origin route of the shape `${base}/${resource}?…`. */
export function createChatAssetFetcher(
  base: string,
  init?: RequestInit,
): ChatAssetFetcher {
  return async (resource, query) => {
    const qs = query ? `?${new URLSearchParams(query).toString()}` : "";
    try {
      const res = await fetch(`${base}/${resource}${qs}`, init);
      if (!res.ok) return null;
      return (await res.json()) as unknown;
    } catch {
      return null;
    }
  };
}

export function useChatAssets(
  fetcher: ChatAssetFetcher | null,
  { providers = CHAT_ASSET_PROVIDERS }: UseChatAssetsOptions = {},
) {
  const [assets, setAssets] = useState<ChatAssets>(EMPTY_CHAT_ASSETS);
  const [version, setVersion] = useState(0);
  // Joined so a fresh array with the same members doesn't refetch.
  const providerKey = providers.join(",");

  useEffect(() => {
    if (!fetcher) return;
    let cancelled = false;
    const wanted = providerKey ? (providerKey.split(",") as ThirdPartyProvider[]) : [];

    (async () => {
      const [badges, cheermotes, ...emoteSets] = (await Promise.all([
        fetcher("badges"),
        fetcher("cheermotes"),
        ...wanted.map((provider) => fetcher("emotes", { provider })),
      ])) as [
        { badges?: ChatAssets["badges"] } | null,
        { cheermotes?: ChatAssets["cheermotes"] } | null,
        ...({ emotes?: ChatAssets["thirdPartyEmotes"] } | null)[],
      ];

      if (cancelled) return;

      // Later providers win on a code collision, matching how chat clients
      // generally resolve overlapping 7TV/BTTV/FFZ codes.
      const thirdPartyEmotes = Object.assign(
        {},
        ...emoteSets.map((set) => set?.emotes ?? {}),
      ) as ChatAssets["thirdPartyEmotes"];

      setAssets({
        badges: badges?.badges ?? {},
        cheermotes: cheermotes?.cheermotes ?? {},
        thirdPartyEmotes,
      });
      setVersion((v) => v + 1);
    })();

    return () => {
      cancelled = true;
    };
  }, [fetcher, providerKey]);

  return { assets, version };
}
