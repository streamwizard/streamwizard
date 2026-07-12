import { NextRequest } from "next/server";

// This proxy exists so OBS can play Twitch's signed clip MP4s (see
// ClipsWidgetContainer's proxyUrl). Only those CDNs are legitimate upstreams —
// without the allowlist this is an unauthenticated open proxy (SSRF into
// internal/metadata endpoints, plus free bandwidth for anyone).
function isAllowedUpstream(url: URL): boolean {
  if (url.protocol !== "https:") return false;
  const host = url.hostname;
  return (
    host === "twitchcdn.net" ||
    host.endsWith(".twitchcdn.net") ||
    host === "twitch.tv" ||
    host.endsWith(".twitch.tv")
  );
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return new Response("Missing url parameter", { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new Response("Invalid url parameter", { status: 400 });
  }
  if (!isAllowedUpstream(parsed)) {
    return new Response("Upstream host not allowed", { status: 403 });
  }

  const headers: Record<string, string> = {};
  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    headers["Range"] = rangeHeader;
  }

  const upstream = await fetch(url, { headers });

  if (!upstream.ok && upstream.status !== 206) {
    return new Response(`Upstream error: ${upstream.status}`, {
      status: upstream.status,
    });
  }

  const responseHeaders = new Headers({
    "Content-Type": "video/mp4",
    "Cache-Control": "no-store",
  });

  const contentLength = upstream.headers.get("content-length");
  if (contentLength) {
    responseHeaders.set("Content-Length", contentLength);
  }

  const acceptRanges = upstream.headers.get("accept-ranges");
  if (acceptRanges) {
    responseHeaders.set("Accept-Ranges", acceptRanges);
  }

  const contentRange = upstream.headers.get("content-range");
  if (contentRange) {
    responseHeaders.set("Content-Range", contentRange);
  }

  return new Response(upstream.body, {
    status: upstream.status === 206 ? 206 : 200,
    headers: responseHeaders,
  });
}
