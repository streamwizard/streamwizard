"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSession } from "@/providers/session-provider";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import SyncTwitchClipsButton from "../buttons/sync-twitch-clips";
import { DatePickerWithPresets } from "../date-picker";
import TwitchCategorySearch from "../search-bars/twitch-category-search";
import TwitchSearchBar from "../search-bars/twitch-channel-search";

const formSchema = z.object({
  game_id: z.string().optional(),
  creator_id: z.string().optional(),

  date: z
    .object({
      from: z.date(),
      to: z.date().optional(),
    })
    .optional(),

  isFeatured: z.boolean().default(false),
  searchQuery: z.string().optional(),
  broadcaster_id: z.string().optional(),
  sort: z.enum(["date", "views"]).default("date"),
  asc: z.boolean().default(false),
});

export type FormValues = z.infer<typeof formSchema>;

export default function TwitchClipSearchForm() {
  "use no memo";
  const router = useRouter();
  const searchParams = useSearchParams();
  const broadcaster_id = searchParams.get("broadcaster_id");

  const { user_metadata } = useSession();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      game_id: searchParams.get("game_id") || "",
      creator_id: searchParams.get("creator_id") || "",
      date: undefined,
      isFeatured: searchParams.get("isFeatured") === "true",
      searchQuery: searchParams.get("search_query") || "",
      broadcaster_id: searchParams.get("broadcaster_id") || "",
      sort: (searchParams.get("sort") as "date" | "views") || "date",
      asc: searchParams.get("asc") === "true",
    },
  });

  // listen for changes in the search params
  useEffect(() => {
    form.reset({
      game_id: searchParams.get("game_id") || "",
      creator_id: searchParams.get("creator_id") || "",
      isFeatured: searchParams.get("is_featured") === "true",
      searchQuery: searchParams.get("search_query") || "",
      broadcaster_id: searchParams.get("broadcaster_id") || "",
      sort: (searchParams.get("sort") as "date" | "views") || "date",
      asc: searchParams.get("asc") === "true",

      date: searchParams.get("start_date")
        ? {
            from: searchParams.get("start_date") ? new Date(searchParams.get("start_date")!) : undefined,
            to: searchParams.get("end_date") ? new Date(searchParams.get("end_date")!) : undefined,
          }
        : undefined,
    });
  }, [searchParams]);

  // Handle form submission
  function onSubmit(values: FormValues) {
    const params = new URLSearchParams();
    if (values.game_id) params.set("game_id", values.game_id);
    if (values.creator_id) params.set("creator_id", values.creator_id);
    if (values.date?.from) params.set("start_date", values.date.from.toISOString());
    if (values.date?.to) params.set("end_date", values.date.to.toISOString());
    if (values.isFeatured) params.set("is_featured", "true");
    if (values.searchQuery) params.set("search_query", values.searchQuery);
    if (values.broadcaster_id) params.set("broadcaster_id", values.broadcaster_id);
    if (values.sort) params.set("sort", values.sort);
    if (values.asc) params.set("asc", "true");

    router.push(`?${params.toString()}`);
  }

  // handle reset
  function onReset() {
    form.reset();
    // if there is a broadcaster id leave it the search params
    if (broadcaster_id) {
      router.push(`?broadcaster_id=${broadcaster_id}`);
      return;
    }
    router.push("?");
  }



  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, console.error)} className="space-y-8 w-full mx-auto p-4 flex flex-col justify-between items-end">
        <div className="flex justify-between w-full gap-4">
          <FormField
            control={form.control}
            name="searchQuery"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>Search Query</FormLabel>
                <FormControl>
                  <Input placeholder="Enter search query" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="broadcaster_id"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>Streamer</FormLabel>
                <FormControl>
                  <TwitchSearchBar
                    placeholder="Enter Twitch Username"
                    onSelect={(channel) => field.onChange(channel.id)}
                    value={field.value}
                    initalValue={field.value ? field.value : user_metadata?.sub}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex gap-4 justify-between w-full items-end">
          <FormField
            control={form.control}
            name="game_id"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>Twitch Category</FormLabel>
                <FormControl>
                  <TwitchCategorySearch placeholder="Enter Twitch category" setValue={(category) => field.onChange(category)} value={field.value} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="creator_id"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>Clipped by</FormLabel>
                <FormControl>
                  <TwitchSearchBar placeholder="Enter Twitch Username" onSelect={(channel) => field.onChange(channel.id)} value={field.value} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <DatePickerWithPresets name="date" label="Date Range" />
          <FormField
            control={form.control}
            name="isFeatured"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-2 w-full">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Is Featured</FormLabel>
                </div>
              </FormItem>
            )}
          />
        </div>

        <div className="w-full flex justify-between">
          <FormField
            control={form.control}
            name="sort"
            render={({ field }) => (
              <FormItem className="space-y-3 w-full">
                <FormLabel>Sort on</FormLabel>
                <FormControl>
                  <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex w-full">
                    <FormItem className="flex items-center space-x-1 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="date" />
                      </FormControl>
                      <FormLabel className="font-normal">Date</FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-1 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="views" />
                      </FormControl>
                      <FormLabel className="font-normal">Views</FormLabel>
                    </FormItem>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="asc"
            render={({ field }) => (
              <FormItem className="space-y-3 ">
                <FormLabel>Order</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={(value) => (value === "ascending" ? field.onChange(true) : field.onChange(false))}
                    value={field.value ? "ascending" : "descending"}
                    className="flex"
                  >
                    <FormItem className="flex items-center space-x-1 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="ascending" />
                      </FormControl>
                      <FormLabel className="font-normal">ascending</FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-1 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="descending" />
                      </FormControl>
                      <FormLabel className="font-normal">descending</FormLabel>
                    </FormItem>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" className="w-full">
          Search
        </Button>

        <div className="w-full flex gap-4 ">
          <Button type="button" variant={"outline"} onClick={onReset} className="w-full">
            reset filters
          </Button>
          <SyncTwitchClipsButton />
        </div>
      </form>
    </Form>
  );
}
