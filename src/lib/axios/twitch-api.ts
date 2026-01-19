"use server";
import { env } from "../env";
import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig, AxiosInstance } from "axios";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { encryptToken, decryptToken } from "@/server/crypto";

// Custom interface extending InternalAxiosRequestConfig
interface TwitchAPIConfig extends InternalAxiosRequestConfig {
  broadcasterID?: string;
  _retry?: boolean;
}

// Create the Axios instance
const TwitchAPI: AxiosInstance = axios.create({
  baseURL: "https://api.twitch.tv/helix",
  headers: {
    Accept: "application/json",
    "Client-ID": env.NEXT_PUBLIC_TWITCH_CLIENT_ID,
  },
});

// Request interceptor
TwitchAPI.interceptors.request.use(
  async (config: TwitchAPIConfig): Promise<InternalAxiosRequestConfig> => {
    if (!config.broadcasterID) {
      throw new Error("Missing required broadcasterID in request config");
    }

    // Fetch encrypted access token
    const { data, error } = await supabaseAdmin
      .from("integrations_twitch")
      .select("access_token_ciphertext, access_token_iv, access_token_tag")
      .eq("twitch_user_id", config.broadcasterID)
      .single();

    if (error) {
      throw new Error(`Failed to fetch access token: ${error.message}`);
    }

    if (!data?.access_token_ciphertext || !data?.access_token_iv || !data?.access_token_tag) {
      throw new Error(`No access token found for user ${config.broadcasterID}`);
    }

    // Decrypt the access token
    const decryptedToken = decryptToken(data.access_token_ciphertext, data.access_token_iv, data.access_token_tag);

    // Set the access token in headers
    config.headers.Authorization = `Bearer ${decryptedToken}`;

    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

TwitchAPI.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as TwitchAPIConfig;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const channelID = originalRequest.broadcasterID;

      if (!channelID) {
        throw new Error("Missing channelID in retry request");
      }

      const { data, error: DBerror } = await supabaseAdmin
        .from("integrations_twitch")
        .select("refresh_token_ciphertext, refresh_token_iv, refresh_token_tag")
        .eq("twitch_user_id", channelID)
        .single();

      if (DBerror) {
        throw new Error(`Failed to fetch refresh token: ${DBerror.message}`);
      }

      if (!data?.refresh_token_ciphertext || !data?.refresh_token_iv || !data?.refresh_token_tag) {
        throw new Error(`No refresh token found for user ${channelID}`);
      }

      // Decrypt the refresh token
      const decryptedRefreshToken = decryptToken(data.refresh_token_ciphertext, data.refresh_token_iv, data.refresh_token_tag);

      const newToken = await RefreshToken(decryptedRefreshToken, channelID);

      if (!newToken) {
        throw new Error("Token refresh failed");
      }

      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers["Authorization"] = `Bearer ${newToken}`;

      return TwitchAPI(originalRequest);
    }

    return Promise.reject(error);
  }
);

interface TokenResponse {
  access_token: string;
  refresh_token: string;
}

async function RefreshToken(refreshToken: string, broadcaster_id: string): Promise<string | null> {
  try {
    const { data } = await axios.post<TokenResponse>(`https://id.twitch.tv/oauth2/token`, null, {
      params: {
        client_id: env.NEXT_PUBLIC_TWITCH_CLIENT_ID,
        client_secret: env.TWITCH_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      },
    });

    // Encrypt both tokens before storing
    const encryptedAccessToken = encryptToken(data.access_token);
    const encryptedRefreshToken = encryptToken(data.refresh_token);

    const { error } = await supabaseAdmin
      .from("integrations_twitch")
      .update({
        access_token_ciphertext: encryptedAccessToken.ciphertext,
        access_token_iv: encryptedAccessToken.iv,
        access_token_tag: encryptedAccessToken.authTag,
        refresh_token_ciphertext: encryptedRefreshToken.ciphertext,
        refresh_token_iv: encryptedRefreshToken.iv,
        refresh_token_tag: encryptedRefreshToken.authTag,
      })
      .eq("twitch_user_id", broadcaster_id);

    if (error) {
      throw new Error(`Failed to update tokens in database: ${error.message}`);
    }

    return data.access_token;
  } catch (error) {
    if (error instanceof Error) {
      console.error("Token refresh failed:", error.message);
    } else {
      console.error("Token refresh failed with unknown error");
    }
    return null;
  }
}

export { TwitchAPI };
