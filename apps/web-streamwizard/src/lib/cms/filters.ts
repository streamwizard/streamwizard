import type { ContentType } from "@repo/cms";
import { DIFFICULTY_LABELS, type ContentCard, type Difficulty, type Term } from "./published";

// Pure: the search and filters on /blog and /guides. The URL holds the state
// (?q=, ?category=, ?tag= repeated, ?level= on guides), the server parses it
// and filters the cached list, and the client toolbar writes it back. Values
// are slugs, never ids, so a shared link reads like what it shows.

export const MAX_QUERY_LENGTH = 100;

export interface ContentFilters {
  /** Title search, trimmed and with single spaces. Empty means none. */
  q: string;
  category: string | null;
  /** Tag slugs, sorted. A post matches if it has any of them. */
  tags: string[];
  /** Guides only. */
  level: Difficulty | null;
}

export const NO_FILTERS: ContentFilters = { q: "", category: null, tags: [], level: null };

export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface Facet extends Term {
  count: number;
}

/** What the toolbar can offer: only what this type's posts actually use. */
export interface Facets {
  categories: Facet[];
  tags: Facet[];
  levels: { value: Difficulty; label: string; count: number }[];
}

const LEVELS = Object.keys(DIFFICULTY_LABELS) as Difficulty[];

const byCountThenName = (a: Facet, b: Facet) => b.count - a.count || a.name.localeCompare(b.name);

function countTerms(lists: Term[][]): Facet[] {
  const counts = new Map<string, Facet>();
  for (const terms of lists) {
    // A post counts once per term, whatever the data says.
    for (const term of new Map(terms.map((t) => [t.slug, t])).values()) {
      const facet = counts.get(term.slug);
      if (facet) facet.count += 1;
      else counts.set(term.slug, { ...term, count: 1 });
    }
  }
  return [...counts.values()].sort(byCountThenName);
}

export function facetsFor(cards: ContentCard[]): Facets {
  return {
    categories: countTerms(cards.map((card) => card.categories)),
    tags: countTerms(cards.map((card) => card.tags)),
    levels: LEVELS.map((value) => ({
      value,
      label: DIFFICULTY_LABELS[value],
      count: cards.filter((card) => card.difficulty === value).length,
    })).filter((level) => level.count > 0),
  };
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const all = (value: string | string[] | undefined) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

export function normalizeQuery(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH).trim();
}

/** The filters in a URL. Anything this type doesn't use is dropped, so a stale link still shows something. */
export function parseContentFilters(params: RawSearchParams, type: ContentType, facets: Facets): ContentFilters {
  const categories = new Set(facets.categories.map((facet) => facet.slug));
  const tags = new Set(facets.tags.map((facet) => facet.slug));
  const category = first(params.category);
  const level = first(params.level);
  return {
    q: normalizeQuery(first(params.q) ?? ""),
    category: category && categories.has(category) ? category : null,
    tags: [...new Set(all(params.tag).filter((slug) => tags.has(slug)))].sort(),
    level: type === "guide" && level && (LEVELS as string[]).includes(level) ? (level as Difficulty) : null,
  };
}

export function hasActiveFilters(filters: ContentFilters): boolean {
  return filters.q !== "" || filters.category !== null || filters.tags.length > 0 || filters.level !== null;
}

/** Every word of the query has to be somewhere in the title, in any order. */
function titleMatches(title: string, query: string): boolean {
  if (!query) return true;
  const haystack = title.toLocaleLowerCase("en");
  return query
    .toLocaleLowerCase("en")
    .split(" ")
    .every((word) => haystack.includes(word));
}

export function filterCards(cards: ContentCard[], filters: ContentFilters): ContentCard[] {
  const tags = new Set(filters.tags);
  return cards.filter(
    (card) =>
      titleMatches(card.title, filters.q) &&
      (filters.category === null || card.categories.some((term) => term.slug === filters.category)) &&
      (tags.size === 0 || card.tags.some((term) => tags.has(term.slug))) &&
      (filters.level === null || card.difficulty === filters.level),
  );
}

/** The query string for a set of filters, in a fixed order. No leading "?". */
export function toQueryString(filters: ContentFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  for (const tag of [...filters.tags].sort()) params.append("tag", tag);
  if (filters.level) params.set("level", filters.level);
  return params.toString();
}

export function filtersHref(path: string, filters: ContentFilters): string {
  const query = toQueryString(filters);
  return query ? `${path}?${query}` : path;
}

/**
 * The post on top of an unfiltered index: the best-ranked featured one, else
 * the newest. None when there are too few posts for a hero plus a grid.
 */
export function pickFeatured(cards: ContentCard[]): ContentCard | null {
  if (cards.length < 2) return null;
  const featured = cards
    .filter((card) => card.featured)
    .sort(
      (a, b) =>
        (a.pinnedRank ?? Number.MAX_SAFE_INTEGER) - (b.pinnedRank ?? Number.MAX_SAFE_INTEGER) ||
        b.publishedAt.localeCompare(a.publishedAt),
    );
  if (featured[0]) return featured[0];
  return [...cards].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0] ?? null;
}
