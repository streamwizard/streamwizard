import { createAdminClient } from "@repo/supabase/next/admin";
import { overlayItemFromDbRow, toPublicOverlayApiItems } from "@/types/overlays";
import { NextRequest, NextResponse } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = createAdminClient();

    const { data: scene, error: sceneError } = await supabase
      .from("overlay_scenes")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (sceneError || !scene) {
      return NextResponse.json(
        { error: "Overlay not found or not active" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const { data: items, error: itemsError } = await supabase
      .from("overlay_items")
      .select("*")
      .eq("scene_id", scene.id)
      .order("z_index", { ascending: true });

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
      items: toPublicOverlayApiItems(overlayItems),
    };

    return NextResponse.json(payload, {
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    console.error("Error fetching overlay:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
