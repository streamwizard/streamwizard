import { NextRequest, NextResponse } from "next/server";
import { GetClipDownloadURL } from "@/actions/twitch/clips";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    // Authenticate the user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Get request body
    const body = await request.json();
    const { clipId, layout, broadcaster_id } = body;
    console.log("broadcaster_id:", broadcaster_id);

    if (!clipId || !layout || !broadcaster_id) {
      return NextResponse.json(
        { error: "Missing clipId or layout or broadcaster_id" },
        { status: 400 }
      );
    }

    // Get the download URL
    const urlResult = await GetClipDownloadURL(clipId, user.id, broadcaster_id);
    if (!urlResult.success || !urlResult.data) {
      return NextResponse.json(
        { error: urlResult.message },
        { status: 400 }
      );
    }

    const downloadUrl = layout === "landscape" 
      ? urlResult.data.data[0].landscape_download_url 
      : urlResult.data.data[0].portrait_download_url;

    if (!downloadUrl) {
      return NextResponse.json(
        { error: `No ${layout} download URL available` },
        { status: 404 }
      );
    }

    // Fetch the video from Twitch CDN
    const videoResponse = await fetch(downloadUrl);
    
    if (!videoResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch video from Twitch" },
        { status: videoResponse.status }
      );
    }


    // Get the video as a blob
    const videoBlob = await videoResponse.blob();

    // Return the video with appropriate headers to force download
    return new NextResponse(videoBlob, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="clip-${layout}.mp4"`,
        "Content-Length": videoBlob.size.toString(),
      },
    });
  } catch (error) {
    console.error("Error in download-clip API route:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

