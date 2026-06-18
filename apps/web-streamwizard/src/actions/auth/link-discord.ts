"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { createClient } from "@repo/supabase/next/server";
import { deleteDiscordIntegration, getDiscordRefreshTokenByUserId } from "@repo/supabase/queries/user";
import { decryptToken } from "@repo/supabase/crypto";
import { refreshAccessToken } from "@/server/discord/oauth";
import { setDiscordRoleConnection } from "@/server/discord/role-connection";

export async function linkDiscord() {
  const supabase = await createClient();

  const headersList = await headers();
  const origin = headersList.get("origin");

  const { error, data } = await supabase.auth.linkIdentity({
    provider: "discord",
    options: {
      redirectTo: `${origin}/auth/callback/discord`,
      // role_connections.write is required so the callback can write the user's
      // role-connection metadata, which is what grants the Verified Member Linked Role.
      scopes: "identify role_connections.write",
    },
  });

  if (error) {
    redirect("/error");
  }

  redirect(data.url);
}

export async function unlinkDiscord() {
  const supabase = await createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    redirect("/error");
  }

  const { data: identitiesData, error: identitiesError } = await supabase.auth.getUserIdentities();
  if (identitiesError) {
    redirect("/error");
  }

  const discordIdentity = identitiesData.identities.find((identity) => identity.provider === "discord");
  if (discordIdentity) {
    const { error: unlinkError } = await supabase.auth.unlinkIdentity(discordIdentity);
    if (unlinkError) {
      redirect("/error");
    }
  }

  // Best-effort: revoke the Linked Role by pushing linked=false. Supabase won't
  // refresh the Discord token for us, so refresh it directly first. A failure
  // here must not block the disconnect itself.
  try {
    const stored = await getDiscordRefreshTokenByUserId(supabase, userData.user.id);
    if (stored) {
      const refreshToken = decryptToken(
        stored.refresh_token_ciphertext,
        stored.refresh_token_iv,
        stored.refresh_token_tag
      );
      const accessToken = await refreshAccessToken(refreshToken);
      await setDiscordRoleConnection(accessToken, stored.discord_username, false);
    }
  } catch (revokeErr) {
    const { captureException } = await import("@sentry/nextjs");
    captureException(revokeErr);
  }

  await deleteDiscordIntegration(supabase, userData.user.id);

  revalidatePath("/dashboard/settings/integrations");
}
