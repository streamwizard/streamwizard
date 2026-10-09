import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { buildHttpLog, crawlerName, createCrawlerLimiter, isPublicPageRequest, logCrawlerVisit } from "./crawler-log";

describe("crawlerName", () => {
  it("names the AI and search crawlers", () => {
    expect(
      crawlerName(
        "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
      ),
    ).toBe("gptbot");
    expect(crawlerName("Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)")).toBe("claudebot");
    expect(crawlerName("Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)")).toBe(
      "perplexitybot",
    );
    expect(crawlerName("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe("googlebot");
  });

  it("falls back to whatever calls itself a bot, crawler or spider", () => {
    expect(crawlerName("SomeNewAIBot/0.1 (+https://example.com)")).toBe("somenewaibot");
    expect(crawlerName("acme-crawler/2.0")).toBe("acme-crawler");
  });

  it("leaves real browsers, tools and missing user agents alone", () => {
    expect(
      crawlerName(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      ),
    ).toBeNull();
    expect(
      crawlerName(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) OBS/31.0.0 Chrome/127.0.0.0 Safari/537.36",
      ),
    ).toBeNull();
    expect(crawlerName("curl/8.5.0")).toBeNull();
    expect(crawlerName("")).toBeNull();
    expect(crawlerName(null)).toBeNull();
  });
});

describe("isPublicPageRequest", () => {
  it("takes public pages and the crawler-facing files", () => {
    expect(isPublicPageRequest("GET", "/")).toBe(true);
    expect(isPublicPageRequest("HEAD", "/pricing")).toBe(true);
    expect(isPublicPageRequest("GET", "/llms.txt")).toBe(true);
    expect(isPublicPageRequest("GET", "/robots.txt")).toBe(true);
  });

  it("skips signed-in areas, plumbing and anything that is not a read", () => {
    expect(isPublicPageRequest("GET", "/dashboard")).toBe(false);
    expect(isPublicPageRequest("GET", "/dashboard/overlays/abc/edit")).toBe(false);
    expect(isPublicPageRequest("GET", "/api/health")).toBe(false);
    expect(isPublicPageRequest("GET", "/auth/callback/twitch")).toBe(false);
    expect(isPublicPageRequest("POST", "/pricing")).toBe(false);
  });

  it("does not mistake a public page for a private one that shares its first letters", () => {
    expect(isPublicPageRequest("GET", "/dashboards-explained")).toBe(true);
    expect(isPublicPageRequest("GET", "/apidocs")).toBe(true);
  });
});

describe("createCrawlerLimiter", () => {
  it("sends a crawler and path once an hour", () => {
    let now = Date.parse("2026-10-09T10:00:00Z");
    const allow = createCrawlerLimiter(() => now);
    expect(allow("gptbot", "/pricing")).toBe(true);
    expect(allow("gptbot", "/pricing")).toBe(false);
    expect(allow("gptbot", "/about")).toBe(true);
    expect(allow("claudebot", "/pricing")).toBe(true);
    now += 61 * 60 * 1000;
    expect(allow("gptbot", "/pricing")).toBe(true);
  });

  it("stops at the daily ceiling and starts again the next day", () => {
    let now = Date.parse("2026-10-09T00:00:00Z");
    const allow = createCrawlerLimiter(() => now);
    let sent = 0;
    for (let page = 0; page < 6000; page++) if (allow("gptbot", `/page-${page}`)) sent++;
    expect(sent).toBe(5000);
    now += 24 * 60 * 60 * 1000;
    expect(allow("gptbot", "/page-next-day")).toBe(true);
  });
});

describe("buildHttpLog", () => {
  const input = {
    userAgent: "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)",
    method: "GET",
    pathname: "/pricing",
    origin: "https://streamwizard.org",
    referer: "https://www.example.com/search?q=private+words",
    environment: "production",
  };

  it("builds the event PostHog documents, without a person profile", () => {
    const log = buildHttpLog("phc_test", input);
    expect(log.event).toBe("$http_log");
    expect(log.distinct_id).toMatch(/^http_log_[0-9a-f]{32}$/);
    expect(log.properties).toMatchObject({
      $process_person_profile: false,
      $current_url: "https://streamwizard.org/pricing",
      $host: "streamwizard.org",
      $pathname: "/pricing",
      $raw_user_agent: input.userAgent,
      method: "GET",
    });
  });

  it("carries no IP, no location and no query strings", () => {
    const log = buildHttpLog("phc_test", input);
    expect(log.properties).not.toHaveProperty("$ip");
    expect(log.properties.$geoip_disable).toBe(true);
    expect(log.properties.$referrer).toBe("https://www.example.com/search");
    expect(JSON.stringify(log)).not.toContain("private");
  });

  it("gives one crawler one id, and another crawler another", () => {
    const again = buildHttpLog("phc_test", { ...input, pathname: "/about" });
    const other = buildHttpLog("phc_test", { ...input, userAgent: "ClaudeBot/1.0" });
    expect(again.distinct_id).toBe(buildHttpLog("phc_test", input).distinct_id);
    expect(other.distinct_id).not.toBe(again.distinct_id);
  });
});

describe("logCrawlerVisit", () => {
  // A stand-in for PostHog's capture endpoint, so the whole path runs: the
  // decision, the request, and what is in it.
  const received: { path: string; body: { event: string; properties: Record<string, unknown> } }[] = [];
  const sink = Bun.serve({
    port: 0,
    async fetch(request) {
      received.push({ path: new URL(request.url).pathname, body: (await request.json()) as never });
      return new Response("{}");
    },
  });
  const KEYS = ["APP_ENV", "POSTHOG_KEY", "POSTHOG_HOST", "NEXT_PUBLIC_BASE_URL"] as const;
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

  beforeAll(() => {
    process.env.APP_ENV = "production";
    process.env.POSTHOG_KEY = "phc_test";
    process.env.POSTHOG_HOST = `http://127.0.0.1:${sink.port}/`;
    process.env.NEXT_PUBLIC_BASE_URL = "https://streamwizard.org";
  });
  afterAll(() => {
    sink.stop(true);
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  const visit = (userAgent: string, pathname: string, method = "GET") =>
    logCrawlerVisit({
      method,
      headers: new Headers({ "user-agent": userAgent, "x-forwarded-for": "203.0.113.7" }),
      nextUrl: { pathname, origin: "http://0.0.0.0:3000" },
    });

  it("sends a crawler visit to the capture endpoint, once", async () => {
    const first = visit("Mozilla/5.0 (compatible; GPTBot/1.2)", "/llms.txt");
    expect(first).not.toBeNull();
    await first;
    expect(visit("Mozilla/5.0 (compatible; GPTBot/1.2)", "/llms.txt")).toBeNull();

    expect(received).toHaveLength(1);
    expect(received[0]?.path).toBe("/i/v0/e/");
    expect(received[0]?.body.event).toBe("$http_log");
    expect(received[0]?.body.properties.$current_url).toBe("https://streamwizard.org/llms.txt");
    expect(JSON.stringify(received[0]?.body)).not.toContain("203.0.113.7");
  });

  it("sends nothing for a person, a private page, or outside staging and production", async () => {
    const chrome = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0.0.0 Safari/537.36";
    expect(visit(chrome, "/pricing")).toBeNull();
    expect(visit("GPTBot/1.2", "/dashboard/clips")).toBeNull();
    expect(visit("GPTBot/1.2", "/pricing", "POST")).toBeNull();
    process.env.APP_ENV = "development";
    expect(visit("GPTBot/1.2", "/about")).toBeNull();
    process.env.APP_ENV = "production";
    expect(received).toHaveLength(1);
  });

  it("does not fail the request when PostHog is unreachable", async () => {
    process.env.POSTHOG_HOST = "http://127.0.0.1:1";
    const result = visit("ClaudeBot/1.0", "/pricing");
    expect(result).not.toBeNull();
    await expect(result).resolves.toBeUndefined();
  });
});
