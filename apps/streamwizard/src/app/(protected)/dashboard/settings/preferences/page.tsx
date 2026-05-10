// import { UserPreferencesForm } from "@/components/forms/user-preferences-form";
import { UserPreferencesForm } from "@/components/forms/user-preferences-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GetUserPreferences } from "@/actions/supabase/user/settings";

export default async function page() {
  const userPreferences = await GetUserPreferences();

  return (
    <Card className="w-full flex flex-col justify-between">
      <CardHeader>
        <CardTitle>User Preferences</CardTitle>
        <CardDescription>Update your user preferences</CardDescription>
      </CardHeader>
      <CardContent className="h-full w-full">
        <UserPreferencesForm UserPreferences={userPreferences} />
      </CardContent>
    </Card>
  );
}
