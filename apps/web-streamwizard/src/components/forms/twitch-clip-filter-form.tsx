"use client";

import {
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Field,
  FieldGroup,
  FieldLabel,
  Input,
  Switch,
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui";
import { useSession } from "@/providers/session-provider";
import { LookupTwitchGame, LookupTwitchUser } from "@/actions/twitch/twitch-api";
import { SlidersHorizontal, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SyncTwitchClipsButton from "../buttons/sync-twitch-clips";
import { DatePickerWithPresets } from "../date-picker";
import TwitchCategorySearch from "../search-bars/twitch-category-search";
import TwitchSearchBar from "../search-bars/twitch-channel-search";

export default function TwitchClipSearchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { user_metadata } = useSession();

  // Display names for ID-based filters — kept in state so chips show readable labels
  const [broadcasterName, setBroadcasterName] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [gameName, setGameName] = useState("");

  const broadcasterId = searchParams.get("broadcaster_id");
  const creatorId = searchParams.get("creator_id");
  const gameId = searchParams.get("game_id");

  useEffect(() => {
    if (!broadcasterId) { setBroadcasterName(""); return; }
    LookupTwitchUser(broadcasterId).then((d) => d && setBroadcasterName(d.display_name));
  }, [broadcasterId]);

  useEffect(() => {
    if (!creatorId) { setCreatorName(""); return; }
    LookupTwitchUser(creatorId).then((d) => d && setCreatorName(d.display_name));
  }, [creatorId]);

  useEffect(() => {
    if (!gameId) { setGameName(""); return; }
    LookupTwitchGame(gameId).then((d) => d && setGameName(d.name));
  }, [gameId]);

  // The URL is the single source of truth. Every control commits its value
  // here the moment it's complete — no Apply button, no form state to sync.
  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, val] of Object.entries(updates)) {
        if (val === null || val === "") params.delete(key);
        else params.set(key, val);
      }
      const next = params.toString();
      if (next !== searchParams.toString()) router.push(`?${next}`);
    },
    [router, searchParams]
  );

  // Free-text search is the only debounced field
  const [searchText, setSearchText] = useState(searchParams.get("search_query") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  function commitSearch(value: string) {
    updateParams({ search_query: value.length >= 3 ? value : null });
  }

  function onSearchChange(value: string) {
    setSearchText(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => commitSearch(value), 500);
  }

  const dateValue = useMemo(() => {
    const start = searchParams.get("start_date");
    if (!start) return undefined;
    const end = searchParams.get("end_date");
    return { from: new Date(start), to: end ? new Date(end) : undefined };
  }, [searchParams]);

  function onReset() {
    clearTimeout(debounceRef.current);
    setSearchText("");
    const broadcaster_id = searchParams.get("broadcaster_id");
    router.push(broadcaster_id ? `?broadcaster_id=${broadcaster_id}` : "?");
  }

  function clearFilter(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "date") {
      params.delete("start_date");
      params.delete("end_date");
    } else {
      params.delete(key);
    }
    if (key === "search_query") setSearchText("");
    router.push(`?${params.toString()}`);
  }

  const activeChips = [
    gameId ? { key: "game_id", label: gameName ? `Category: ${gameName}` : "Category" } : null,
    broadcasterId ? { key: "broadcaster_id", label: broadcasterName ? `Streamer: ${broadcasterName}` : "Streamer" } : null,
    creatorId ? { key: "creator_id", label: creatorName ? `Clipped by: ${creatorName}` : "Clipped by" } : null,
    searchParams.get("search_query") ? { key: "search_query", label: `"${searchParams.get("search_query")}"` } : null,
    searchParams.get("start_date")
      ? {
          key: "date",
          label: `${new Date(searchParams.get("start_date")!).toLocaleDateString()}${
            searchParams.get("end_date") ? ` → ${new Date(searchParams.get("end_date")!).toLocaleDateString()}` : ""
          }`,
        }
      : null,
    searchParams.get("is_featured") === "true" ? { key: "is_featured", label: "Featured only" } : null,
    searchParams.get("sort") === "views" ? { key: "sort", label: "Sort: Views" } : null,
    searchParams.get("asc") === "true" ? { key: "asc", label: "↑ Ascending" } : null,
  ].filter(Boolean) as { key: string; label: string }[];

  const advancedActiveCount = activeChips.length;

  return (
    <div className="w-full py-4 space-y-3">
      {/* Active filters bar — only visible when filters are applied */}
      {activeChips.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex flex-wrap gap-1.5 items-center flex-1 min-w-0">
            {activeChips.map((chip) => (
              <Badge key={chip.key} variant="secondary" className="gap-1 pr-1 text-xs">
                {chip.label}
                <button
                  type="button"
                  onClick={() => clearFilter(chip.key)}
                  className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5 cursor-pointer"
                  aria-label={`Remove ${chip.label} filter`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
          >
            Clear all
          </Button>
        </div>
      )}

      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} className="space-y-3">
        {/* Inputs row — search, category, filters toggle, sync all in one line */}
        <div className="flex gap-3 items-end w-full">
          <Field className="flex-1 min-w-0">
            <FieldLabel htmlFor="searchQuery">Search</FieldLabel>
            <Input
              id="searchQuery"
              value={searchText}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  clearTimeout(debounceRef.current);
                  commitSearch(searchText);
                }
              }}
              placeholder="Search clips..."
              autoComplete="off"
            />
          </Field>

          <Field className="flex-1 min-w-0">
            <FieldLabel htmlFor="game_id">Category</FieldLabel>
            <TwitchCategorySearch
              placeholder="Enter Twitch category"
              setValue={(game_id) => updateParams({ game_id })}
              value={searchParams.get("game_id") ?? ""}
              initalValue={searchParams.get("game_id")}
            />
          </Field>

          <CollapsibleTrigger asChild>
            <Button type="button" variant="outline" className="gap-2 shrink-0 cursor-pointer self-end">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {advancedActiveCount > 0 && (
                <Badge className="h-5 min-w-5 rounded-full px-1 flex items-center justify-center text-xs">{advancedActiveCount}</Badge>
              )}
            </Button>
          </CollapsibleTrigger>

          <div className="shrink-0 self-end">
            <SyncTwitchClipsButton />
          </div>
        </div>

        {/* Advanced filters panel */}
        <CollapsibleContent className="mt-3">
          <FieldGroup className="border rounded-lg p-4 space-y-4 bg-card">
            <div className="flex gap-4 items-end">
              <Field className="flex-1">
                <FieldLabel htmlFor="broadcaster_id">Streamer</FieldLabel>
                <TwitchSearchBar
                  placeholder="Enter Twitch Username"
                  onSelect={(channel) => updateParams({ broadcaster_id: channel.id })}
                  value={searchParams.get("broadcaster_id") ?? undefined}
                  initalValue={searchParams.get("broadcaster_id") || user_metadata?.sub}
                />
              </Field>

              <Field className="flex-1">
                <FieldLabel htmlFor="creator_id">Clipped by</FieldLabel>
                <TwitchSearchBar
                  placeholder="Enter Twitch Username"
                  onSelect={(channel) => updateParams({ creator_id: channel.id })}
                  value={searchParams.get("creator_id") ?? undefined}
                  initalValue={searchParams.get("creator_id")}
                />
              </Field>

              <DatePickerWithPresets
                label="Date Range"
                className="flex-1"
                value={dateValue}
                onChange={(range) =>
                  updateParams({
                    start_date: range?.from ? range.from.toISOString() : null,
                    end_date: range?.to ? range.to.toISOString() : null,
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between gap-4 flex-wrap pt-1 border-t border-border/50">
              <div className="flex items-center gap-2">
                <Switch
                  id="isFeatured"
                  checked={searchParams.get("is_featured") === "true"}
                  onCheckedChange={(checked) => updateParams({ is_featured: checked ? "true" : null })}
                />
                <FieldLabel htmlFor="isFeatured" className="font-normal cursor-pointer text-sm">
                  Featured only
                </FieldLabel>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <FieldLabel className="shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wide">Sort by</FieldLabel>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    value={searchParams.get("sort") === "views" ? "views" : "date"}
                    onValueChange={(v) => v && updateParams({ sort: v === "views" ? "views" : null })}
                  >
                    <ToggleGroupItem value="date" aria-label="Sort by date" className="cursor-pointer">
                      Date
                    </ToggleGroupItem>
                    <ToggleGroupItem value="views" aria-label="Sort by views" className="cursor-pointer">
                      Views
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                <div className="w-px h-5 bg-border" aria-hidden="true" />

                <div className="flex items-center gap-2">
                  <FieldLabel className="shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wide">Order</FieldLabel>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    value={searchParams.get("asc") === "true" ? "asc" : "desc"}
                    onValueChange={(v) => v && updateParams({ asc: v === "asc" ? "true" : null })}
                  >
                    <ToggleGroupItem value="asc" aria-label="Ascending" className="cursor-pointer">
                      ↑ Asc
                    </ToggleGroupItem>
                    <ToggleGroupItem value="desc" aria-label="Descending" className="cursor-pointer">
                      ↓ Desc
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
            </div>
          </FieldGroup>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
