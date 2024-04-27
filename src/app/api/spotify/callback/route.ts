import axios from "axios";
import { access } from "fs";
import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  const supabase = createClient();

  const userdata = await supabase.auth.getUser();

 

  if (!code) {
    return Response.json({ error: "No code provided" }, { status: 400 });
  }

  if(userdata.error || !userdata.data?.user) {
    return NextResponse.redirect(`${origin}/error`);
  }

  const authOptions = {
    method: "post",
    url: "https://accounts.spotify.com/api/token",
    data: {
      code,
      redirect_uri: `${origin}/api/spotify/callback`, // Replace with your redirect URI
      grant_type: "authorization_code",
    },
    headers: {
      Authorization: `Basic ${Buffer.from(process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID! + ":" + process.env.SPOTIFY_CLIENT_SECRET!).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };

  try {
    const response = await axios(authOptions);

    const spotify_user_data = await getSpotifyUserData(response.data.access_token);

    const spotify_data = {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      account: spotify_user_data.display_name,
      email: spotify_user_data.email,
      spotify_id: spotify_user_data.id,
      twitch_channel_id: +userdata.data.user.user_metadata.provider_id,
      user_id: userdata.data.user.id,
    };

   const {status, error} = await supabase.from("spotify_integrations").insert(spotify_data);

   console.log(error);

    // Handle successful response with the access token in response.data
    return NextResponse.redirect(`${origin}/dashboard/settings`);
  } catch (error) {
    console.error(error);
    redirect(`/error?error=${error}}`);
  }
}

// get the spotify user data'
async function getSpotifyUserData(access_token: string) {
  try {
    const response = await axios.get("https://api.spotify.com/v1/me", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error(error);
    return null;
  }
}
