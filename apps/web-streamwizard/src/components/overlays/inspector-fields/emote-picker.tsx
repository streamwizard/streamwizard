"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { Button, Input, Label, Popover, PopoverContent, PopoverTrigger } from "@repo/ui";
import type { EmotePick } from "@repo/ui/overlay";
import { cn } from "@/lib/utils";
import { InspectorHint } from "../editor/inspector-hint";

/**
 * Emote picking for overlay settings: a row of picked emotes plus a pop-up
 * grid. The grid shows the channel's whole emote library (its Twitch emotes,
 * every 7TV set, BTTV, FFZ and the globals) and, when searching, results
 * from all of 7TV and FFZ. All of it reads with the app token (Get User
 * Emotes would need a new scope). Picks save their image URL, so an emote
 * from an inactive set or from search works in a widget too.
 */

export interface EmoteSection {
  id: string;
  title: string;
  emotes: EmotePick[];
}

/** One load per page: every picker in the editor shares it. */
let libraryPromise: Promise<EmoteSection[]> | null = null;

function loadEmoteLibrary(): Promise<EmoteSection[]> {
  libraryPromise ??= fetch("/api/twitch/assets/emote_library")
    .then(async (res) => ((res.ok ? await res.json() : null) as { sections?: EmoteSection[] } | null)?.sections ?? [])
    .catch(() => [] as EmoteSection[])
    .then((sections) => {
      // A failed load shouldn't stick for the whole session.
      if (sections.length === 0) libraryPromise = null;
      return sections;
    });
  return libraryPromise;
}

