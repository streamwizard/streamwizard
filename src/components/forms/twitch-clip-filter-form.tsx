"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, ControllerRenderProps, FieldValues } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import TwitchCategorySearch from "../search-bars/twitch-category-search";
import TwitchSearchBar from "../search-bars/twitch-channel-search";
import SyncTwitchClipsButton from "../buttons/sync-twitch-clips";
import { useSession } from "@/providers/session-provider";

const formSchema = z.object({
  game_id: z.string().optional(),
  creator_id: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  isFeatured: z.boolean().default(false),
  searchQuery: z.string().optional(),
  broadcaster_id: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface DatePickerFormFieldProps {
  control: any;
  name: "start_date" | "end_date";
  label: string;
}

function DatePickerFormField({ control, name, label }: DatePickerFormFieldProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }: { field: ControllerRenderProps<FieldValues, typeof name> }) => (
        <FormItem className="flex flex-col justify-center">
          <FormLabel>{label}</FormLabel>
          <Popover>
            <PopoverTrigger asChild>
              <FormControl>
                <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal space-y-0", !field.value && "text-muted-foreground")}>
                  {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={new Date(field.value)}
                onSelect={(e) => field.onChange(e?.toISOString())}
                disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

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
      start_date: searchParams.get("start_date") || "",
      end_date: searchParams.get("end_date") || "",
      isFeatured: searchParams.get("isFeatured") === "true",
      searchQuery: searchParams.get("search_query") || "",
      broadcaster_id: searchParams.get("broadcaster_id") || "",
    },
  });

  // Handle form submission
  function onSubmit(values: FormValues) {
    const params = new URLSearchParams();
    if (values.game_id) params.set("game_id", values.game_id);
    if (values.creator_id) params.set("creator_id", values.creator_id);
    if (values.start_date) params.set("start_date", values.start_date);
    if (values.end_date) params.set("end_date", values.end_date);
    if (values.isFeatured) params.set("is_featured", "true");
    if (values.searchQuery) params.set("search_query", values.searchQuery);
    if (values.broadcaster_id) params.set("broadcaster_id", values.broadcaster_id);

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
          <DatePickerFormField control={form.control} name="start_date" label="Start Date" />
          <DatePickerFormField control={form.control} name="end_date" label="End Date" />
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
