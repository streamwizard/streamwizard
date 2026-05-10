import { GetClipDownloadURL } from "@/actions/twitch/clips";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clipId } = await request.json();

    if (!clipId) {
      return NextResponse.json(
        { error: "Missing clipId" },
        { status: 400 }
      );
    }

    const result = await GetClipDownloadURL(clipId, user.id);

    if (!result.success || !result.data?.data?.[0]) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    const clip = result.data.data[0];

    return NextResponse.json({
      landscape_url: clip.landscape_download_url,
      portrait_url: clip.portrait_download_url,
    });
  } catch (error) {
    console.error("Error fetching clip preview URL:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
