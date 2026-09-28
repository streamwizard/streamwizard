"use client";

import { useState } from "react";

/**
 * A list edited as free text and only cleaned up on blur, so typing isn't
 * fought character by character.
 */
export function useListDraft(
  value: string[],
  resetKey: string,
  separator: string,
): [string, (next: string) => void] {
  const joined = value.join(separator);
  const [draft, setDraft] = useState(joined);
  // A new item, or the list changed from outside (undo, reset): start over
  // from the saved value. Done during render, React's pattern for syncing
  // state to a prop.
  const syncKey = `${resetKey}\u0000${joined}`;
  const [synced, setSynced] = useState(syncKey);
  if (synced !== syncKey) {
    setSynced(syncKey);
    setDraft(joined);
  }
  return [draft, setDraft];
}
