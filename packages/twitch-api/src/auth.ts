import axios from "axios";
import { getChannelAccessToken } from "@repo/supabase";
import { TwitchApiBaseClient } from "./base-client";

/**
 * OAuth housekeeping that lives on id.twitch.tv rather than the Helix API, so
 * it goes around clientApi()/appApi() and their bearer interceptors.
 */
export class TwitchAuthClient extends TwitchApiBaseClient {
  constructor(broadcaster_id: string | null = null) {
    super(broadcaster_id);
  }

  /**
   * Revoke the broadcaster's stored access token so it stops working at once.
   * Twitch does not remove the app from the user's Connections page for this;
   * only the user can do that. Resolves even when Twitch says the token is
   * already gone (400), since the outcome is the same.
   */
  async revokeUserToken(): Promise<void> {
    if (!this.broadcaster_id) {
      throw new Error("Broadcaster ID is required to revoke a user token");
    }
    const token = await getChannelAccessToken(this.broadcaster_id);
    await axios.post(
      "https://id.twitch.tv/oauth2/revoke",
      new URLSearchParams({ client_id: process.env.TWITCH_CLIENT_ID!, token }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        validateStatus: (status) => status === 200 || status === 400,
      },
    );
  }
}