export function useEmoteLibrary(enabled = true): { sections: EmoteSection[] | null; loading: boolean } {
  const [sections, setSections] = useState<EmoteSection[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void loadEmoteLibrary().then((s) => {
      if (!cancelled) setSections(s);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return { sections, loading: enabled && sections === null };
}

/** Providers the server can search across (BTTV needs a login, Twitch has no search). */
const SEARCH_PROVIDERS = [
  { id: "7tv", title: "Search · All of 7TV" },
  { id: "ffz", title: "Search · All of FFZ" },
] as const;
const SEARCH_DEBOUNCE_MS = 350;

/** Results from 7TV and FFZ for a query of 2+ characters, debounced. */
function useEmoteSearch(query: string): { sections: EmoteSection[]; searching: boolean } {
  const [result, setResult] = useState<{ query: string; sections: EmoteSection[] }>({ query: "", sections: [] });
  const active = query.length >= 2;
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const sections = await Promise.all(
        SEARCH_PROVIDERS.map(async (p) => {
          try {
            const params = new URLSearchParams({ provider: p.id, q: query });
            const res = await fetch(`/api/twitch/assets/emote_search?${params}`);
            const body = (res.ok ? await res.json() : null) as { emotes?: EmotePick[] } | null;
            return { id: `search:${p.id}`, title: p.title, emotes: body?.emotes ?? [] };
          } catch {
            return { id: `search:${p.id}`, title: p.title, emotes: [] };
          }
        }),
      );
      if (!cancelled) setResult({ query, sections: sections.filter((s) => s.emotes.length > 0) });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, active]);
  if (!active) return { sections: [], searching: false };
  return { sections: result.query === query ? result.sections : [], searching: result.query !== query };
}

/** Big 7TV sets hold up to 1000 emotes; show this many until "Show all". */
const SECTION_PREVIEW = 42;

export interface EmotePickerProps {
  id: string;
  label: string;
  hint?: ReactNode;
  value: EmotePick[];
  onChange: (value: EmotePick[]) => void;
  /**
   * What makes two emotes the same pick. `url` (default): each image is its
   * own emote, since many share a name (7TV has dozens of ratJAMs). `code`:
   * every emote with that name, for lists like blocked emotes.
   */
  matchBy?: "url" | "code";
  /** Shown in place of the chips while nothing is picked. */
  emptyText?: string;
  max?: number;
}

export function EmotePicker({
  id,
  label,
  hint,
  value,
  onChange,
  matchBy = "url",
  emptyText = "None",
  max = 30,
}: EmotePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  // Loads on first open, or right away when there are old code-only picks to show.
  const needsLookup = value.some((p) => !p.url);
  const { sections, loading } = useEmoteLibrary(open || needsLookup);

  // Old code-only picks have no URL; they match by name until re-picked.
  const idOf = (p: EmotePick) => (matchBy === "code" || !p.url ? `code:${p.code}` : p.url);
  const picked = useMemo(
    () => new Set(value.map((p) => (matchBy === "code" || !p.url ? `code:${p.code}` : p.url))),
    [value, matchBy],
  );
  const lookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sections ?? []) for (const e of s.emotes) if (!map.has(e.code)) map.set(e.code, e.url);
    return map;
  }, [sections]);

  const query = search.trim().toLowerCase();
  const remote = useEmoteSearch(open ? search.trim() : "");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const filtered = useMemo(
    () =>
      (sections ?? [])
        .map((s) => ({ ...s, emotes: query ? s.emotes.filter((e) => e.code.toLowerCase().includes(query)) : s.emotes }))
        .filter((s) => s.emotes.length > 0),
    [sections, query],
  );

  const shown = [...filtered, ...remote.sections];

  function toggle(emote: EmotePick) {
    const key = idOf(emote);
    if (picked.has(key)) onChange(value.filter((p) => idOf(p) !== key));
    // Picking a real emote replaces an old code-only pick of the same name.
    else if (value.length < max) onChange([...value.filter((p) => p.url || p.code !== emote.code), emote]);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Label htmlFor={id} className="text-xs">
            {label}
          </Label>
          {hint ? <InspectorHint label={`About ${label.toLowerCase()}`}>{hint}</InspectorHint> : null}
        </div>
        {value.length > 0 ? (
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => onChange([])}
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {value.length === 0 ? <span className="text-xs text-muted-foreground">{emptyText}</span> : null}
        {value.map((pick) => {
          const src = pick.url || lookup.get(pick.code);
          return (
            <span
              key={idOf(pick)}
              className="group inline-flex h-8 items-center gap-1 rounded-md border bg-muted/40 pl-1 pr-0.5"
              title={pick.code}
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element -- emote CDNs, sized by height
                <img src={src} alt={pick.code} className="h-6 w-auto max-w-12 object-contain" />
              ) : (
                <span className="px-1 font-mono text-[11px]">{pick.code}</span>
              )}
              <button
                type="button"
                aria-label={`Remove ${pick.code}`}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => onChange(value.filter((p) => idOf(p) !== idOf(pick)))}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}

        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setSearch("");
          }}
        >
          <PopoverTrigger asChild>
            <Button id={id} type="button" variant="outline" size="sm" className="h-8 px-2 text-xs">
              <Plus />
              Add
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(100vw-1.5rem,22rem)] p-0" align="start" sideOffset={4}>
            <div className="border-b p-2">
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your emotes, 7TV and FFZ"
                className="h-8 text-sm"
              />
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading emotes
                </div>
              ) : shown.length === 0 ? (
                remote.searching ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching 7TV and FFZ
                  </div>
                ) : (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    {query ? "No emotes match." : "Couldn't load your emotes. Try again in a minute."}
                  </p>
                )
              ) : (
                <>
                  {shown.map((section) => {
                    const all = expanded.has(section.id) || query !== "";
                    const list = all ? section.emotes : section.emotes.slice(0, SECTION_PREVIEW);
                    return (
                      <div key={section.id} className="mb-3 last:mb-0">
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/70">
                          {section.title}
                          <span className="ml-1 font-normal text-muted-foreground">{section.emotes.length}</span>
                        </p>
                        <div className="grid grid-cols-7 gap-1">
                          {list.map((emote, i) => {
                            const on = picked.has(idOf(emote)) || (matchBy === "url" && picked.has(`code:${emote.code}`));
                            return (
                              <button
                                key={`${section.id}:${i}:${emote.url}`}
                                type="button"
                                title={emote.code}
                                aria-label={emote.code}
                                aria-pressed={on}
                                disabled={!on && value.length >= max}
                                onClick={() => toggle(emote)}
                                className={cn(
                                  "flex aspect-square items-center justify-center rounded-md p-1 hover:bg-muted disabled:opacity-40",
                                  on && "bg-primary/15 ring-2 ring-primary",
                                )}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element -- emote CDNs, lazy in a long grid */}
                                <img src={emote.url} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
                              </button>
                            );
                          })}
                        </div>
                        {list.length < section.emotes.length ? (
                          <button
                            type="button"
                            className="mt-1 text-[11px] text-muted-foreground hover:text-foreground"
                            onClick={() => setExpanded((prev) => new Set(prev).add(section.id))}
                          >
                            Show all {section.emotes.length}
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                  {remote.searching ? (
                    <p className="flex items-center gap-2 py-2 text-[11px] text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Searching 7TV and FFZ
                    </p>
                  ) : null}
                </>
              )}
            </div>
            <div className="flex items-center justify-between border-t px-3 py-2 text-[11px] text-muted-foreground">
              <span>
                {value.length} picked{value.length >= max ? ` (max ${max})` : ""}
              </span>
              <button type="button" className="hover:text-foreground" onClick={() => setOpen(false)}>
                Done
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

export interface EmoteCodePickerProps extends Omit<EmotePickerProps, "value" | "onChange"> {
  value: string[];
  onChange: (value: string[]) => void;
}

/** Same picker for lists that only store codes, like blocked emotes. */
export function EmoteCodePicker({ value, onChange, ...rest }: EmoteCodePickerProps) {
  const picks = useMemo(() => value.map((code) => ({ code, url: "" })), [value]);
  return (
    <EmotePicker
      {...rest}
      matchBy="code"
      value={picks}
      onChange={(next) => onChange([...new Set(next.map((p) => p.code))])}
    />
  );
}
