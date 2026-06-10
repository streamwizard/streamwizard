"use client";

import { Badge } from "@repo/ui";
import { Button } from "@repo/ui";
import { Checkbox } from "@repo/ui";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@repo/ui";
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui";
import { Form } from "@repo/ui";
import { Input } from "@repo/ui";
import { RadioGroup, RadioGroupItem } from "@repo/ui";
import { useSession } from "@/providers/session-provider";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";
import { DatePickerWithPresets } from "../date-picker";
import TwitchCategorySearch from "../search-bars/twitch-category-search";
import TwitchSearchBar from "../search-bars/twitch-channel-search";

const FILTER_EXPANDED_KEY = "streamwizard:clips-filter-expanded";

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

function countActiveFilters(searchParams: URLSearchParams) {
  let count = 0;
  if (searchParams.get("search_query")) count++;
  if (searchParams.get("game_id")) count++;
  if (searchParams.get("creator_id")) count++;
  if (searchParams.get("start_date") || searchParams.get("end_date")) count++;
  if (searchParams.get("is_featured") === "true") count++;
  if (searchParams.get("sort") === "views") count++;
  if (searchParams.get("asc") === "true") count++;
  return count;
}

export default function TwitchClipSearchForm() {
  "use no memo";
  const router = useRouter();
  const searchParams = useSearchParams();
  const broadcaster_id = searchParams.get("broadcaster_id");

  const { user_metadata } = useSession();
  const [isExpanded, setIsExpanded] = useState(true);

  const activeFilterCount = useMemo(() => countActiveFilters(searchParams), [searchParams]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(FILTER_EXPANDED_KEY);
      if (stored !== null) {
        setIsExpanded(stored === "true");
      }
    } catch {
      // ignore read errors
    }
  }, []);

  const handleExpandedChange = (open: boolean) => {
    setIsExpanded(open);
    try {
      localStorage.setItem(FILTER_EXPANDED_KEY, String(open));
    } catch {
      // ignore write errors
    }
  };

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
    else params.set("sort", "date");
    if (values.asc) params.set("asc", "true");

    router.push(`?${params.toString()}`);
  }

  function onReset() {
    form.reset();
    if (broadcaster_id) {
      router.push(`?broadcaster_id=${broadcaster_id}`);
      return;
    }
    router.push("?");
  }

  return (
    <div className="w-full mb-6">
      <Collapsible open={isExpanded} onOpenChange={handleExpandedChange} className="w-full">
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/40"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">Clip filters</span>
                    {!isExpanded && activeFilterCount > 0 && (
                      <Badge variant="secondary" className="h-5 px-2 text-xs font-normal">
                        {activeFilterCount} active
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {isExpanded ? "Search and narrow your clips" : "Click to expand filters"}
                  </p>
                </div>
              </div>
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", isExpanded && "rotate-180")}
              />
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent className="outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit, console.error)}
                id="twitch-clip-filter-form"
                className="flex flex-col gap-5 border-t px-5 pb-5 pt-4"
              >
                <FieldGroup className="gap-5">
                  <div className="grid w-full gap-4 md:grid-cols-2">
                    <Controller
                      control={form.control}
                      name="searchQuery"
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="searchQuery">Search Query</FieldLabel>
                          <Input {...field} value={field.value ?? ""} id="searchQuery" placeholder="Enter search query" aria-invalid={fieldState.invalid} autoComplete="off" />
                          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                      )}
                    />
                    <Controller
                      control={form.control}
                      name="broadcaster_id"
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
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

                  <div className="grid w-full items-end gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Controller
                      control={form.control}
                      name="game_id"
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
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
                        <Field data-invalid={fieldState.invalid}>
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
                    <DatePickerWithPresets name="date" label="Date Range" className="w-full" />
                    <Controller
                      control={form.control}
                      name="isFeatured"
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid} className="w-full">
                          <FieldLabel htmlFor="isFeatured">Is Featured</FieldLabel>
                          <div className="flex h-9 items-center rounded-md border bg-muted/20 px-3 shadow-xs">
                            <Checkbox id="isFeatured" checked={field.value} onCheckedChange={field.onChange} aria-invalid={fieldState.invalid} />
                          </div>
                          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                      )}
                    />
                  </div>

                  <div className="grid w-full gap-4 md:grid-cols-2">
                    <Controller
                      control={form.control}
                      name="sort"
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid} className="space-y-3 rounded-lg border bg-muted/20 p-4">
                          <FieldLabel>Sort on</FieldLabel>
                          <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-wrap gap-4" aria-invalid={fieldState.invalid}>
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
                        <Field data-invalid={fieldState.invalid} className="space-y-3 rounded-lg border bg-muted/20 p-4">
                          <FieldLabel>Order</FieldLabel>
                          <RadioGroup
                            onValueChange={(value) => (value === "ascending" ? field.onChange(true) : field.onChange(false))}
                            value={field.value ? "ascending" : "descending"}
                            className="flex flex-wrap gap-4"
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

                <div className="flex w-full flex-col gap-3 sm:flex-row">
                  <Button
                    type="submit"
                    className="flex-1 border border-[#374151] !bg-[#374151] !text-white shadow-sm hover:!bg-[#eef0f4] hover:!text-foreground dark:border-transparent dark:!bg-primary dark:!text-primary-foreground dark:shadow-none dark:hover:!bg-primary/90 dark:hover:!text-primary-foreground"
                  >
                    Search
                  </Button>
                  <Button type="button" variant="outline" onClick={onReset} className="flex-1">
                    Reset Filters
                  </Button>
                </div>
              </form>
            </Form>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}
