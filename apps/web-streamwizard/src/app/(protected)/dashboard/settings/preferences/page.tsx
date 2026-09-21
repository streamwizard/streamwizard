import { UserPreferencesForm } from "@/components/forms/user-preferences-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";
import { getAuthContext } from "@/lib/auth";
import { getDiscordIntegrationByUserId, getUserPreferences } from "@repo/supabase/queries/user";

export default async function page() {
  const { supabase, user } = await getAuthContext();
  const [userPreferences, { data: discord }] = await Promise.all([
    getUserPreferences(supabase),
    getDiscordIntegrationByUserId(supabase, user.id),
  ]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>User Preferences</CardTitle>
        <CardDescription>Update your user preferences</CardDescription>
      </CardHeader>
      <CardContent className="w-full">
        <UserPreferencesForm UserPreferences={userPreferences} discordLinked={Boolean(discord?.discord_username)} />
      </CardContent>
    </Card>
  );
}
