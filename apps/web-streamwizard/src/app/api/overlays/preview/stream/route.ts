import { createClient } from "@repo/supabase/next/server";
import { NextRequest, NextResponse } from "next/server";
import { reportError } from "@repo/sentry";
import { TtlCache } from "@repo/ttl-cache";
import { GetClipDownloadURL } from "@/actions/twitch/clips";
import { isTwitchClipId, parseClipVideoUrl } from "@/lib/clip-stream";

// A <video> element makes several range requests per clip; resolve the signed
// URL once per user and clip instead of calling Helix on each one. Twitch signs
// these URLs for hours, so ten minutes is well inside their lifetime.
const signedUrls = new TtlCache<string>({ ttlMs: 10 * 60_000, negativeTtlMs: 30_000, maxEntries: 2000 });

async function resolveSignedUrl(userId: string, clipId: string): Promise<URL | null> {
  const raw = await signedUrls.fetch(`${userId}:${clipId}`, async () => {
    const result = await GetClipDownloadURL(clipId, userId);
    return (result.success && result.data?.data?.[0]?.landscape_download_url) || null;
  });
  return parseClipVideoUrl(raw);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only a clip id is accepted. The URL to fetch is looked up on the server
    // from the caller's own clips, never taken from the request.
    const clipId = request.nextUrl.searchParams.get("clipId");
    if (!isTwitchClipId(clipId)) {
      return NextResponse.json({ error: "Missing or invalid clipId" }, { status: 400 });
    }

    const target = await resolveSignedUrl(user.id, clipId);
    if (!target) {
      return NextResponse.json({ error: "Clip not found" }, { status: 404 });
    }

    const headers: Record<string, string> = {};
    const rangeHeader = request.headers.get("range");
    if (rangeHeader) {
      headers["Range"] = rangeHeader;
    }

    const upstream = await fetch(target, { headers });

    if (!upstream.ok && upstream.status !== 206) {
      console.error("Failed to fetch video:", upstream.status);
      return NextResponse.json({ error: "Failed to fetch video" }, { status: 502 });
    }

    const responseHeaders: Record<string, string> = {
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
    };

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) responseHeaders["Content-Length"] = contentLength;

    const contentRange = upstream.headers.get("content-range");
    if (contentRange) responseHeaders["Content-Range"] = contentRange;

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    reportError(error, "api/overlays/preview/stream");
    return NextResponse.json({ error: "Stream error" }, { status: 500 });
  }
}
