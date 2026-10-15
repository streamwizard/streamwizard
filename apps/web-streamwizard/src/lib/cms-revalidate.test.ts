import { describe, expect, it } from "bun:test";
import { cmsTags } from "@repo/cms";
import { handleRevalidate, secretsMatch, type RevalidateMode } from "./cms-revalidate";

const SECRET = "s".repeat(40);
const POST_ID = "11111111-1111-4111-8111-111111111111";

function request(body: unknown, auth: string | null = `Bearer ${SECRET}`): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (auth) headers.set("authorization", auth);
  return new Request("https://streamwizard.org/api/revalidate", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function recorder() {
  const calls: [string, RevalidateMode][] = [];
  return { calls, revalidate: (tag: string, mode: RevalidateMode) => calls.push([tag, mode]) };
}

describe("handleRevalidate", () => {
  it("doesn't exist without a secret", async () => {
    const { calls, revalidate } = recorder();
    const result = await handleRevalidate(request({ tags: [cmsTags.sitemap] }), { secret: undefined, revalidate });
    expect(result.status).toBe(404);
    expect(calls).toEqual([]);
  });

  it.each([null, "Bearer wrong", SECRET, `Basic ${SECRET}`])("refuses authorization %p", async (auth) => {
    const { calls, revalidate } = recorder();
    const result = await handleRevalidate(request({ tags: [cmsTags.sitemap] }, auth), { secret: SECRET, revalidate });
    expect(result.status).toBe(401);
    expect(calls).toEqual([]);
  });

  it("refreshes each tag once, stale by default", async () => {
    const { calls, revalidate } = recorder();
    const tags = [cmsTags.content(POST_ID), cmsTags.list("blog"), cmsTags.content(POST_ID)];
    const result = await handleRevalidate(request({ tags }), { secret: SECRET, revalidate });
    expect(result).toEqual({ status: 200, body: { revalidated: 2 } });
    expect(calls).toEqual([
      [cmsTags.content(POST_ID), "stale"],
      [cmsTags.list("blog"), "stale"],
    ]);
  });

  it("passes immediate mode through for removals", async () => {
    const { calls, revalidate } = recorder();
    await handleRevalidate(request({ tags: [cmsTags.content(POST_ID)], mode: "immediate" }), {
      secret: SECRET,
      revalidate,
    });
    expect(calls).toEqual([[cmsTags.content(POST_ID), "immediate"]]);
  });

  it("refuses the whole request when any tag isn't a CMS tag", async () => {
    const { calls, revalidate } = recorder();
    const result = await handleRevalidate(request({ tags: [cmsTags.sitemap, "showcase-clips"] }), {
      secret: SECRET,
      revalidate,
    });
    expect(result.status).toBe(400);
    expect(calls).toEqual([]);
  });

  it.each([["not json"], [{ tags: [] }], [{ tags: "cms" }], [{ tags: [cmsTags.sitemap], mode: "now" }]])(
    "refuses body %p",
    async (body) => {
      const { revalidate } = recorder();
      expect((await handleRevalidate(request(body), { secret: SECRET, revalidate })).status).toBe(400);
    },
  );

  it("hands valid content paths to IndexNow, once each", async () => {
    const { revalidate } = recorder();
    const pinged: string[][] = [];
    const result = await handleRevalidate(
      request({ tags: [cmsTags.list("guide")], indexNow: ["/guides/set-up-alerts", "/guides", "/guides"] }),
      { secret: SECRET, revalidate, pingIndexNow: (paths) => pinged.push(paths) },
    );
    expect(result.status).toBe(200);
    expect(pinged).toEqual([["/guides/set-up-alerts", "/guides"]]);
  });

  it("refuses IndexNow paths outside the blog and guides", async () => {
    const { calls, revalidate } = recorder();
    const result = await handleRevalidate(request({ tags: [cmsTags.sitemap], indexNow: ["/pricing"] }), {
      secret: SECRET,
      revalidate,
    });
    expect(result.status).toBe(400);
    expect(calls).toEqual([]);
  });

  it("refuses oversized bodies", async () => {
    const { revalidate } = recorder();
    const result = await handleRevalidate(request({ tags: [cmsTags.sitemap], pad: "x".repeat(20_000) }), {
      secret: SECRET,
      revalidate,
    });
    expect(result.status).toBe(413);
  });
});

describe("secretsMatch", () => {
  it("compares exactly", () => {
    expect(secretsMatch(SECRET, SECRET)).toBe(true);
    expect(secretsMatch(`${SECRET}x`, SECRET)).toBe(false);
    expect(secretsMatch(null, SECRET)).toBe(false);
  });
});
