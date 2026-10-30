import { createAdminClient } from "@repo/supabase/next/admin";
import { overlayItemFromDbRow, toPublicOverlayApiItems } from "@/types/overlays";
import { NextRequest, NextResponse } from "next/server";
import { getActiveOverlaySceneBySlug, getAllOverlayItemsByScene } from "@repo/supabase/queries/overlays";
import { overlayCorsHeaders } from "@/lib/overlay-cors";
import { reportError } from "@repo/sentry";
import { MissLimiter } from "@repo/ttl-cache/miss-limiter";

// Same rule as the overlay page in web-overlay: this answers "does this slug
// exist" too, so a caller that keeps missing gets 404s without a query.
const slugMisses = new MissLimiter({ limit: 30, windowMs: 60_000 });

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: overlayCorsHeaders(request) });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const CORS_HEADERS = overlayCorsHeaders(request);
  try {
    const { slug } = await params;
    const ip = request.headers.get("cf-connecting-ip")?.trim();
    if (ip && slugMisses.isBlocked(ip)) {
      return NextResponse.json({ error: "Overlay not found or not active" }, { status: 404, headers: CORS_HEADERS });
    }

    const supabase = createAdminClient();

    const { data: scene, error: sceneError } = await getActiveOverlaySceneBySlug(supabase, slug);

    if (sceneError || !scene) {
      if (ip) slugMisses.recordMiss(ip);
      return NextResponse.json(
        { error: "Overlay not found or not active" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const { data: items, error: itemsError } = await getAllOverlayItemsByScene(supabase, scene.id);

    if (itemsError) {
      return NextResponse.json(
        { error: "Failed to load overlay items" },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const overlayItems = (items ?? []).map((row) => overlayItemFromDbRow(row));
    const payload = {
      id: scene.id,
      name: scene.name,
      slug: scene.slug,
      width: scene.width,
      height: scene.height,
      items: toPublicOverlayApiItems(overlayItems, scene),
    };

    return NextResponse.json(payload, {
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    reportError(error, "api/overlays/[slug]");
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
