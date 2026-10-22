import { afterAll, beforeEach, expect, test } from "bun:test";
import {
  clearLocalDraft,
  isDraftNewerThan,
  parseLocalDraft,
  readLocalDraft,
  writeLocalDraft,
  type StoredContentDraft,
} from "./local-draft";
import { emptyDoc, type ContentDraft } from "./draft";

/** The helpers only touch getItem/setItem/removeItem, so this is enough of one. */
function installLocalStorage(onSet?: (key: string, value: string) => void) {
  const rows = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => rows.get(key) ?? null,
      setItem: (key: string, value: string) => {
        onSet?.(key, value);
        rows.set(key, value);
      },
      removeItem: (key: string) => void rows.delete(key),
    },
  };
  return rows;
}

function makeDraft(title = "Hello"): ContentDraft {
  return {
    title,
    slug: "hello",
    excerpt: "",
    summary: "",
    coverAssetId: null,
    body: emptyDoc(),
    seoTitle: "",
    seoDescription: "",
    ogAssetId: null,
    canonicalUrl: "",
    noindex: false,
    primaryCategoryId: null,
    isFeatured: false,
    pinnedRank: null,
    commentsEnabled: true,
    difficulty: null,
    estimatedMinutes: null,
    prerequisites: [],
    sections: [],
    authorIds: [],
    categoryIds: [],
    tagIds: [],
    relatedIds: [],
  };
}

const stored = (overrides: Partial<StoredContentDraft> = {}): StoredContentDraft => ({
  contentId: "post-1",
  version: 1,
  lockVersion: 3,
  savedAt: "2026-10-22T10:00:00.000Z",
  draft: makeDraft(),
  ...overrides,
});

beforeEach(() => {
  installLocalStorage();
});

afterAll(() => {
  delete (globalThis as { window?: unknown }).window;
});

test("writes and reads back a draft", () => {
  writeLocalDraft("post-1", makeDraft("Draft title"), 7);
  const read = readLocalDraft("post-1");
  expect(read?.draft.title).toBe("Draft title");
  expect(read?.lockVersion).toBe(7);
  expect(read?.contentId).toBe("post-1");
});

test("keeps each post's draft apart", () => {
  writeLocalDraft("post-1", makeDraft("One"), 1);
  writeLocalDraft("post-2", makeDraft("Two"), 1);
  expect(readLocalDraft("post-1")?.draft.title).toBe("One");
  expect(readLocalDraft("post-2")?.draft.title).toBe("Two");
});

test("clearing removes only that post", () => {
  writeLocalDraft("post-1", makeDraft("One"), 1);
  writeLocalDraft("post-2", makeDraft("Two"), 1);
  clearLocalDraft("post-1");
  expect(readLocalDraft("post-1")).toBeNull();
  expect(readLocalDraft("post-2")).not.toBeNull();
});

test("a draft stored under another post is not offered", () => {
  expect(parseLocalDraft(JSON.stringify(stored({ contentId: "other" })), "post-1")).toBeNull();
});

test("rejects an envelope from another version or shape", () => {
  expect(parseLocalDraft(JSON.stringify(stored({ version: 2 as 1 })), "post-1")).toBeNull();
  expect(parseLocalDraft(JSON.stringify({ ...stored(), draft: null }), "post-1")).toBeNull();
  expect(parseLocalDraft(JSON.stringify({ ...stored(), lockVersion: "3" }), "post-1")).toBeNull();
  expect(parseLocalDraft("not json", "post-1")).toBeNull();
  expect(parseLocalDraft(null, "post-1")).toBeNull();
});

test("a post too big to store leaves nothing behind", () => {
  const rows = installLocalStorage();
  const huge = makeDraft("x".repeat(2_100_000));
  writeLocalDraft("post-1", huge, 1);
  expect(rows.size).toBe(0);
});

test("a browser that refuses the write leaves nothing behind", () => {
  const rows = installLocalStorage(() => {
    throw new Error("quota");
  });
  writeLocalDraft("post-1", makeDraft(), 1);
  expect(rows.size).toBe(0);
});

test("only a draft newer than the server's copy is worth offering", () => {
  const draft = stored({ savedAt: "2026-10-22T10:00:00.000Z" });
  expect(isDraftNewerThan(draft, "2026-10-22T09:59:00.000Z")).toBe(true);
  expect(isDraftNewerThan(draft, "2026-10-22T10:00:00.000Z")).toBe(false);
  expect(isDraftNewerThan(draft, "2026-10-22T10:01:00.000Z")).toBe(false);
});

test("an unreadable date decides safely", () => {
  // No idea when the draft was written: don't offer it.
  expect(isDraftNewerThan(stored({ savedAt: "whenever" }), "2026-10-22T10:00:00.000Z")).toBe(false);
  // No idea when the server saved: the draft is all we have.
  expect(isDraftNewerThan(stored(), "whenever")).toBe(true);
});
