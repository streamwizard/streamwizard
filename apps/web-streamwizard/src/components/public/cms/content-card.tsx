import Image from "next/image";
import Link from "next/link";
import type { ContentCard as Card } from "@/lib/cms/published";

const DIFFICULTY_LABELS = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" } as const;

const DATE = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** One post or guide in a list. The whole card is the link; the title names it. */
export function ContentCard({ card, headingLevel = 2 }: { card: Card; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] transition-colors hover:border-white/[0.16]">
      {card.cover && (
        <div className="relative aspect-video overflow-hidden border-b border-white/[0.08] bg-black">
          <Image
            src={card.cover.src}
            alt={card.cover.alt}
            fill
            sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          {card.category && <span className="font-medium text-purple-300">{card.category}</span>}
          {card.difficulty && <span>{DIFFICULTY_LABELS[card.difficulty]}</span>}
          <span>{card.readingMinutes} min read</span>
        </p>
        <Heading className="text-lg font-semibold leading-snug tracking-tight">
          <Link href={card.path} className="after:absolute after:inset-0 focus-visible:outline-none">
            {card.title}
          </Link>
        </Heading>
        {card.excerpt && <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{card.excerpt}</p>}
        <p className="mt-auto pt-2 text-xs text-muted-foreground">
          {card.authors.length > 0 && <span>{card.authors.join(", ")} · </span>}
          <time dateTime={card.publishedAt}>{DATE.format(new Date(card.publishedAt))}</time>
        </p>
      </div>
      {/* The link's ::after covers the card, so its focus ring goes on the card. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-transparent ring-offset-0 group-has-[a:focus-visible]:ring-purple-400"
      />
    </article>
  );
}
