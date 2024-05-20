"use server";

import { supabaseAdmin } from "@/utils/supabase/admin";
import axios from "axios";

const TwitchAPI = axios.create({
  baseURL: "https://api.twitch.tv/helix",
  headers: {
    Accept: "application/json",
    "Client-ID": process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID,
  },
});

TwitchAPI.interceptors.request.use(
  (config) => {
    // Assuming you have a method to get the current token...]

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

//twitch response interceptor
TwitchAPI.interceptors.response.use(
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

      const { data, error: DBerror } = await supabaseAdmin
        .from("twitch_integration")
        .select("refresh_token")
        .eq("broadcaster_id", channelID)
        .single();
      if (DBerror) {
        console.log("Tokens not found");
        return;
      }

      //fetch the new accessToken and update the tokens
      const newToken = await RefreshToken(data.refresh_token, channelID);

      if (!newToken) {
        console.log("Error refreshing token");
        return;
      }

      //update the headers for the new request
      originalRequest.headers["Authorization"] = "Bearer " + newToken;

      //make the new request
      const res = TwitchAPI(originalRequest);

      return res;
    }
    return Promise.reject(error);
  }
);

export { TwitchAPI };

async function RefreshToken(refreshToken: string, broadcaster_id: number): Promise<string | null> {
  console.log("refreshing token");
  try {
    const res = await axios.post(
      `https://id.twitch.tv/oauth2/token?client_id=${process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}&grant_type=refresh_token&refresh_token=${refreshToken}`
    );

    const { error } = await supabaseAdmin
      .from("twitch_integration")
      .update({ access_token: res.data.access_token, refresh_token: res.data.refresh_token })
      .eq("broadcaster_id", broadcaster_id);

    if (error) {
      console.log("error updating tokens");
      return null;
    }

    return res.data.access_token;
  } catch (error) {
    console.error("error refreshing token");
    console.log(error);
    return null;
  }
}
