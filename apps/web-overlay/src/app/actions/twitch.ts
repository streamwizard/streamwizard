"use server";

import { env } from "@/lib/env";
import { getTwitchAppToken } from "@/lib/twitch-app-token";

export async function getClipDownloadUrl(
  clipId: string,
  broadcasterId: string
): Promise<string> {
  const accessToken = await getTwitchAppToken();

  const params = new URLSearchParams({
    clip_id: clipId,
    broadcaster_id: broadcasterId,
    editor_id: broadcasterId,
  });

  const res = await fetch(
    `https://api.twitch.tv/helix/clips/downloads?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Client-Id": env.TWITCH_CLIENT_ID,
      },
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Twitch API error ${res.status}: ${body}`);
  }

  const json = await res.json();
  const downloadUrl: string | undefined = json.data?.[0]?.landscape_download_url;

  if (!downloadUrl) {
    throw new Error(`No landscape_download_url returned for clip ${clipId}`);
  }

  return downloadUrl;
}
