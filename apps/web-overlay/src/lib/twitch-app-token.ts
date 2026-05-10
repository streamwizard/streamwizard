import { supabaseAdmin } from "@/lib/supabase/admin";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { env } from "@/lib/env";

async function updateTwitchAppToken(
  rowId: string,
  accessToken: string,
  expiresIn: number
): Promise<void> {
  const encrypted = await encryptToken(accessToken);

  const { error } = await supabaseAdmin
    .from("twitch_app_token")
    .update({
      access_token_ciphertext: encrypted.ciphertext,
      access_token_iv: encrypted.iv,
      access_token_tag: encrypted.authTag,
      expires_in: expiresIn,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rowId);

  if (error) throw error;
}

export async function getTwitchAppToken(): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("twitch_app_token")
    .select("*")
    .single();

  if (error) throw error;

  const updatedAtMs = new Date(data.updated_at).getTime();
  const expiresInMs = data.expires_in * 1000;
  const isExpired = Date.now() > updatedAtMs + expiresInMs;

  if (isExpired) {
    const body = new URLSearchParams({
      client_id: env.TWITCH_CLIENT_ID,
      client_secret: env.TWITCH_CLIENT_SECRET,
      grant_type: "client_credentials",
    });

    const response = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Twitch OAuth token refresh failed: ${response.status} ${text}`);
    }

    const oauth = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    await updateTwitchAppToken(data.id, oauth.access_token, oauth.expires_in);
    return oauth.access_token;
  }

  if (
    !data.access_token_ciphertext ||
    !data.access_token_iv ||
    !data.access_token_tag
  ) {
    throw new Error("Encrypted app token data is missing from database");
  }

  return decryptToken(
    data.access_token_ciphertext,
    data.access_token_iv,
    data.access_token_tag
  );
}
