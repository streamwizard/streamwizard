import { contentIndexPath, type ContentType } from "@repo/cms";
import { JsonLd } from "@/components/seo/json-ld";
import { cmsImageUrl } from "@/lib/cms/images";
import { getPublicTaxonomy, listPublishedPosts } from "@/lib/cms/public";
import { toCard } from "@/lib/cms/published";
import { absoluteUrl, breadcrumbSchema } from "@/lib/seo";
import { ContentCard } from "./content-card";

// /blog and /guides: every published post of one type, pinned first.

export const INDEX_COPY: Record<
  ContentType,
  { name: string; eyebrow: string; title: string; description: string; empty: string }
> = {
  blog: {
    name: "Blog",
    eyebrow: "Blog",
    title: "Notes from building StreamWizard",
    description: "What we shipped, why we built it that way, and what we learned about streaming along the way.",
    empty: "Nothing posted yet. The first one is on its way.",
  },
  guide: {
    name: "Guides",
    eyebrow: "Guides",
    title: "Set it up once. Stream with it every night.",
    description: "Step-by-step guides for overlays, alerts, clips and Cloud OBS, written by the people who built them.",
    empty: "No guides yet. The first ones are being written.",
  },
};

export async function ContentIndex({ type }: { type: ContentType }) {
  const [rows, taxonomy] = await Promise.all([listPublishedPosts(type), getPublicTaxonomy()]);
  const cards = rows.map((row) => toCard(row, taxonomy, cmsImageUrl));
  const copy = INDEX_COPY[type];
  const path = contentIndexPath(type);

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
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <li key={card.id} className="flex">
                <ContentCard card={card} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
