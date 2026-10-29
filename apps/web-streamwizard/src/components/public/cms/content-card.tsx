import Image from "next/image";
import Link from "next/link";
import { Badge, cn } from "@repo/ui";
import { Clock, ListChecks } from "lucide-react";
import { DIFFICULTY_LABELS, SHORT_DATE, type ContentCard as Card, type Difficulty } from "@/lib/cms/published";
import { ContentCoverFallback } from "./content-cover-fallback";

const MAX_TAGS = 3;
const LEVEL_BARS: Record<Difficulty, number> = { beginner: 1, intermediate: 2, advanced: 3 };

/** Three bars and the word: the label carries the meaning, the bars are a glance. */
export function DifficultyMeter({ level }: { level: Difficulty }) {
  const filled = LEVEL_BARS[level];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span aria-hidden className="flex items-end gap-0.5">
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={cn(
              "w-1 rounded-sm",
              bar === 1 ? "h-1.5" : bar === 2 ? "h-2.5" : "h-3.5",
              bar <= filled ? "bg-purple-300" : "bg-white/15",
            )}
          />
        ))}
      </span>
      {DIFFICULTY_LABELS[level]}
    </span>
  );
}

export function CategoryBadge({ name }: { name: string }) {
  return (
    <Badge variant="outline" className="border-purple-400/30 bg-purple-400/[0.08] text-purple-200">
      {name}
    </Badge>
  );
}

/** Reading time for a post, time to finish for a guide. */
export function TimeLabel({ card }: { card: Card }) {
  const guide = card.type === "guide";
  const minutes = guide ? (card.estimatedMinutes ?? card.readingMinutes) : card.readingMinutes;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
      <Clock aria-hidden className="size-3.5" />
      {guide ? `~${minutes} min` : `${minutes} min read`}
    </span>
  );
}

export function TagList({ tags, max = MAX_TAGS }: { tags: Card["tags"]; max?: number }) {
  if (tags.length === 0) return null;
  const shown = tags.slice(0, max);
  const rest = tags.length - shown.length;
  return (
    <ul aria-label="Tags" className="flex flex-wrap gap-1.5">
      {shown.map((tag) => (
        <li
          key={tag.slug}
          className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[11px] text-muted-foreground"
        >
          {tag.name}
        </li>
      ))}
      {rest > 0 && (
        <li className="px-1 py-0.5 text-[11px] text-muted-foreground">
          +{rest}
          <span className="sr-only"> more</span>
        </li>
      )}
    </ul>
  );
}

export function PrerequisiteLabel({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <ListChecks aria-hidden className="size-3.5" />
      {count === 0 ? "No prerequisites" : count === 1 ? "1 prerequisite" : `${count} prerequisites`}
    </span>
  );
}

/** The link's ::after covers the card, so its focus ring goes on the card. */
export function CardFocusRing({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-transparent group-has-[a:focus-visible]:ring-purple-400",
        className,
      )}
    />
  );
}

/** One post or guide in a list. The whole card is the link; the title names it. */
export function ContentCard({ card, headingLevel = 2 }: { card: Card; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const guide = card.type === "guide";
  return (
    <article className="group relative flex w-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] transition-colors duration-200 hover:border-white/[0.16] hover:bg-white/[0.035]">
      <div className="relative aspect-video overflow-hidden border-b border-white/[0.08]">
        {card.cover ? (
          <Image
            src={card.cover.src}
            alt={card.cover.alt}
            fill
            sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
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
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {card.category && <CategoryBadge name={card.category.name} />}
          {card.difficulty && <DifficultyMeter level={card.difficulty} />}
          <TimeLabel card={card} />
        </div>
        <Heading className="text-lg font-semibold leading-snug tracking-tight text-balance">
          <Link href={card.path} className="after:absolute after:inset-0 focus-visible:outline-none">
            {card.title}
          </Link>
        </Heading>
        {card.excerpt && <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{card.excerpt}</p>}
        <TagList tags={card.tags} />
        <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-muted-foreground">
          {card.authors.length > 0 && <span>{card.authors.join(", ")}</span>}
          <time dateTime={card.publishedAt}>{SHORT_DATE.format(new Date(card.publishedAt))}</time>
          {guide && <PrerequisiteLabel count={card.prerequisiteCount} />}
        </p>
      </div>
      <CardFocusRing />
    </article>
  );
}
