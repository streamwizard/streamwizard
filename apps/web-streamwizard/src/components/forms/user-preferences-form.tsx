"use client";

import { updateUserPreferences } from "@/actions/supabase/user/settings";
import { useSession } from "@/providers/session-provider";
import { useSessionStore } from "@/stores/session-store";
import { userPreferencesSchema } from "@/schemas/user-preferences";
import { Database } from "@repo/supabase";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { BarChart2, Clapperboard, Radio, Sparkles, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@repo/ui";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@repo/ui";
import { Label } from "@repo/ui";
import { Switch } from "@repo/ui";

interface UserPreferencesFormProps {
  UserPreferences: Database["public"]["Tables"]["user_preferences"]["Row"] | null;
  /** Go-live posts and the live role only work with Discord linked; both switches are locked until then. */
  discordLinked: boolean;
}

export function UserPreferencesForm({ UserPreferences, discordLinked }: UserPreferencesFormProps) {
  const { id } = useSession();
  const setPreference = useSessionStore((s) => s.setPreference);
  const form = useForm<z.infer<typeof userPreferencesSchema>>({
    resolver: zodResolver(userPreferencesSchema),
    defaultValues: {
      sync_clips_on_end: UserPreferences?.sync_clips_on_end ?? true,
      memes_enabled: UserPreferences?.memes_enabled ?? true,
      show_stream_stats: UserPreferences?.show_stream_stats ?? true,
      discord_live_notifications: UserPreferences?.discord_live_notifications ?? true,
      discord_live_role: UserPreferences?.discord_live_role ?? true,
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
        if (values.discord_live_notifications !== undefined)
          setPreference("discord_live_notifications", values.discord_live_notifications);
        if (values.discord_live_role !== undefined)
          setPreference("discord_live_role", values.discord_live_role);
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
                        Sync Twitch clips automatically: every five minutes while you&apos;re live, and once more when the stream ends.
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
          <FormField
            name="discord_live_notifications"
            control={form.control}
            render={({ field }) => (
              <FormItem className="space-y-0 w-full">
                <FormControl className="w-full">
                  <div className="flex items-center justify-between min-h-[56px] py-3 gap-4">
                    <div className="flex items-center gap-3">
                      <Radio className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <div className="flex flex-col gap-0.5">
                        <Label className="text-sm font-medium leading-snug cursor-pointer">
                          Post in the StreamWizard Discord when I go live
                        </Label>
                        <span className="text-xs text-muted-foreground">
                          {discordLinked ? (
                            "Your title, game and a link land in the StreamWizard server the moment you go live."
                          ) : (
                            <>
                              Only works while your Discord is linked.{" "}
                              <Link href="/dashboard/settings/integrations" className="underline underline-offset-4">
                                Link it
                              </Link>{" "}
                              and this switches on.
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                    <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!discordLinked} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="discord_live_role"
            control={form.control}
            render={({ field }) => (
              <FormItem className="space-y-0 w-full">
                <FormControl className="w-full">
                  <div className="flex items-center justify-between min-h-[56px] py-3 gap-4">
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <div className="flex flex-col gap-0.5">
                        <Label className="text-sm font-medium leading-snug cursor-pointer">
                          Show me as live in the StreamWizard Discord
                        </Label>
                        <span className="text-xs text-muted-foreground">
                          {discordLinked ? (
                            "You get the Live role while you stream, so you sit at the top of the member list. It comes off when you go offline."
                          ) : (
                            <>
                              Only works while your Discord is linked.{" "}
                              <Link href="/dashboard/settings/integrations" className="underline underline-offset-4">
                                Link it
                              </Link>{" "}
                              and this switches on.
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                    <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!discordLinked} />
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
