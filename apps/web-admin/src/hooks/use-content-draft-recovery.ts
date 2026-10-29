"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  clearLocalDraft,
  isDraftNewerThan,
  parseLocalDraft,
  readLocalDraftRaw,
  type StoredContentDraft,
} from "@/lib/cms/local-draft";
import type { ContentDraft } from "@/lib/cms/draft";

/**
 * What localStorage held when this post was opened.
 *
 * Cached because the editor writes a copy of its own on every change: reading
 * live would mean the prompt watched its own output, and `useSyncExternalStore`
 * needs a snapshot that stops changing.
 */
const openingDraft = new Map<string, string | null>();

function openingDraftSnapshot(contentId: string): string | null {
  if (!openingDraft.has(contentId)) {
    openingDraft.set(contentId, readLocalDraftRaw(contentId));
  }
  return openingDraft.get(contentId) ?? null;
}

/** The snapshot is fixed for the session; nothing to subscribe to. */
const subscribeToNothing = () => () => {};

export interface DraftRecoveryPrompt {
  open: boolean;
  savedAt: string | null;
  onRestore: () => void;
  onDiscard: () => void;
}

/**
 * Offers back a local copy that never reached the server.
 *
 * The offer is deliberate rather than automatic: restoring silently would
 * resurrect stale work over a save made from another tab or machine.
 */
export function useContentDraftRecovery(
  contentId: string,
  serverUpdatedAt: string,
  restore: (draft: ContentDraft) => void,
): DraftRecoveryPrompt {
  // localStorage only exists in the browser, so the server render and the
  // first client render agree on "nothing to restore".
  const raw = useSyncExternalStore(
    subscribeToNothing,
    useCallback(() => openingDraftSnapshot(contentId), [contentId]),
    () => null,
  );

  const offered: StoredContentDraft | null = useMemo(() => {
    const stored = parseLocalDraft(raw, contentId);
    return stored && isDraftNewerThan(stored, serverUpdatedAt) ? stored : null;
  }, [raw, contentId, serverUpdatedAt]);

  const [decided, setDecided] = useState(false);

  // A copy older than the server's is stale work; drop it rather than leave
  // it to be offered on some later visit.
  useEffect(() => {
    if (offered !== null || raw === null) return;
    clearLocalDraft(contentId);
    openingDraft.set(contentId, null);
  }, [offered, raw, contentId]);

  const onRestore = useCallback(() => {
    if (offered) restore(offered.draft);
    setDecided(true);
  }, [offered, restore]);

  const onDiscard = useCallback(() => {
    clearLocalDraft(contentId);
    openingDraft.set(contentId, null);
    setDecided(true);
  }, [contentId]);

  return { open: !decided && offered !== null, savedAt: offered?.savedAt ?? null, onRestore, onDiscard };
}

/** After a save lands, the opening snapshot is history too. */
export function forgetOpeningDraft(contentId: string) {
  openingDraft.set(contentId, null);
}
