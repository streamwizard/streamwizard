import { describe, expect, it, mock } from "bun:test";
import type { CmsRevalidation } from "@repo/supabase/queries/cms/schedule";
import type { EmitPlatformEventInput } from "@repo/supabase/queries/platform-events";
import type { CmsSchedulerDeps, DueResult, RevalidateRequest } from "./cms-scheduler";

// Same process-wide mock shape as the other rest-api tests.
const reported: string[] = [];
mock.module("@repo/sentry", () => ({
  reportError: (_error: unknown, context: string) => {
    reported.push(context);
  },
}));
// Keeps the env schema out of the test: the live instance at the bottom of
// the module reads it on import.
mock.module("../lib/env", () => ({ env: {} }));
// The live deps import these; the tests pass their own deps. Mocked so another
// test's partial mock of @repo/supabase/queries/identity can't break the import.
mock.module("@repo/supabase", () => ({ supabase: {} }));
mock.module("@repo/supabase/queries/platform-events", () => ({
  getPlatformEventIdentity: async () => ({}),
  logPlatformEvent: async () => {},
}));

const { createCmsScheduler, retryDelayMs } = await import("./cms-scheduler");

const POST = "11111111-1111-4111-8111-111111111111";
const ADMIN = "22222222-2222-4222-8222-222222222222";
const NOW = Date.parse("2026-10-14T12:00:00.000Z");

function harness(overrides: Partial<CmsSchedulerDeps> & { due?: DueResult[]; retries?: CmsRevalidation[] } = {}) {
  const calls = {
    revalidated: [] as RevalidateRequest[],
    queued: [] as RevalidateRequest[],
    deleted: [] as number[],
    retriedAt: [] as [number, string][],
    logged: [] as EmitPlatformEventInput[],
  };
  const deps: CmsSchedulerDeps = {
    claimDue: async () => overrides.due ?? [],
    summary: async () => ({ type: "guide", title: "Set up alerts", slug: "set-up-alerts" }),
    revalidate: async (request) => {
      calls.revalidated.push(request);
      return true;
    },
    queue: async (request) => void calls.queued.push(request),
    claimRetries: async () => overrides.retries ?? [],
    deleteRetry: async (id) => void calls.deleted.push(id),
    retryAt: async (id, at) => void calls.retriedAt.push([id, at.toISOString()]),
    log: async (event) => void calls.logged.push(event),
    actor: async () => ({ actor_twitch_username: "jochemwhite", actor_avatar_url: null }),
    siteUrl: "https://streamwizard.org",
    now: () => NOW,
    ...overrides,
  };
  return { scheduler: createCmsScheduler(deps), calls };
}

const published: DueResult = {
  content_id: POST,
  scheduled_by: ADMIN,
  ok: true,
  error: null,
  result: {
    before: null,
    after: { id: POST, type: "guide", category_ids: [], tag_ids: [], author_ids: [] },
    first_publish: true,
  },
};

function retry(overrides: Partial<CmsRevalidation> = {}): CmsRevalidation {
  return {
    id: 7,
    tags: ["cms:list:guide"],
    mode: "immediate",
    index_now_paths: ["/guides"],
    attempts: 1,
    next_attempt_at: new Date(NOW).toISOString(),
    last_error: null,
    created_at: new Date(NOW - 60_000).toISOString(),
    ...overrides,
  };
}

describe("cms scheduler", () => {
  it("refreshes the site, pings IndexNow and logs a scheduled publish", async () => {
    const { scheduler, calls } = harness({ due: [published] });
    expect(await scheduler.tick()).toEqual({ published: 1, failed: 0, retried: 0, dropped: 0 });
    expect(calls.revalidated).toHaveLength(1);
    expect(calls.revalidated[0]!.mode).toBe("immediate");
    expect(calls.revalidated[0]!.tags).toContain(`cms:content:${POST}`);
    expect(calls.revalidated[0]!.indexNow).toEqual(["/guides/set-up-alerts", "/guides"]);
    expect(calls.logged).toEqual([
      {
        type: "content.published",
        actorUserId: ADMIN,
        payload: expect.objectContaining({
          url: "https://streamwizard.org/guides/set-up-alerts",
          first_publish: true,
          scheduled: true,
          actor_twitch_username: "jochemwhite",
        }),
      },
    ]);
  });

  it("queues the refresh when the site doesn't confirm it", async () => {
    const { scheduler, calls } = harness({ due: [published], revalidate: async () => false });
    await scheduler.tick();
    expect(calls.queued).toHaveLength(1);
    expect(calls.logged[0]!.type).toBe("content.published");
  });

  it("logs a post the database couldn't publish, without refreshing anything", async () => {
    const { scheduler, calls } = harness({
      due: [{ ...published, ok: false, result: null, error: "cms_invalid: at least one author is required" }],
    });
    expect((await scheduler.tick()).failed).toBe(1);
    expect(calls.revalidated).toEqual([]);
    expect(calls.logged[0]).toMatchObject({
      type: "content.schedule_failed",
      payload: { error: "cms_invalid: at least one author is required", title: "Set up alerts" },
    });
  });

  it("deletes a retry once the site confirms it", async () => {
    const { scheduler, calls } = harness({ retries: [retry()] });
    expect((await scheduler.tick()).retried).toBe(1);
    expect(calls.revalidated[0]).toEqual({ tags: ["cms:list:guide"], mode: "immediate", indexNow: ["/guides"] });
    expect(calls.deleted).toEqual([7]);
  });

  it("backs off a retry that failed again", async () => {
    const { scheduler, calls } = harness({ retries: [retry({ attempts: 2 })], revalidate: async () => false });
    await scheduler.tick();
    expect(calls.retriedAt).toEqual([[7, new Date(NOW + 2 * 60_000).toISOString()]]);
    expect(calls.deleted).toEqual([]);
  });

  it("drops a retry older than the site's own hourly refresh", async () => {
    const { scheduler, calls } = harness({
      retries: [retry({ created_at: new Date(NOW - 61 * 60_000).toISOString() })],
      revalidate: async () => false,
    });
    expect((await scheduler.tick()).dropped).toBe(1);
    expect(calls.deleted).toEqual([7]);
  });

  it("keeps publishing when the retry queue is broken", async () => {
    const { scheduler, calls } = harness({
      due: [published],
      claimRetries: async () => {
        throw new Error("queue down");
      },
    });
    expect((await scheduler.tick()).published).toBe(1);
    expect(calls.logged).toHaveLength(1);
    expect(reported).toContain("cms-scheduler: retry refreshes");
  });

  it("runs one tick at a time", async () => {
    let release: () => void = () => {};
    let claims = 0;
    const { scheduler } = harness({
      claimDue: () =>
        new Promise((resolve) => {
          claims += 1;
          release = () => resolve([]);
        }),
    });
    const first = scheduler.tick();
    const second = scheduler.tick();
    release();
    await Promise.all([first, second]);
    expect(claims).toBe(1);
  });
});

describe("retryDelayMs", () => {
  it("doubles from a minute and caps at 15", () => {
    expect([1, 2, 3, 4, 5, 9].map((attempts) => retryDelayMs(attempts) / 60_000)).toEqual([1, 2, 4, 8, 15, 15]);
  });
});
