"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SpotifySongRequestSettingsSchema } from "@/schemas/spotify-song-request-settings";
import { SpotifySettingsTable } from "@/types/database";
import { Switch } from "../ui/switch";
import { updateSpotifySettings } from "@/actions/supabase/table-spotify-settings";
import { toast } from "sonner";

interface Props {
  settings: SpotifySettingsTable
}

export default function SpotifySongRequestSettings({ settings }: Props) {
  const form = useForm<z.infer<typeof SpotifySongRequestSettingsSchema>>({
    resolver: zodResolver(SpotifySongRequestSettingsSchema),
    defaultValues: {
      global_queue_limit: settings?.global_queue_limit, 
      chatter_queue_limit: settings?.chatter_queue_limit,
      live_only: settings.live_only 
    },
  });

  // 2. Define a submit handler.
  async function onSubmit(values: z.infer<typeof SpotifySongRequestSettingsSchema>) {
    toast.promise(updateSpotifySettings(values, settings?.id as string), {
      loading: "Updating...",
      success: "Settings Updated!",
      error: "Error updating settings",
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 w-full">
        <div className="flex w-full justify-around items-center">
          <FormField
            control={form.control}
            name="live_only"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center">
                  <FormLabel>Live Only?</FormLabel>
                  <FormControl className="ml-4">
                    <Switch checked={field.value} onClick={() => field.onChange(!field.value)} />
                  </FormControl>
                </div>
                <FormDescription>Enable song requests only when you are live? </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="global_queue_limit"
            render={({ field }) => (
              <FormItem className="mx-2">
                <FormLabel>Global Queue Limit</FormLabel>
                <FormControl>
                  <Input placeholder="!song" {...field} onChange={(e) => field.onChange(e.target.valueAsNumber)} type="number" />
                </FormControl>
                <FormDescription>Maximum number of songs allowed in the queue.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="chatter_queue_limit"
            render={({ field }) => (
              <FormItem className="mx-2">
                <FormLabel>Chatter Queue Limit</FormLabel>
                <FormControl>
                <FormControl>
                  <Input placeholder="!song" {...field} onChange={(e) => field.onChange(e.target.valueAsNumber)} type="number" />
                </FormControl>
                </FormControl>
                <FormDescription>Maximum number of songs a viewer can queue.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
