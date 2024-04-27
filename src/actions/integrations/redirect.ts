"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import qs from "qs";

export async function OauthRedirect(integrations: string) {
  const header = headers();
  const origin = header.get("origin");

  let url: string;
  switch (integrations) {
    case "spotify":
      url =
        `https://accounts.spotify.com/authorize?` +
        qs.stringify({
          client_id: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID,
          redirect_uri: `${origin}/api/spotify/callback`,
          response_type: "code",
          scope: "user-read-email",
        });

      break;

    case "twitch":
      return;
    default:
      return;
  }

  return redirect(url);
}
