"use client";

import { updateUserPreferences } from "@/actions/supabase/user/settings";
import { useSession } from "@/providers/session-provider";
import { useSessionStore } from "@/stores/session-store";
import { userPreferencesSchema } from "@/schemas/user-preferences";
import { Database } from "@repo/supabase";
import { zodResolver } from "@hookform/resolvers/zod";
import { Clapperboard, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@repo/ui";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@repo/ui";
import { Label } from "@repo/ui";
import { Switch } from "@repo/ui";

interface UserPreferencesFormProps {
  UserPreferences: Database["public"]["Tables"]["user_preferences"]["Row"] | null;
}

export function UserPreferencesForm({ UserPreferences }: UserPreferencesFormProps) {
  const { id } = useSession();
  const setPreference = useSessionStore((s) => s.setPreference);
  const form = useForm<z.infer<typeof userPreferencesSchema>>({
    resolver: zodResolver(userPreferencesSchema),
    defaultValues: {
      sync_clips_on_end: UserPreferences?.sync_clips_on_end ?? false,
      theme_animations_enabled: UserPreferences?.theme_animations_enabled ?? true,
    },
  });

  // 2. Define a submit handler.
  function onSubmit(values: z.infer<typeof userPreferencesSchema>) {
    toast.promise(updateUserPreferences(id, values), {
      loading: "Updating preferences...",
      success: () => {
        if (values.theme_animations_enabled !== undefined)
          setPreference("theme_animations_enabled", values.theme_animations_enabled);
        if (values.sync_clips_on_end !== undefined)
          setPreference("sync_clips_on_end", values.sync_clips_on_end);
        return "Preferences updated successfully!";
      },
      error: "Failed to update preferences. Please try again.",
    });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit, (error) => {
          console.error(error);
        })}
        className=" flex flex-col h-full justify-between w-full"
      >
        <div className="grid gap-2">
          <div className="grid gap-1">
            <FormField
              name="sync_clips_on_end"
              control={form.control}
              render={({ field }) => (
                <FormItem className="flex flex-col items-start gap-3 space-y-0 w-full ">
                  <FormControl className="w-full">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <Clapperboard className="h-5 w-5 text-muted-foreground" />
                        <Label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          Automatically sync Twitch clips once your stream ends.
                        </Label>
                      </div>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="theme_animations_enabled"
              control={form.control}
              render={({ field }) => (
                <FormItem className="flex flex-col items-start gap-3 space-y-0 w-full">
                  <FormControl className="w-full">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <Sparkles className="h-5 w-5 text-muted-foreground" />
                        <Label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          Play animations when switching themes.
                        </Label>
                      </div>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        <Button type="submit" className="ml-auto">
          Save
        </Button>
      </form>
    </Form>
  );
}
