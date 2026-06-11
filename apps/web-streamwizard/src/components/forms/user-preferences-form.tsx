"use client";

import { updateUserPreferences } from "@/actions/supabase/user/settings";
import { useSession } from "@/providers/session-provider";
import { useSessionStore } from "@/stores/session-store";
import { userPreferencesSchema } from "@/schemas/user-preferences";
import { Database } from "@repo/supabase";
import { zodResolver } from "@hookform/resolvers/zod";
import { BarChart2, Clapperboard, Sparkles } from "lucide-react";
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
      sync_clips_on_end: UserPreferences?.sync_clips_on_end ?? true,
      memes_enabled: UserPreferences?.memes_enabled ?? true,
      show_stream_stats: UserPreferences?.show_stream_stats ?? true,
    },
  });

  // 2. Define a submit handler.
  function onSubmit(values: z.infer<typeof userPreferencesSchema>) {
    toast.promise(updateUserPreferences(id, values), {
      loading: "Updating preferences...",
      success: () => {
        if (values.memes_enabled !== undefined)
          setPreference("memes_enabled", values.memes_enabled);
        if (values.sync_clips_on_end !== undefined)
          setPreference("sync_clips_on_end", values.sync_clips_on_end);
        if (values.show_stream_stats !== undefined)
          setPreference("show_stream_stats", values.show_stream_stats);
        return "Lurk mode activated.";
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
        className="flex flex-col gap-6 w-full"
      >
        <div className="divide-y divide-border">
          <FormField
            name="sync_clips_on_end"
            control={form.control}
            render={({ field }) => (
              <FormItem className="space-y-0 w-full">
                <FormControl className="w-full">
                  <div className="flex items-center justify-between min-h-[56px] py-3 gap-4">
                    <div className="flex items-center gap-3">
                      <Clapperboard className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <Label className="text-sm font-medium leading-snug cursor-pointer">
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
            name="memes_enabled"
            control={form.control}
            render={({ field }) => (
              <FormItem className="space-y-0 w-full">
                <FormControl className="w-full">
                  <div className="flex items-center justify-between min-h-[56px] py-3 gap-4">
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <Label className="text-sm font-medium leading-snug cursor-pointer">
                        Enable memes
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
            name="show_stream_stats"
            control={form.control}
            render={({ field }) => (
              <FormItem className="space-y-0 w-full">
                <FormControl className="w-full">
                  <div className="flex items-center justify-between min-h-[56px] py-3 gap-4">
                    <div className="flex items-center gap-3">
                      <BarChart2 className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <div className="flex flex-col gap-0.5">
                        <Label className="text-sm font-medium leading-snug cursor-pointer">
                          Show stream stats
                        </Label>
                        <span className="text-xs text-muted-foreground">
                          Peak viewers, avg viewers, follows — the numbers. Turn off to see clips instead.
                        </span>
                      </div>
                    </div>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button type="submit" className="ml-auto w-full sm:w-auto">
          Save
        </Button>
      </form>
    </Form>
  );
}
