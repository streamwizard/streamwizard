"use server";

import { SpotifyAccessToken } from "@/types/API/spotify-web-api";
import { supabaseAdmin } from "@/utils/supabase/admin";
import axios from "axios";
import type { AxiosRequestConfig } from "axios";
import QueryString from "qs";

const SpotifyWebAPi = axios.create({
  baseURL: "https://api.spotify.com/v1",
  headers: {
    Accept: "application/json",
  },
});

SpotifyWebAPi.interceptors.request.use(
  (config) => {
    // Assuming you have a method to get the current token...]

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

//spotify response interceptor
SpotifyWebAPi.interceptors.response.use(
  (response) => {
    return response;
  },
  //handle response error
  async function (error) {
    //originalRequest
    const originalRequest = error.config;

    //if the error status = 401 we update the token and retry
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      //get the channel from the request
      const channelID = error.response?.config.broadcasterID;

      if (!channelID) return Promise.reject("No Broadcaster ID found in request");

      const { data, error: DBerror } = await supabaseAdmin
        .from("spotify_integrations")
        .select("refresh_token, user_id")
        .eq("twitch_channel_id", +channelID)
        .single();
      if (DBerror) {
        console.log("Error getting refresh token from database");
        console.log(DBerror);
        return;
      }

      //fetch the new accessToken and update the tokens
      const newToken = await RefreshToken(data.refresh_token, data.user_id);

      if (!newToken) {
        console.log("Error refreshing token");
        return Promise.reject(error);
      }

      //update the headers for the new request
      originalRequest.headers["Authorization"] = "Bearer " + newToken;

      //make the new request
      const res = SpotifyWebAPi(originalRequest);

      return res;
    }
    return Promise.reject(error);
  }
);

export { SpotifyWebAPi };

async function RefreshToken(refresh_token: string, user_id: string): Promise<string | null> {
  try {
    const authOptions = {
      method: "post",
      url: "https://accounts.spotify.com/api/token",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID + ":" + process.env.SPOTIFY_CLIENT_SECRET).toString("base64")}`,
      },
      data: QueryString.stringify({
        grant_type: "refresh_token",
        refresh_token: refresh_token,
      }),
    };

    const response = await axios<SpotifyAccessToken>(authOptions);

    const { data, error } = await supabaseAdmin
      .from("spotify_integrations")
      .update({
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
      })
      .eq("user_id", user_id);

    if (error) {
      console.error("error updating in database tokens");
      console.log(error);
      return null;
    }

    return response.data.access_token;
  } catch (error) {
    console.error("error refreshing token");
    console.log(error);
    return null;
  }
}
