import type { CaptureResult } from "posthog-js";

// Query params that must never reach PostHog, wherever they show up: OAuth
// codes on the auth callbacks, and anything credential-shaped a future page
// might put in a URL. Everything else (utm_*, ?code-less filters) passes.
const SENSITIVE_PARAMS = [
  "code",
  "state",
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "api_key",
  "apikey",
  "secret",
  "email",
];

function scrubUrl(value: unknown): unknown {
  if (typeof value !== "string" || !value.includes("?")) return value;
  try {
    const url = new URL(value, window.location.origin);
    let changed = false;
    for (const param of SENSITIVE_PARAMS) {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        changed = true;
      }
    }
    if (!changed) return value;
    return /^https?:\/\//.test(value) ? url.toString() : url.pathname + url.search + url.hash;
  } catch {
    return value;
  }
}

// CMS preview links (/preview/<token>) show unpublished drafts to whoever
// has the link. Nothing on those pages is tracked, and a token that shows up
// in a later event is masked wherever it sits: PostHog copies the previous
// page into $prev_pageview_pathname, and web vitals nest the navigation URL.
const PREVIEW_PATH = /\/preview\/[A-Za-z0-9_-]{8,}/g;

function onPreviewPage(properties: Record<string, unknown>): boolean {
  const pathname = properties.$pathname ?? properties.$current_url;
  if (typeof pathname !== "string") return false;
  try {
    return new URL(pathname, window.location.origin).pathname.startsWith("/preview/");
  } catch {
    return false;
  }
}

function maskPreviewPaths(value: unknown, depth = 0): unknown {
  if (typeof value === "string")
    return value.includes("/preview/") ? value.replace(PREVIEW_PATH, "/preview/[token]") : value;
  if (depth > 8 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => maskPreviewPaths(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) out[key] = maskPreviewPaths(item, depth + 1);
  return out;
}

export function scrubEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event?.properties) return event;
  if (onPreviewPage(event.properties)) return null;
  for (const key of ["$current_url", "$referrer", "$initial_referrer", "href"]) {
    if (key in event.properties) event.properties[key] = scrubUrl(event.properties[key]);
  }
  event.properties = maskPreviewPaths(event.properties) as CaptureResult["properties"];
  if (event.$set) event.$set = maskPreviewPaths(event.$set) as CaptureResult["$set"];
  if (event.$set_once) event.$set_once = maskPreviewPaths(event.$set_once) as CaptureResult["$set_once"];
  return event;
}
