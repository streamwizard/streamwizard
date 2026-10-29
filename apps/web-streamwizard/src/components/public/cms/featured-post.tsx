import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SHORT_DATE, type ContentCard as Card } from "@/lib/cms/published";
import {
  CardFocusRing,
  CategoryBadge,
  DifficultyMeter,
  PrerequisiteLabel,
  TagList,
  TimeLabel,
} from "./content-card";
import { ContentCoverFallback } from "./content-cover-fallback";

/** The post on top of an unfiltered index. Same parts as a card, given room. */
export function FeaturedPost({ card }: { card: Card }) {
  const guide = card.type === "guide";
  return (
    <article className="group relative grid overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] transition-colors duration-200 hover:border-white/[0.16] hover:bg-white/[0.035] lg:grid-cols-[1.15fr_1fr]">
      <div className="relative aspect-video overflow-hidden border-b border-white/[0.08] lg:aspect-auto lg:min-h-80 lg:border-b-0 lg:border-r">
        {card.cover ? (
          <Image
            src={card.cover.src}
            alt={card.cover.alt}
            fill
            priority
            sizes="(min-width: 1024px) 640px, 100vw"
            className="bg-black object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
          />
        ) : (
          <ContentCoverFallback
            seed={card.id}
            type={card.type}
            label={card.category?.name ?? null}
            className="absolute inset-0"
          />
        )}
      </div>
      <div className="flex flex-col justify-center gap-4 p-6 md:p-8">
        <p className="font-mono text-xs uppercase tracking-widest text-purple-300">
          {card.featured ? "Featured" : guide ? "Newest guide" : "Latest post"}
        </p>
        <h2 className="text-2xl font-bold leading-tight tracking-tight text-balance md:text-3xl">
          <Link href={card.path} className="after:absolute after:inset-0 focus-visible:outline-none">
            {card.title}
          </Link>
        </h2>
        {card.excerpt && <p className="line-clamp-4 text-base leading-7 text-muted-foreground">{card.excerpt}</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {card.category && <CategoryBadge name={card.category.name} />}
          {card.difficulty && <DifficultyMeter level={card.difficulty} />}
          <TimeLabel card={card} />
        </div>
        <TagList tags={card.tags} max={5} />
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {card.authors.length > 0 && <span>{card.authors.join(", ")}</span>}
            <time dateTime={card.publishedAt}>{SHORT_DATE.format(new Date(card.publishedAt))}</time>
            {guide && <PrerequisiteLabel count={card.prerequisiteCount} />}
          </p>
          <span
            aria-hidden
            className="inline-flex items-center gap-1 text-sm font-medium text-purple-200 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
          >
            {guide ? "Start the guide" : "Read the post"}
            <ArrowRight className="size-4" />
          </span>
        </div>
      </div>
      <CardFocusRing />
    </article>
  );
}
