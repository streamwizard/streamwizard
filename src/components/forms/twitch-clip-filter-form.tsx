"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSession } from "@/providers/session-provider";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
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

  isFeatured: z.boolean().optional(),
  searchQuery: z.string().optional(),
  broadcaster_id: z.string().optional(),
  sort: z.enum(["date", "views"]).optional(),
  asc: z.boolean().optional(),
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
      game_id: searchParams.get("game_id") || undefined,
      creator_id: searchParams.get("creator_id") || undefined,
      date: undefined,
      isFeatured: searchParams.get("isFeatured") === "true" || false,
      searchQuery: searchParams.get("search_query") || undefined,
      broadcaster_id: searchParams.get("broadcaster_id") || undefined,
      sort: (searchParams.get("sort") as "date" | "views") || "date",
      asc: searchParams.get("asc") === "true" || false,
    },
  });

  // listen for changes in the search params
  useEffect(() => {
    form.reset({
      game_id: searchParams.get("game_id") || undefined,
      creator_id: searchParams.get("creator_id") || undefined,
      isFeatured: searchParams.get("is_featured") === "true" || false,
      searchQuery: searchParams.get("search_query") || undefined,
      broadcaster_id: searchParams.get("broadcaster_id") || undefined,
      sort: (searchParams.get("sort") as "date" | "views") || "date",
      asc: searchParams.get("asc") === "true" || false,

      date: searchParams.get("start_date")
        ? {
            from: searchParams.get("start_date") ? new Date(searchParams.get("start_date")!) : undefined,
            to: searchParams.get("end_date") ? new Date(searchParams.get("end_date")!) : undefined,
          }
        : undefined,
    });
  }, [searchParams, form]);

  // Handle form submission
  function onSubmit(values: FormValues) {
    const params = new URLSearchParams();
    if (values.game_id && values.game_id.length >= 4) params.set("game_id", values.game_id);
    if (values.creator_id && values.creator_id.length >= 4) params.set("creator_id", values.creator_id);
    if (values.date?.from) params.set("start_date", values.date.from.toISOString());
    if (values.date?.to) params.set("end_date", values.date.to.toISOString());
    if (values.isFeatured) params.set("is_featured", "true");
    if (values.searchQuery && values.searchQuery.length >= 4) params.set("search_query", values.searchQuery);
    if (values.broadcaster_id && values.broadcaster_id.length >= 4) params.set("broadcaster_id", values.broadcaster_id);
    if (values.sort) params.set("sort", values.sort);
    else params.set("sort", "date"); // default sort
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
    <div className="w-full">
      <form onSubmit={form.handleSubmit(onSubmit, console.error)} id="twitch-clip-filter-form" className="space-y-8 w-full mx-auto p-4 flex flex-col justify-between items-end">
        <FieldGroup>
          <div className="flex justify-between w-full gap-4">
            <Controller
              control={form.control}
              name="searchQuery"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="w-full">
                  <FieldLabel htmlFor="searchQuery">Search Query</FieldLabel>
                  <Input
                    {...field}
                    id="searchQuery"
                    placeholder="Enter search query"
                    aria-invalid={fieldState.invalid}
                    autoComplete="off"
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="broadcaster_id"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="w-full">
                  <FieldLabel htmlFor="broadcaster_id">Streamer</FieldLabel>
                  <TwitchSearchBar
                    placeholder="Enter Twitch Username"
                    onSelect={(channel) => field.onChange(channel.id)}
                    value={field.value}
                    initalValue={field.value ? field.value : user_metadata?.sub}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </div>

          <div className="flex gap-4 justify-between w-full items-end">
            <Controller
              control={form.control}
              name="game_id"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="w-full">
                  <FieldLabel htmlFor="game_id">Twitch Category</FieldLabel>
                  <TwitchCategorySearch
                    placeholder="Enter Twitch category"
                    setValue={(category) => field.onChange(category)}
                    value={field.value}
                    initalValue={searchParams.get("game_id")}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="creator_id"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="w-full">
                  <FieldLabel htmlFor="creator_id">Clipped by</FieldLabel>
                  <TwitchSearchBar
                    placeholder="Enter Twitch Username"
                    onSelect={(channel) => field.onChange(channel.id)}
                    value={field.value}
                    reset={() => field.onChange("")}
                    initalValue={searchParams.get("creator_id")}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            {/* <DatePickerWithPresets name="date" label="Date Range" /> */}
            <Controller
              control={form.control}
              name="isFeatured"
              render={({ field, fieldState }) => (
                <Field
                  data-invalid={fieldState.invalid}
                  orientation="horizontal"
                  className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-2 w-full"
                >
                  <Checkbox
                    id="isFeatured"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-invalid={fieldState.invalid}
                  />
                  <div className="space-y-1 leading-none">
                    <FieldLabel htmlFor="isFeatured">Is Featured</FieldLabel>
                  </div>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </div>

          <div className="w-full flex justify-between">
            <Controller
              control={form.control}
              name="sort"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="space-y-3 w-full">
                  <FieldLabel>Sort on</FieldLabel>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="flex w-full"
                    aria-invalid={fieldState.invalid}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="date" id="sort-date" />
                      <FieldLabel htmlFor="sort-date" className="font-normal">
                        Date
                      </FieldLabel>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="views" id="sort-views" />
                      <FieldLabel htmlFor="sort-views" className="font-normal">
                        Views
                      </FieldLabel>
                    </div>
                  </RadioGroup>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="asc"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="space-y-3">
                  <FieldLabel>Order</FieldLabel>
                  <RadioGroup
                    onValueChange={(value) => (value === "ascending" ? field.onChange(true) : field.onChange(false))}
                    value={field.value ? "ascending" : "descending"}
                    className="flex"
                    aria-invalid={fieldState.invalid}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="ascending" id="order-asc" />
                      <FieldLabel htmlFor="order-asc" className="font-normal">
                        Ascending
                      </FieldLabel>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="descending" id="order-desc" />
                      <FieldLabel htmlFor="order-desc" className="font-normal">
                        Descending
                      </FieldLabel>
                    </div>
                  </RadioGroup>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </div>
        </FieldGroup>

        <Button type="submit" form="twitch-clip-filter-form" className="w-full">
          Search
        </Button>

        <div className="flex gap-4 justify-between w-full items-end">
          <Button type="button" variant={"outline"} onClick={onReset} className="w-full">
            Reset Filters
          </Button>
          <SyncTwitchClipsButton />
        </div>
      </form>
    </div>
  );
}
