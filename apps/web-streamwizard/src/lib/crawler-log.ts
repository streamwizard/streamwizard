import { createHash } from "node:crypto";
import { TtlCache } from "@repo/ttl-cache";

/*
 * Records visits from crawlers as PostHog `$http_log` events.
 *
 * GPTBot, ClaudeBot, Googlebot and the rest never run JavaScript, so the
 * browser SDK never sees them: whether an AI crawler has read the pricing
 * page, or found /llms.txt at all, was simply unknown. The only place they
 * show up is here, at the door.
 *
 * Deliberately narrow:
 *  - Only requests whose user agent names a crawler. PostHog sorts them into
 *    AI crawler / search crawler / plain bot itself, at query time, from the
 *    user agent; this only decides what is worth sending.
 *  - Only public pages, and only the path. No query string (a stray token
 *    must not end up in analytics), no IP, no location.
 *  - Once per crawler and path per hour, with a daily ceiling, so a crawl
 *    storm costs a few thousand events instead of the month's quota.
 */

// Named crawlers first so the common ones get a clean label; then anything
// that calls itself a bot, crawler or spider.
const NAMED_CRAWLER =
  /gptbot|oai-searchbot|chatgpt-user|claudebot|claude-user|claude-searchbot|anthropic-ai|perplexitybot|perplexity-user|google-extended|googleother|googlebot|bingbot|bingpreview|duckassistbot|duckduckbot|applebot|amazonbot|bytespider|ccbot|meta-externalagent|meta-externalfetcher|facebookexternalhit|cohere-ai|diffbot|youbot|mistralai-user|ai2bot|petalbot|yandexbot|baiduspider|slurp/i;
const GENERIC_CRAWLER = /[a-z0-9_-]*(?:bot|crawler|spider)\b/i;

/** The crawler's own name for itself, lower-cased, or null for anything else. */
export function crawlerName(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const match = NAMED_CRAWLER.exec(userAgent) ?? GENERIC_CRAWLER.exec(userAgent);
  return match ? match[0].toLowerCase().slice(0, 40) : null;
}

// Signed-in areas and plumbing. A crawler has no business there, and a path
// under them can carry an id.
const PRIVATE_PREFIXES = [
  "/dashboard",
  "/deck",
  "/settings",
  "/account",
  "/api",
  "/auth",
  "/ingest",
  "/monitoring",
  "/_next",
];

export function isPublicPageRequest(method: string, pathname: string): boolean {
  if (method !== "GET" && method !== "HEAD") return false;
  return !PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

const HOUR_MS = 60 * 60 * 1000;
const MAX_PER_DAY = 5000;

/** Decides whether this crawler visit is sent. Lives in memory, so it resets with the process. */
export function createCrawlerLimiter(now: () => number = Date.now) {
  const seen = new TtlCache<true>({ ttlMs: HOUR_MS, maxEntries: 5000, now });
  let day = "";
  let sentToday = 0;
  return (crawler: string, pathname: string): boolean => {
    const today = new Date(now()).toISOString().slice(0, 10);
    if (today !== day) {
      day = today;
      sentToday = 0;
    }
    if (sentToday >= MAX_PER_DAY) return false;
    const key = `${crawler} ${pathname}`;
    if (seen.get(key)) return false;
    seen.set(key, true);
    sentToday++;
    return true;
  };
}

export interface HttpLogInput {
  userAgent: string;
  method: string;
  pathname: string;
  /** Our public origin, e.g. https://streamwizard.org. */
  origin: string;
  referer: string | null;
  environment: string;
}

function withoutQuery(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return null;
  }
}

export function buildHttpLog(apiKey: string, input: HttpLogInput) {
  const referrer = withoutQuery(input.referer);
  return {
    api_key: apiKey,
    event: "$http_log",
    // One id per crawler, from its user agent. PostHog's own example hashes
    // the IP in too; we never forward the IP, so we don't have one to hash.
    distinct_id: `http_log_${createHash("sha256").update(input.userAgent).digest("hex").slice(0, 32)}`,
    properties: {
      $process_person_profile: false,
      // The request PostHog receives comes from our server, not the crawler:
      // its address says nothing about the visit, so no location from it.
      $geoip_disable: true,
      $current_url: `${input.origin}${input.pathname}`,
      $host: new URL(input.origin).host,
      $pathname: input.pathname,
      ...(referrer ? { $referrer: referrer } : {}),
      $raw_user_agent: input.userAgent.slice(0, 500),
      method: input.method,
      app: "web-streamwizard",
      environment: input.environment,
    },
  };
}

const allow = createCrawlerLimiter();
const SENDING_ENVIRONMENTS = new Set(["production", "staging"]);

/**
 * Returns the send as a promise when this request is a crawler visit worth
 * recording, or null. The caller hands the promise to `event.waitUntil`, so
 * the response never waits for PostHog.
 */
export function logCrawlerVisit(request: {
  method: string;
  headers: Headers;
  nextUrl: { pathname: string; origin: string };
}): Promise<void> | null {
  const environment = process.env.APP_ENV || process.env.NODE_ENV || "";
  if (!SENDING_ENVIRONMENTS.has(environment)) return null;
  const apiKey = process.env.POSTHOG_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) return null;

  const userAgent = request.headers.get("user-agent");
  const crawler = crawlerName(userAgent);
  const { pathname } = request.nextUrl;
  if (!userAgent || !crawler || !isPublicPageRequest(request.method, pathname)) return null;
  if (!allow(crawler, pathname)) return null;

  const host = process.env.POSTHOG_HOST ?? process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";
  const payload = buildHttpLog(apiKey, {
    userAgent,
    method: request.method,
    pathname,
    // Behind the reverse proxy the request's own origin is the container's.
    origin: process.env.NEXT_PUBLIC_BASE_URL ?? request.nextUrl.origin,
    referer: request.headers.get("referer"),
    environment,
  });

  return fetch(`${host.replace(/\/$/, "")}/i/v0/e/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(3000),
  }).then(
    () => undefined,
    // PostHog being slow or down must stay invisible: no retry, no report.
    // A crawler hits hundreds of pages, and so would the error.
    () => undefined,
  );
}
