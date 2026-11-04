import { beforeEach, describe, expect, mock, test } from "bun:test";

// The CMS actions parse their arguments right after the admin check: bad
// input comes back as `{ error }` and never reaches the database.

const ACTOR = "aaaaaaaa-0000-4000-8000-000000000001";
const POST = "bbbbbbbb-0000-0000-0000-000000000002";

let dbCalls: string[] = [];
let reports: unknown[] = [];
let isAdmin = true;

/** Any property read on the service-role client counts as a database call. */
const recordingClient = new Proxy({} as Record<string, unknown>, {
  get(_, prop) {
    dbCalls.push(String(prop));
    return () => {
      throw new Error("database reached");
    };
  },
});

const realAssertAdmin = await import("@/lib/auth/assert-admin");
mock.module("@/lib/auth/assert-admin", () => ({
  ...realAssertAdmin,
  assertAdmin: async () => {
    if (!isAdmin) throw new Error("Not authorized");
    return ACTOR;
  },
}));
const realAdmin = await import("@repo/supabase/next/admin");
mock.module("@repo/supabase/next/admin", () => ({
  ...realAdmin,
  supabaseAdmin: recordingClient,
  createAdminClient: () => recordingClient,
}));
const realSentry = await import("@repo/sentry");
mock.module("@repo/sentry", () => ({
  ...realSentry,
  reportError: (error: unknown) => {
    reports.push(error);
  },
}));

const { addContentCommentAction, setContentReviewStateAction } = await import("./comments");
const { saveContentDraftAction, trashContentAction } = await import("./content");
const { createAuthorAction, searchAuthorAccountsAction } = await import("./authors");
const { listCmsMediaAction, createCmsUploadAction } = await import("./media");
const { mergeTagsAction } = await import("./taxonomy");
const { scheduleContentAction } = await import("./publish");
const { createPreviewLinkAction } = await import("./preview");

beforeEach(() => {
  dbCalls = [];
  reports = [];
  isAdmin = true;
});

describe("cms actions refuse bad input before the database", () => {
  test("a bad post id", async () => {
    expect(await setContentReviewStateAction("not-an-id", "approved")).toEqual({
      error: "That post doesn't exist anymore.",
    });
    expect(await trashContentAction("1; drop table cms_content", null)).toEqual({
      error: "That post doesn't exist anymore, or it's in the trash.",
    });
    expect(dbCalls).toEqual([]);
  });

  test("an unknown review state", async () => {
    const result = await setContentReviewStateAction(POST, "published" as never);
    expect(result).toEqual({ error: "That isn't a review state." });
    expect(dbCalls).toEqual([]);
  });

  test("an overlong comment", async () => {
    const result = await addContentCommentAction({ contentId: POST, body: "x".repeat(4001) });
    expect(result).toEqual({ error: "That comment is too long.", comment: null });
    expect(dbCalls).toEqual([]);
  });

  test("an overlong author name and search", async () => {
    expect((await createAuthorAction("x".repeat(81))).error).toBe("Give the author a name, up to 80 characters.");
    expect((await searchAuthorAccountsAction("x".repeat(201))).error).toBe("Keep the search under 200 characters.");
    expect(dbCalls).toEqual([]);
  });

  test("a wrong type never shows Zod's own wording", async () => {
    const result = await saveContentDraftAction(POST, "blog", -1, {} as never, "autosave");
    expect(result.error).toBe("Something in the draft doesn't fit. Check the fields.");
    expect(result.conflict).toBe(false);
    expect((await listCmsMediaAction(Number.NaN)).error).toBe(
      "That request doesn't look right. Reload the page and try again.",
    );
    expect(dbCalls).toEqual([]);
  });

  test("an upload that isn't an image request", async () => {
    const result = await createCmsUploadAction({ fileName: "a.png", mimeType: "image/png", size: -5 } as never);
    expect(result).toEqual({ error: "That file is empty.", upload: null });
    expect(dbCalls).toEqual([]);
  });

  test("merging a tag into itself, a bad schedule time, a bad preview length", async () => {
    expect(await mergeTagsAction(POST, POST)).toEqual({ error: "Pick a different tag to merge into." });
    expect((await scheduleContentAction(POST, 1, "tomorrow")).error).toBe("Pick a date and time.");
    expect((await createPreviewLinkAction(POST, 2)).error).toBe("Pick 1 hour, 24 hours or 7 days.");
    expect(dbCalls).toEqual([]);
    expect(reports).toEqual([]);
  });

  test("a non-admin is refused before parsing or the database", async () => {
    isAdmin = false;
    expect(await setContentReviewStateAction("not-an-id", "approved")).toEqual({ error: "Not authorized" });
    expect(dbCalls).toEqual([]);
  });

  test("valid input does reach the database, and its failure is reported, not thrown", async () => {
    const result = await setContentReviewStateAction(POST, "approved");
    expect(result).toEqual({ error: "Couldn't change the review state." });
    expect(dbCalls.length).toBeGreaterThan(0);
    expect(reports).toHaveLength(1);
  });
});
