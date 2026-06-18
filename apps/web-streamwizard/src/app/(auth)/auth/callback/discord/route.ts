import { NextResponse } from "next/server";
import { createClient } from "@repo/supabase/next/server";
import { encryptToken } from "@repo/supabase/crypto";
import { linkDiscordIntegration, updateDiscordTokens } from "@repo/supabase/queries/user";
import { setDiscordRoleConnection } from "@/server/discord/role-connection";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  const isLocalEnv = process.env.NODE_ENV === "development";

  const origin = isLocalEnv
    ? requestUrl.origin
    : (process.env.NEXT_PUBLIC_BASE_URL ?? requestUrl.origin);

  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/dashboard/settings/integrations";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("://")
      ? rawNext
      : "/dashboard/settings/integrations";

  if (code) {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data) {
      return NextResponse.redirect(`${origin}/auth/auth-code-error`);
    }

    if (!data.session?.provider_token || !data.session?.provider_refresh_token) {
      return NextResponse.redirect(`${origin}/auth/auth-code-error`);
    }

    const identityData = data.session.user.identities?.find((identity) => identity.provider === "discord")
      ?.identity_data;

    // Supabase normalizes Discord's profile into OIDC-ish claims, not Discord's own field
    // names: provider_id/sub (not user_id), full_name (not username), avatar_url (not avatar).
    if (!identityData?.provider_id || !identityData?.full_name) {
      return NextResponse.redirect(`${origin}/auth/auth-code-error`);
    }

    try {
      await linkDiscordIntegration(supabase, {
        discord_user_id: identityData.provider_id,
        discord_username: identityData.full_name,
        avatar: identityData.avatar_url ?? null,
        email: identityData.email ?? null,
      });
    } catch (err) {
      console.log(err);
      return NextResponse.redirect(`${origin}/auth/auth-code-error`);
    }

    const encryptedAccessToken = encryptToken(data.session.provider_token);
    const encryptedRefreshToken = encryptToken(data.session.provider_refresh_token);

    const { error: err } = await updateDiscordTokens(supabase, data.session.user.id, {
      access_token_ciphertext: encryptedAccessToken.ciphertext,
      access_token_iv: encryptedAccessToken.iv,
      access_token_tag: encryptedAccessToken.authTag,
      refresh_token_ciphertext: encryptedRefreshToken.ciphertext,
      refresh_token_iv: encryptedRefreshToken.iv,
      refresh_token_tag: encryptedRefreshToken.authTag,
    });

    if (err) {
      console.log(err);
      return NextResponse.redirect(`${origin}/auth/auth-code-error`);
    }

    try {
      await setDiscordRoleConnection(data.session.provider_token, identityData.full_name);
    } catch (roleErr) {
      console.log(roleErr);
    }

    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
