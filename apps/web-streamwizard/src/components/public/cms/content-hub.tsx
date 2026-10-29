"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useDebounce } from "@uidotdev/usehooks";
import { Check, ChevronDown, Search, Tags, X } from "lucide-react";
import { captureEvent } from "@repo/posthog";
import type { ContentType } from "@repo/cms";
import {
  Button,
  cn,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui";
import {
  filtersHref,
  hasActiveFilters,
  normalizeQuery,
  NO_FILTERS,
  toQueryString,
  type ContentFilters,
  type Facets,
} from "@/lib/cms/filters";

/*
 * The search and filters above the /blog and /guides grid. The URL is the
 * only state: every control writes it, the server filters the cached list
 * and sends the new grid as `children`. While that's on its way the old grid
 * stays up, dimmed, so typing never flashes a skeleton.
 */

const SEARCH_DEBOUNCE_MS = 300;

const CHIP =
  "h-8 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 text-sm font-normal text-muted-foreground hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-foreground data-[state=on]:border-purple-400/40 data-[state=on]:bg-purple-400/[0.12] data-[state=on]:text-purple-100";

interface ContentHubProps {
  type: ContentType;
  path: string;
  filters: ContentFilters;
  facets: Facets;
  resultCount: number;
  total: number;
  /** "post"/"posts", "guide"/"guides". */
  noun: { one: string; many: string };
  children: ReactNode;
}

export function ContentHub({ type, path, filters, facets, resultCount, total, noun, children }: ContentHubProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const navigate = useCallback(
    (next: ContentFilters, mode: "push" | "replace" = "push") => {
      const href = filtersHref(path, next);
      startTransition(() => {
        if (mode === "replace") router.replace(href, { scroll: false });
        else router.push(href, { scroll: false });
      });
    },
    [path, router],
  );

  // Search text is local while typing and goes to the URL once it settles.
  const [text, setText] = useState(filters.q);
  const [shownQuery, setShownQuery] = useState(filters.q);
  if (filters.q !== shownQuery) {
    // The URL changed under us (back button, a chip, Clear): show its query.
    setShownQuery(filters.q);
    setText(filters.q);
  }
  const debounced = useDebounce(text, SEARCH_DEBOUNCE_MS);
  // An effect event: it sees the newest filters but only runs when the text settles.
  const commitQuery = useEffectEvent((raw: string) => {
    const q = normalizeQuery(raw);
    if (q !== filters.q) navigate({ ...filters, q }, "replace");
  });
  useEffect(() => commitQuery(debounced), [debounced]);

  const clearSearch = () => {
    setText("");
    if (filters.q) navigate({ ...filters, q: "" }, "replace");
  };

  useContentHubAnalytics(type, filters, resultCount);

  const active = hasActiveFilters(filters);
  const tagNames = new Map(facets.tags.map((tag) => [tag.slug, tag.name]));
  const categoryName = facets.categories.find((category) => category.slug === filters.category)?.name;
  const levelName = facets.levels.find((level) => level.value === filters.level)?.label;

  return (
    <div className="flex flex-col gap-8">
      <div role="search" aria-label={`Search and filter ${noun.many}`} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <InputGroup className="h-10 border-white/[0.1] bg-white/[0.03] sm:max-w-sm">
            <InputGroupAddon>
              <Search aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && text) {
                  event.preventDefault();
                  clearSearch();
                }
              }}
              maxLength={100}
              placeholder="Search by title"
              aria-label={`Search ${noun.many} by title`}
              className="[&::-webkit-search-cancel-button]:hidden"
            />
            {text && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={clearSearch}>
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>

          {facets.tags.length > 0 && (
            <TagPicker
              facets={facets}
              selected={filters.tags}
              onChange={(tags) => navigate({ ...filters, tags: [...tags].sort() })}
            />
          )}

          <p aria-live="polite" className="text-sm text-muted-foreground tabular-nums sm:ml-auto">
            {active ? `${resultCount} of ${total} ${noun.many}` : `${total} ${total === 1 ? noun.one : noun.many}`}
            {pending && <span className="sr-only">, updating</span>}
          </p>
        </div>

        {facets.categories.length > 1 && (
          <ChipRow label="Category">
            <ToggleGroup
              type="single"
              spacing={2}
              aria-label="Category"
              value={filters.category ?? "all"}
              onValueChange={(value) => navigate({ ...filters, category: value && value !== "all" ? value : null })}
            >
              <ToggleGroupItem value="all" className={CHIP}>
                All
              </ToggleGroupItem>
              {facets.categories.map((category) => (
                <ToggleGroupItem key={category.slug} value={category.slug} className={CHIP}>
                  {category.name}
                  <span className="text-xs tabular-nums opacity-60">{category.count}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </ChipRow>
        )}

        {type === "guide" && facets.levels.length > 1 && (
          <ChipRow label="Level">
            <ToggleGroup
              type="single"
              spacing={2}
              aria-label="Level"
              value={filters.level ?? "any"}
              onValueChange={(value) =>
                navigate({
                  ...filters,
                  level: facets.levels.find((level) => level.value === value)?.value ?? null,
                })
              }
            >
              <ToggleGroupItem value="any" className={CHIP}>
                Any level
              </ToggleGroupItem>
              {facets.levels.map((level) => (
                <ToggleGroupItem key={level.value} value={level.value} className={CHIP}>
                  {level.label}
                  <span className="text-xs tabular-nums opacity-60">{level.count}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </ChipRow>
        )}

        {active && (
          <div className="flex flex-wrap items-center gap-2">
            {filters.q && (
              <ActiveChip label={`“${filters.q}”`} kind="search" onRemove={clearSearch} />
            )}
            {filters.category && categoryName && (
              <ActiveChip
                label={categoryName}
                kind="category"
                onRemove={() => navigate({ ...filters, category: null })}
              />
            )}
            {filters.tags.map((slug) => (
              <ActiveChip
                key={slug}
                label={tagNames.get(slug) ?? slug}
                kind="tag"
                onRemove={() => navigate({ ...filters, tags: filters.tags.filter((tag) => tag !== slug) })}
              />
            ))}
            {filters.level && levelName && (
              <ActiveChip label={levelName} kind="level" onRemove={() => navigate({ ...filters, level: null })} />
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setText("");
                navigate(NO_FILTERS);
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>

      <div
        aria-busy={pending}
        className={cn("transition-opacity duration-200", pending && "opacity-50 motion-reduce:opacity-70")}
      >
        {children}
      </div>
    </div>
  );
}

/** A row of chips that scrolls sideways on a phone instead of wrapping into a wall. */
function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="hidden w-20 shrink-0 text-xs font-medium uppercase tracking-widest text-muted-foreground/70 sm:block">
        {label}
      </span>
      <div className="-mx-4 min-w-0 flex-1 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        <div className="w-max sm:w-auto">{children}</div>
      </div>
    </div>
  );
}

function ActiveChip({ label, kind, onRemove }: { label: string; kind: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-full border border-purple-400/30 bg-purple-400/[0.08] pl-3 pr-1 text-xs text-purple-100">
      <span className="sr-only">{kind}: </span>
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${kind} filter ${label}`}
        className="grid size-5 place-items-center rounded-full text-purple-200/80 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-purple-400"
      >
        <X aria-hidden className="size-3" />
      </button>
    </span>
  );
}

function TagPicker({
  facets,
  selected,
  onChange,
}: {
  facets: Facets;
  selected: string[];
  onChange: (tags: string[]) => void;
}) {
  const picked = new Set(selected);
  const toggle = (slug: string) => {
    const next = new Set(picked);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    onChange([...next]);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-10 justify-between gap-2 border-white/[0.1] bg-white/[0.03] font-normal hover:bg-white/[0.06] sm:w-auto"
        >
          <span className="inline-flex items-center gap-2">
            <Tags aria-hidden className="size-4 text-muted-foreground" />
            Tags
            {selected.length > 0 && (
              <span className="rounded-full bg-purple-400/20 px-1.5 text-xs tabular-nums text-purple-100">
                {selected.length}
                <span className="sr-only"> selected</span>
              </span>
            )}
          </span>
          <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Find a tag" />
          <CommandList>
            <CommandEmpty>No tag by that name.</CommandEmpty>
            <CommandGroup>
              {facets.tags.map((tag) => {
                const on = picked.has(tag.slug);
                return (
                  <CommandItem
                    key={tag.slug}
                    value={tag.slug}
                    keywords={[tag.name]}
                    onSelect={() => toggle(tag.slug)}
                    aria-selected={on}
                    data-checked={on}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-4 place-items-center rounded-sm border",
                        on ? "border-purple-400 bg-purple-400 text-neutral-950" : "border-white/25",
                      )}
                    >
                      {on && <Check className="size-3" />}
                    </span>
                    <span className="flex-1">{tag.name}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{tag.count}</span>
                    <span className="sr-only">{on ? ", selected" : ""}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        {selected.length > 0 && (
          <div className="border-t p-1">
            <Button variant="ghost" size="sm" className="w-full justify-center" onClick={() => onChange([])}>
              Clear tags
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * content_searched / content_filtered after the reader changes something.
 * Not on the first render: landing on a shared link isn't a search.
 */
function useContentHubAnalytics(type: ContentType, filters: ContentFilters, resultCount: number) {
  const previous = useRef<ContentFilters | null>(null);
  const key = toQueryString(filters);
  useEffect(() => {
    const before = previous.current;
    previous.current = filters;
    if (!before) return;
    if (filters.q && filters.q !== before.q) {
      captureEvent("content_searched", { content_type: type, query_length: filters.q.length, result_count: resultCount });
    }
    const changed =
      filters.category !== before.category ||
      filters.level !== before.level ||
      filters.tags.join() !== before.tags.join();
    if (changed) {
      const active: ("category" | "tag" | "level")[] = [];
      if (filters.category) active.push("category");
      if (filters.tags.length > 0) active.push("tag");
      if (filters.level) active.push("level");
      captureEvent("content_filtered", {
        content_type: type,
        filters: active,
        tag_count: filters.tags.length,
        result_count: resultCount,
      });
    }
    // `key` stands for `filters`: the object is new on every server render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
