"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SpotifySongRequestSettingsSchema } from "@/schemas/spotify-song-request-settings";
import { Switch } from "../ui/switch";

interface Props {
  settings?: any;
}

export default function SpotifySongRequestSettings({ settings }: Props) {
  const form = useForm<z.infer<typeof SpotifySongRequestSettingsSchema>>({
    resolver: zodResolver(SpotifySongRequestSettingsSchema),
    defaultValues: {
      global_queue_limit: settings?.global_queue_limit || 10,
      chatter_queue_limit: settings?.chatter_queue_limit || 5,
      live_only: settings?.live_only || false,
    },
  });

  // 2. Define a submit handler.
  async function onSubmit(values: z.infer<typeof SpotifySongRequestSettingsSchema>) {
    // Update command
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
                    <Switch {...field} />
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
                  <Input placeholder="!song" {...field} />
                </FormControl>
                <FormDescription>Maximum number of songs allowed in the queue.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="global_queue_limit"
            render={({ field }) => (
              <FormItem className="mx-2">
                <FormLabel>Chatter Queue Limit</FormLabel>
                <FormControl>
                  <Select onValueChange={(value) => field.onChange(value)} value={field.value}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Actions</SelectLabel>
                        <SelectItem value="null">None</SelectItem>
                        <SelectItem value="spotify.play">Play</SelectItem>
                        <SelectItem value="spotify.pause">Pause</SelectItem>
                        <SelectItem value="spotify.song_request">Song Request</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormDescription>"Maximum number of songs a viewer can queue.</FormDescription>
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
