import { createAdminClient } from "@/lib/supabase/admin";
import { buildOverlayClipQuery } from "@/components/overlays/clip-query-builder";
import { clipsWidgetConfigSchema } from "@/schemas/overlay";
import {
  asClipDisplayFieldConfig,
  buildCompositeClipsConfig,
  type ClipsWidgetConfig,
  type OverlayItemConfig,
  overlayItemFromDbRow,
} from "@/types/overlays";
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
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const itemId = request.nextUrl.searchParams.get("itemId");

    if (!itemId) {
      return NextResponse.json(
        { error: "Missing itemId parameter" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

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

    const { data: itemRow, error: itemError } = await supabase
      .from("overlay_items")
      .select("*")
      .eq("id", itemId)
      .eq("scene_id", scene.id)
      .single();

    if (itemError || !itemRow) {
      return NextResponse.json(
        { error: "Widget not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const { data: sceneItemsRows, error: sceneItemsError } = await supabase
      .from("overlay_items")
      .select("*")
      .eq("scene_id", scene.id);

    if (sceneItemsError) {
      return NextResponse.json(
        { error: "Failed to load overlay items" },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const allItems = (sceneItemsRows ?? []).map((row) => overlayItemFromDbRow(row));

    let parentId = itemRow.id;
    if (itemRow.type === "clip_display_field") {
      parentId = asClipDisplayFieldConfig(
        itemRow.config as unknown as OverlayItemConfig
      ).parentClipItemId;
    }

    const parentItem = allItems.find((i) => i.id === parentId);
    if (!parentItem || parentItem.type !== "clips_widget") {
      return NextResponse.json(
        { error: "Widget not found or not a clips widget" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const config = buildCompositeClipsConfig(parentItem, allItems);
    const parsed = clipsWidgetConfigSchema.safeParse(config);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid widget configuration" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const validConfig = parsed.data as ClipsWidgetConfig;

    const { data: twitchIntegration } = await supabase
      .from("integrations_twitch")
      .select("twitch_user_id")
      .eq("user_id", scene.user_id)
      .single();

    const twitchUserId = twitchIntegration?.twitch_user_id ?? null;

    let query = supabase
      .from("clips")
      .select(
        "id, twitch_clip_id, title, url, embed_url, thumbnail_url, duration, broadcaster_name, creator_name, game_id, game_name, view_count, created_at_twitch, is_featured"
      );

    query = buildOverlayClipQuery(validConfig, query);

    // For non-folder mode, scope by Twitch broadcaster identity rather than app user_id.
    if (validConfig.folderIds.length === 0 && twitchUserId) {
      query = query.eq("broadcaster_id", twitchUserId);
    }

    if (validConfig.folderIds.length > 0) {
      const { data: junctions } = await supabase
        .from("clip_folder_junction")
        .select("clip_id")
        .eq("user_id", scene.user_id)
        .in("folder_id", validConfig.folderIds);

      if (junctions && junctions.length > 0) {
        const clipIds = [...new Set(junctions.map((j) => j.clip_id))];
        query = query.in("twitch_clip_id", clipIds);
      } else {
        return NextResponse.json(
          { clips: [] },
          { headers: CORS_HEADERS }
        );
      }
    }

    const { data: clips, error: clipsError } = await query;

    if (clipsError) {
      console.error("Error fetching clips for overlay:", clipsError);
      return NextResponse.json(
        { error: "Failed to fetch clips" },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    let finalClips = clips ?? [];

    if (validConfig.sort === "random") {
      finalClips = finalClips.sort(() => Math.random() - 0.5);
    }

    return NextResponse.json(
      {
        clips: finalClips,
        displayFields: validConfig.displayFields,
        refreshIntervalSeconds: validConfig.refreshIntervalSeconds,
      },
      {
        headers: {
          ...CORS_HEADERS,
          "Cache-Control": `public, s-maxage=${Math.min(validConfig.refreshIntervalSeconds, 60)}, stale-while-revalidate=${validConfig.refreshIntervalSeconds}`,
        },
      }
    );
  } catch (error) {
    console.error("Error in overlay clips endpoint:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
