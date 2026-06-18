"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { createClient } from "@repo/supabase/next/server";
import { deleteDiscordIntegration } from "@repo/supabase/queries/user";

export async function linkDiscord() {
  const supabase = await createClient();

  const headersList = await headers();
  const origin = headersList.get("origin");

  const { error, data } = await supabase.auth.linkIdentity({
    provider: "discord",
    options: {
      redirectTo: `${origin}/auth/callback/discord`,
      // TODO: role_connections.write removed temporarily to isolate an invalid_scope error —
      // suspected cause is Discord rejecting this scope when combined with PKCE (the default
      // flow for @supabase/ssr server clients). See https://github.com/discord/discord-api-docs/issues/5751
      scopes: "identify",
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

  await deleteDiscordIntegration(supabase, userData.user.id);

  revalidatePath("/dashboard/settings/integrations");
}
