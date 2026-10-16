import type { Metadata } from "next";
import { contentIndexPath, type ContentType } from "@repo/cms";
import { JsonLd } from "@/components/seo/json-ld";
import {
  facetsFor,
  filterCards,
  filtersHref,
  hasActiveFilters,
  NO_FILTERS,
  parseContentFilters,
  pickFeatured,
  type RawSearchParams,
} from "@/lib/cms/filters";
import { cmsImageUrl } from "@/lib/cms/images";
import { getPublicTaxonomy, listPublishedPosts } from "@/lib/cms/public";
import { toCard } from "@/lib/cms/published";
import { absoluteUrl, breadcrumbSchema } from "@/lib/seo";
import { AnimatedGrid } from "./animated-grid";
import { ContentCard } from "./content-card";
import { ContentEmptyState } from "./content-empty-state";
import { ContentHub } from "./content-hub";
import { FeaturedPost } from "./featured-post";

// /blog and /guides: every published post of one type, pinned first, with a
// featured post on top and search and filters from the URL (lib/cms/filters).
// Filtering runs over the cached list, so it never reads the database again.

export const INDEX_COPY: Record<
  ContentType,
  {
    name: string;
    eyebrow: string;
    title: string;
    description: string;
    empty: string;
    noun: { one: string; many: string };
    rest: string;
  }
> = {
  blog: {
    name: "Blog",
    eyebrow: "Blog",
    title: "Notes from building StreamWizard",
    description: "What we shipped, why we built it that way, and what we learned about streaming along the way.",
    empty: "Nothing posted yet. The first one is on its way.",
    noun: { one: "post", many: "posts" },
    rest: "More posts",
  },
  guide: {
    name: "Guides",
    eyebrow: "Guides",
    title: "Set it up once. Stream with it every night.",
    description: "Step-by-step guides for overlays, alerts, clips and Cloud OBS, written by the people who built them.",
    empty: "No guides yet. The first ones are being written.",
    noun: { one: "guide", many: "guides" },
    rest: "More guides",
  },
};

const FILTER_PARAMS = ["q", "category", "tag", "level"];

/** A filtered view is a view of the index, not a page of its own: kept out of search results. */
export function contentIndexMetadata(type: ContentType, params: RawSearchParams): Metadata {
  const path = contentIndexPath(type);
  const filtered = FILTER_PARAMS.some((key) => params[key] !== undefined);
  return {
    title: INDEX_COPY[type].name,
    description: INDEX_COPY[type].description,
    alternates: { canonical: absoluteUrl(path) },
    ...(filtered ? { robots: { index: false, follow: true } } : {}),
  };
}

export async function ContentIndex({ type, searchParams }: { type: ContentType; searchParams: RawSearchParams }) {
  const [rows, taxonomy] = await Promise.all([listPublishedPosts(type), getPublicTaxonomy()]);
  const cards = rows.map((row) => toCard(row, taxonomy, cmsImageUrl));
  const copy = INDEX_COPY[type];
  const path = contentIndexPath(type);

  const facets = facetsFor(cards);
  const filters = parseContentFilters(searchParams, type, facets);
  const filtered = hasActiveFilters(filters);
  const results = filterCards(cards, filters);
  const featured = filtered ? null : pickFeatured(cards);
  const grid = featured ? results.filter((card) => card.id !== featured.id) : results;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <JsonLd schema={breadcrumbSchema(copy.name, path)} />
      <JsonLd
        schema={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "@id": absoluteUrl(`${path}#collection`),
          name: `${copy.name} – StreamWizard`,
          url: absoluteUrl(path),
          inLanguage: "en",
          description: copy.description,
          isPartOf: { "@id": absoluteUrl("/#website") },
          mainEntity: {
            "@type": "ItemList",
            itemListElement: cards.map((card, index) => ({
              "@type": "ListItem",
              position: index + 1,
              url: absoluteUrl(card.path),
              name: card.title,
            })),
          },
        }}
      />
      <section className="pt-16 md:pt-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-purple-300">{copy.eyebrow}</p>
            <h1 className="mt-3 text-balance text-4xl font-bold tracking-tight sm:text-5xl">{copy.title}</h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">{copy.description}</p>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        {cards.length === 0 ? (
          <p className="mx-auto max-w-md rounded-2xl border border-dashed border-white/[0.12] p-10 text-center text-muted-foreground">
            {copy.empty}
          </p>
        ) : (
          <ContentHub
            type={type}
            path={path}
            filters={filters}
            facets={facets}
            resultCount={results.length}
            total={cards.length}
            noun={copy.noun}
          >
            {results.length === 0 ? (
              <ContentEmptyState noun={copy.noun.many} clearHref={filtersHref(path, NO_FILTERS)} />
            ) : (
              <div className="flex flex-col gap-12">
                {featured && <FeaturedPost card={featured} />}
                {grid.length > 0 && (
                  <section aria-labelledby="content-grid-heading">
                    <h2 id="content-grid-heading" className={featured ? "mb-6 text-xl font-semibold tracking-tight" : "sr-only"}>
                      {featured ? copy.rest : `${copy.name} results`}
                    </h2>
                    <AnimatedGrid
                      className="relative grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
                      items={grid.map((card) => ({
                        key: card.id,
                        node: <ContentCard card={card} headingLevel={3} />,
                      }))}
                    />
                  </section>
                )}
              </div>
            )}
          </ContentHub>
        )}
      </section>
    </div>
  );
}
