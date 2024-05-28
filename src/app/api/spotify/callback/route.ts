import { auth } from "@/auth";
import { createClient } from "@/lib/supabase/server";
import { CurrentUsersProfileResponse } from "@/types/API/spotify-web-api";
import axios from "axios";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const session = await auth();

  // check for session
  if (!session) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }

  const user_id = session?.user.id;

  if (!user_id) {
    return NextResponse.json({ error: "No user id found" }, { status: 401 });
  }

  const supabase = createClient(session?.supabaseAccessToken as string);


  if (!code) {
    return Response.json({ error: "No code provided" }, { status: 400 });
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

    if (!spotify_user_data) {
      return NextResponse.json({ error: "No user data found" }, { status: 401 });
    }

    const { status, error } = await supabase.from("spotify_integrations").insert({
      account: spotify_user_data.display_name!,
      user_id: user_id,
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      email: spotify_user_data?.email,
      spotify_id: spotify_user_data.id,
    });

    console.error(error);

    // Handle successful response with the access token in response.data
    return NextResponse.redirect(`${origin}/dashboard/settings`);
  } catch (error) {
    console.error(error);
    redirect(`/error?error=${error}}`);
  }
}

// get the spotify user data'
async function getSpotifyUserData<SpotifyUser>(access_token: string) {
  try {
    const response = await axios.get<CurrentUsersProfileResponse>("https://api.spotify.com/v1/me", {
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
