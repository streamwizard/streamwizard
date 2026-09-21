import axios from "axios";
import { getChannelAccessToken } from "@repo/supabase";
import { TwitchApiBaseClient } from "./base-client";

const VALIDATE_URL = "https://id.twitch.tv/oauth2/validate";

/** What id.twitch.tv says about a token. `login`/`user_id` are null for app tokens. */
export interface TwitchTokenValidation {
  client_id: string;
  login: string | null;
  user_id: string | null;
  scopes: string[];
  expires_in: number;
}

/**
 * Validate a token that is already in hand, such as the provider token on the
 * sign-in callback before it is readable through the stored-token path.
 * Rejects with a 401 AxiosError when Twitch no longer honours the token.
 */
export async function validateTwitchToken(accessToken: string): Promise<TwitchTokenValidation> {
  const response = await axios.get<TwitchTokenValidation>(VALIDATE_URL, {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  return { ...response.data, scopes: response.data.scopes ?? [] };
}

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
  /**
   * Validate the broadcaster's stored token and report its scopes. Goes
   * through clientApi() so an expired token is refreshed and retried like any
   * Helix call; the absolute URL steps around the Helix base URL. Twitch
   * requires apps to validate user tokens hourly, which the rest-api sweep
   * does with this.
   */
  async validateUserToken(): Promise<TwitchTokenValidation> {
    const response = await this.clientApi().get<TwitchTokenValidation>(VALIDATE_URL);
    return { ...response.data, scopes: response.data.scopes ?? [] };
  }

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
