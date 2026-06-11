// import { UserPreferencesForm } from "@/components/forms/user-preferences-form";
import { UserPreferencesForm } from "@/components/forms/user-preferences-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";
import { GetUserPreferences } from "@/actions/supabase/user/settings";

export default async function page() {
  const userPreferences = await GetUserPreferences();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>User Preferences</CardTitle>
        <CardDescription>Update your user preferences</CardDescription>
      </CardHeader>
      <CardContent className="w-full">
        <UserPreferencesForm UserPreferences={userPreferences} />
      </CardContent>
    </Card>
  );
}
