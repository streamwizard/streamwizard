"use client";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, FormSlider } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import useChannelPoints from "@/hooks/useChannelPoints";
import { secondsToMinutes } from "@/lib/utils";
import { ChannelPointSchema } from "@/schemas/channelpoint-schema";
import { TwitchChannelPointsReward } from "@/types/API/twitch";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";

interface Props {
  setModal: (value: boolean) => void;
  channelpoint?: TwitchChannelPointsReward;
}

export default function ChannelpointForm({ setModal, channelpoint }: Props) {
  const { createChannelPoint, updateChannelPoint } = useChannelPoints();

  const form = useForm<z.infer<typeof ChannelPointSchema>>({
    resolver: zodResolver(ChannelPointSchema),
    defaultValues: {
      title: channelpoint ? channelpoint.title : "",
      cost: channelpoint ? channelpoint.cost : 0,
      prompt: channelpoint ? channelpoint.prompt : "",
      action: channelpoint ? channelpoint.action : "",
      is_global_cooldown_enabled: channelpoint ? channelpoint.global_cooldown_setting.is_enabled : false,
      global_cooldown_seconds: channelpoint ? channelpoint.global_cooldown_setting.global_cooldown_seconds : 60,
      is_max_per_stream_enabled: channelpoint ? channelpoint.max_per_stream_setting.is_enabled : false,
      max_per_stream: channelpoint && channelpoint.max_per_stream_setting.is_enabled ? channelpoint.max_per_stream_setting.max_per_stream : 1,
      is_max_per_user_per_stream_enabled: channelpoint ? channelpoint.max_per_user_per_stream_setting.is_enabled : false,
      max_per_user_per_stream: channelpoint ? channelpoint.max_per_user_per_stream_setting.max_per_user_per_stream : 1,
    },
  });

  async function onSubmit(values: z.infer<typeof ChannelPointSchema>) {
    console.log(`values`, values);

    // Update command
    if (channelpoint) {
      console.log("update");
      await updateChannelPoint(values, channelpoint.id);
    }
    // Add channel point
    else {
      console.log("create");
      await createChannelPoint(values);
    }

    // setModal(false);
  }



  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit, (error) => {
          console.log(error);
        })}
        className="space-y-8"
      >
        <div className="flex">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem className="mx-2">
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="sr" {...field} />
                </FormControl>
                <FormDescription>This is your command trigger</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="action"
            render={({ field }) => (
              <FormItem className="mx-2">
                <FormLabel>Action</FormLabel>
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
                        <SelectItem value="spotify.skip">Skip</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormDescription>This is your channelpoint action</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="cost"
          render={({ field }) => (
            <FormSlider field={field} />
          )}
        />

        <div className="flex justify-between">
          <FormField
            control={form.control}
            name="is_global_cooldown_enabled"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <div className="flex justify-between">
                    <span>Global Cooldown</span>
                  </div>
                </FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={(value) => {
                      field.onChange(value);
                    }}
                  />
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="is_max_per_stream_enabled"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <div className="flex justify-between">
                    <span>Max per Stream</span>
                  </div>
                </FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={(value) => {
                      field.onChange(value);
                    }}
                  />
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="is_max_per_user_per_stream_enabled"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <div className="flex justify-between">
                    <span>Max Per User Per Stream</span>
                  </div>
                </FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={(value) => {
                      field.onChange(value);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {form.watch("is_global_cooldown_enabled") && (
          <FormField
            control={form.control}
            name="global_cooldown_seconds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <div className="flex justify-between">
                    <span>Global Cooldown</span>
                    <span className="ml-2 text-xs text-gray-500">
                      {/* <input className="w-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none bg-transparent focus:border" type="number"  {...field} /> */}
                      {secondsToMinutes(field.value ? field.value : 60)} minutes
                    </span>
                  </div>
                </FormLabel>
                <FormControl>
                  <Slider
                    min={0}
                    max={3600}
                    step={300}
                    value={[field.value ? field.value : 60]}
                    onValueChange={(value) => field.onChange(value[0])}
                  />
                </FormControl>
                <FormDescription>This is the global cooldown of the command</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {form.watch("is_max_per_stream_enabled") && (
          <FormField
            control={form.control}
            name="max_per_stream"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <div className="flex justify-between">
                    <span>Max Per Stream</span>
                    <span className="ml-2 text-xs text-gray-500">
                      {/* <input className="w-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none bg-transparent focus:border" type="number"  {...field} /> */}
                      {field.value ? field.value : 60} redemptions
                    </span>
                  </div>
                </FormLabel>
                <FormControl>
                  <Slider min={0} max={20} step={1} value={[field.value ? field.value : 1]} onValueChange={(value) => field.onChange(value[0])} />
                </FormControl>
                <FormDescription>This is the global cooldown of the command</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {form.watch("is_max_per_user_per_stream_enabled") && (
          <FormField
            control={form.control}
            name="max_per_user_per_stream"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <div className="flex justify-between">
                    <span>Max Per User Per Stream</span>
                    <span className="ml-2 text-xs text-gray-500">
                      {/* <input className="w-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none bg-transparent focus:border" type="number"  {...field} /> */}
                      {field.value ? field.value : 60} redemptions
                    </span>
                  </div>
                </FormLabel>
                <FormControl>
                  <Slider min={0} max={20} step={1} value={[field.value ? field.value : 1]} onValueChange={(value) => field.onChange(value[0])} />
                </FormControl>
                <FormDescription>This is the global cooldown of the command</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="prompt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Prompt</FormLabel>
              <FormControl>
                <Textarea placeholder="the song currely playing is ${song} by ${song.artist}}" {...field} />
              </FormControl>
              <FormDescription>This is your command return message</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
