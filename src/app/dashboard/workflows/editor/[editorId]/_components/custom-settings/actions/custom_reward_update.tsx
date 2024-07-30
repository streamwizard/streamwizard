import React from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox"; // Assuming you have a Checkbox component
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

interface ICustomRewardUpdateProps {}

const formSchema = z
  .object({
    title: z.string().max(45).optional(),
    prompt: z.string().max(200).optional(),
    cost: z.number().int().min(1).optional(),
    background_color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color format")
      .optional(),
    is_enabled: z.boolean().optional(),
    is_user_input_required: z.boolean().optional(),
    is_max_per_stream_enabled: z.boolean().optional(),
    max_per_stream: z.number().int().min(1).optional(),
    is_max_per_user_per_stream_enabled: z.boolean().optional(),
    max_per_user_per_stream: z.number().int().min(1).optional(),
    is_global_cooldown_enabled: z.boolean().optional(),
    global_cooldown_seconds: z.number().int().min(1).optional(),
    is_paused: z.boolean().optional(),
    should_redemptions_skip_request_queue: z.boolean().optional(),
  })
  .partial()
  .refine(
    (data) => {
      if (data.is_user_input_required && !data.prompt) {
        return false;
      }
      if (data.is_max_per_stream_enabled && !data.max_per_stream) {
        return false;
      }
      if (data.is_max_per_user_per_stream_enabled && !data.max_per_user_per_stream) {
        return false;
      }
      if (data.is_global_cooldown_enabled && !data.global_cooldown_seconds) {
        return false;
      }
      return true;
    },
    {
      message: "Conditional fields validation failed",
      path: ["body"],
    }
  );

export default function CustomRewardUpdate({}: ICustomRewardUpdateProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      prompt: "",
      cost: 0,
      background_color: "#6441A4",
      is_enabled: true,
      is_user_input_required: false,
      is_max_per_stream_enabled: false,
      max_per_stream: 0,
      is_max_per_user_per_stream_enabled: false,
      max_per_user_per_stream: 0,
      is_global_cooldown_enabled: false,
      global_cooldown_seconds: 0,
      is_paused: false,
      should_redemptions_skip_request_queue: false,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
  }

  return (
    <Form {...form} >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 overflow-scroll">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Enter title" {...field} />
              </FormControl>
              <FormDescription>The title of the reward.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="prompt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Prompt</FormLabel>
              <FormControl>
                <Input placeholder="Enter prompt" {...field} />
              </FormControl>
              <FormDescription>A short description or prompt for the reward.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="cost"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cost</FormLabel>
              <FormControl>
                <Input type="number" placeholder="Enter cost" {...field} />
              </FormControl>
              <FormDescription>The cost of the reward in points.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="background_color"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Background Color</FormLabel>
              <FormControl>
                <Input placeholder="Enter hex color" {...field} />
              </FormControl>
              <FormDescription>The background color for the reward.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="is_enabled"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Is Enabled</FormLabel>
              <FormControl>
                 <Checkbox onCheckedChange={(e) => field.onChange(e)} />
              </FormControl>
              <FormDescription>Enable or disable the reward.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="is_user_input_required"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Is User Input Required</FormLabel>
              <FormControl>
                 <Checkbox onCheckedChange={(e) => field.onChange(e)} />
              </FormControl>
              <FormDescription>Require user input for the reward.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="is_max_per_stream_enabled"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Is Max Per Stream Enabled</FormLabel>
              <FormControl>
                 <Checkbox onCheckedChange={(e) => field.onChange(e)} />
              </FormControl>
              <FormDescription>Enable or disable max per stream limit.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="max_per_stream"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Max Per Stream</FormLabel>
              <FormControl>
                <Input type="number" placeholder="Enter max per stream" {...field} />
              </FormControl>
              <FormDescription>The maximum number of times the reward can be redeemed per stream.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="is_max_per_user_per_stream_enabled"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Is Max Per User Per Stream Enabled</FormLabel>
              <FormControl>
                <Checkbox onCheckedChange={(e) => field.onChange(e)} />
              </FormControl>
              <FormDescription>Enable or disable max per user per stream limit.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="max_per_user_per_stream"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Max Per User Per Stream</FormLabel>
              <FormControl>
                <Input type="number" placeholder="Enter max per user per stream" {...field} />
              </FormControl>
              <FormDescription>The maximum number of times a single user can redeem the reward per stream.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="is_global_cooldown_enabled"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Is Global Cooldown Enabled</FormLabel>
              <FormControl>
                <Checkbox onCheckedChange={(e) => field.onChange(e)} />
              </FormControl>
              <FormDescription>Enable or disable global cooldown.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="global_cooldown_seconds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Global Cooldown Seconds</FormLabel>
              <FormControl>
                <Input type="number" placeholder="Enter global cooldown seconds" {...field} />
              </FormControl>
              <FormDescription>The cooldown time in seconds before the reward can be redeemed again.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="is_paused"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Is Paused</FormLabel>
              <FormControl>
                <Checkbox onCheckedChange={(e) => field.onChange(e)} />
              </FormControl>
              <FormDescription>Pause or unpause the reward.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="should_redemptions_skip_request_queue"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Skip Request Queue</FormLabel>
              <FormControl>
                <Checkbox onCheckedChange={(e) => field.onChange(e)} />
              </FormControl>
              <FormDescription>Skip the request queue for redemptions.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
