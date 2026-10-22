import type { ContentDraft } from "./draft";

/**
 * The working copy parked in this browser, so a crash, a closed tab or a
 * spell offline doesn't take the writing with it. Autosave still owns the
 * real save; this is only what is in flight between keystroke and server.
 */
export interface StoredContentDraft {
  contentId: string;
  /** Of this envelope, not of the body document. Anything else is ignored. */
  version: 1;
  /** The lock version the browser last saw, so a restore can be judged stale. */
  lockVersion: number;
  savedAt: string;
  draft: ContentDraft;
}

const KEY_PREFIX = "cms-draft:";
const VERSION = 1;

/** localStorage is roughly 5MB per origin; a post has no business near that. */
const MAX_DRAFT_CHARS = 2_000_000;

function keyFor(contentId: string) {
  return `${KEY_PREFIX}${contentId}`;
}

/** The stored string, or null. Kept separate so callers can memo on a stable value. */
export function readLocalDraftRaw(contentId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(keyFor(contentId));
  } catch {
    return null;
  }
}

/** Parses a stored draft, returning null for anything that isn't one for this post. */
export function parseLocalDraft(raw: string | null, contentId: string): StoredContentDraft | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const stored = parsed as StoredContentDraft;
    if (stored.version !== VERSION || stored.contentId !== contentId) return null;
    if (typeof stored.savedAt !== "string" || typeof stored.lockVersion !== "number") return null;
    if (typeof stored.draft !== "object" || stored.draft === null) return null;
    return stored;
  } catch {
    return null;
  }
}

export function readLocalDraft(contentId: string): StoredContentDraft | null {
  return parseLocalDraft(readLocalDraftRaw(contentId), contentId);
}

export function writeLocalDraft(contentId: string, draft: ContentDraft, lockVersion: number) {
  if (typeof window === "undefined") return;

  const payload = JSON.stringify({
    contentId,
    version: VERSION,
    lockVersion,
    savedAt: new Date().toISOString(),
    draft,
  } satisfies StoredContentDraft);

  // A post too big to store is better off with no local copy than with a write
  // that throws on every keystroke and leaves half of one behind.
  if (payload.length > MAX_DRAFT_CHARS) {
    clearLocalDraft(contentId);
    return;
  }

  try {
    window.localStorage.setItem(keyFor(contentId), payload);
  } catch {
    clearLocalDraft(contentId);
  }
}

export function clearLocalDraft(contentId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(keyFor(contentId));
  } catch {
    // A browser that won't let us remove it won't let us write it either.
  }
}

/**
 * Whether a stored draft is worth offering. One older than the server's copy
 * is stale work: restoring it would undo whatever was saved from somewhere
 * else, which is worse than losing a few unsent keystrokes.
 */
export function isDraftNewerThan(stored: StoredContentDraft, serverUpdatedAt: string): boolean {
  const draftAt = Date.parse(stored.savedAt);
  if (!Number.isFinite(draftAt)) return false;

  const serverAt = Date.parse(serverUpdatedAt);
  if (!Number.isFinite(serverAt)) return true;

  return draftAt > serverAt;
}
